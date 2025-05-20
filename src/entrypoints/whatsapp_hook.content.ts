export default defineContentScript({
    matches: ["https://web.whatsapp.com/*"],
    runAt: "document_start",
    world: "MAIN",
    main: () => {
      type AudioRecord = {
        blob: Blob;
        mime: string;
        sent: boolean;
      };
  
      const audioMap = new Map<string, AudioRecord>();
      const originalCreateObjectURL = URL.createObjectURL;
  
      URL.createObjectURL = function (blob: Blob | MediaSource) {
        const url = originalCreateObjectURL.call(this, blob as Blob);
  
        if ((blob as Blob).type?.startsWith("audio/")) {
          audioMap.set(url, {
            blob: blob as Blob,
            mime: (blob as Blob).type,
            sent: false,
          });
        }
  
        return url;
      };
  
      function processAndSendAudio(url: string): void {
        const record = audioMap.get(url);
        if (!record || record.sent) return;
  
        record.sent = true;
  
        record.blob.arrayBuffer().then((buffer: ArrayBuffer) => {
          window.postMessage(
            {
              source: "WA_TRANSCRIBER",
              type: "WA_AUDIO",
              mime: record.mime,
              data: [...new Uint8Array(buffer)],
            },
            "*"
          );
        });
      }
  
      function patchSrcSetter(obj: HTMLMediaElement): void {
        const descriptor =
          Object.getOwnPropertyDescriptor(obj, "src") ||
          Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
  
        if (!descriptor) return;
  
        Object.defineProperty(obj, "src", {
          configurable: true,
          enumerable: true,
          get() {
            return descriptor.get?.call(this);
          },
          set(value: string) {
            processAndSendAudio(value);
            return descriptor.set?.call(this, value);
          },
        });
      }
  
      const nativeAudio = Audio;
      window.Audio = new Proxy(nativeAudio, {
        construct(Target, args, newTarget) {
          const audio = Reflect.construct(Target, args, newTarget);
  
          if (args[0]) processAndSendAudio(args[0]);
  
          patchSrcSetter(audio as HTMLMediaElement);
  
          return audio;
        },
      });
  
      patchSrcSetter(HTMLMediaElement.prototype);
    },
  });
  
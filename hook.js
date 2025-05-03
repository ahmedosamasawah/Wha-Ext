(() => {
  const audioMap = new Map();
  const origCreate = URL.createObjectURL;

  URL.createObjectURL = function (blob) {
    const url = origCreate.apply(this, arguments);
    if (blob?.type?.startsWith("audio/"))
      audioMap.set(url, { blob, mime: blob.type, sent: false });

    return url;
  };

  function maybeSend(url) {
    const rec = audioMap.get(url);
    if (!rec || rec.sent) return;
    rec.sent = true;

    rec.blob.arrayBuffer().then((buf) => {
      window.postMessage(
        {
          source: "WA_TRANSCRIBER",
          type: "WA_AUDIO",
          mime: rec.mime,
          data: [...new Uint8Array(buf)],
        },
        "*"
      );
    });
  }

  function patchSrcSetter(obj) {
    const desc =
      Object.getOwnPropertyDescriptor(obj, "src") ||
      Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");

    Object.defineProperty(obj, "src", {
      configurable: true,
      enumerable: true,
      get() {
        return desc.get.call(this);
      },
      set(v) {
        maybeSend(v);
        return desc.set.call(this, v);
      },
    });
  }

  const NativeAudio = Audio;
  window.Audio = new Proxy(NativeAudio, {
    construct(Target, args, newTarget) {
      const audio = Reflect.construct(Target, args, newTarget);
      if (args[0]) maybeSend(args[0]);
      patchSrcSetter(audio);
      return audio;
    },
  });

  patchSrcSetter(HTMLMediaElement.prototype);
})();

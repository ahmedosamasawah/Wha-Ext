import { createBaseTranscriber } from "./base";
import type {
  TranscriberProvider,
  ApiKeyVerificationResult,
} from "$types/providers";

interface LocalWhisperConfig {
  apiUrl?: string;
}

interface ConversionResult {
  blob: Blob;
  extension: string;
}

const isAudioConversionSupported = (): boolean => {
  return typeof window !== "undefined" && window.AudioContext !== undefined;
};

const convertToWav = async (
  audioBlob: Blob,
  apiUrl?: string
): Promise<ConversionResult> => {
  if (audioBlob.type === "audio/wav") {
    return { blob: audioBlob, extension: "wav" };
  }

  if (!isAudioConversionSupported()) {
    console.warn("Audio conversion not supported in this environment");
    return { blob: audioBlob, extension: "ogg" };
  }

  return new Promise<ConversionResult>((resolve) => {
    try {
      const AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      const fileReader = new FileReader();

      fileReader.onload = async (event) => {
        try {
          const arrayBuffer = (event.target as FileReader)
            .result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const wavBlob = audioBufferToWav(audioBuffer);
          resolve({ blob: wavBlob, extension: "wav" });
          audioContext.close();
        } catch (error) {
          console.warn("Error converting to WAV:", error);
          resolve({ blob: audioBlob, extension: "ogg" });
          try {
            audioContext.close();
          } catch (e) {}
        }
      };

      fileReader.onerror = () => {
        console.warn("Error reading audio file");
        resolve({ blob: audioBlob, extension: "ogg" });
      };

      fileReader.readAsArrayBuffer(audioBlob);
    } catch (error) {
      console.error("Critical error during audio conversion setup:", error);
      resolve({ blob: audioBlob, extension: "ogg" });
    }
  });
};

const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataLength = numSamples * numChannels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const dataView = new DataView(arrayBuffer);

  writeString(dataView, 0, "RIFF");
  dataView.setUint32(4, 36 + dataLength, true);
  writeString(dataView, 8, "WAVE");
  writeString(dataView, 12, "fmt ");
  dataView.setUint32(16, 16, true);
  dataView.setUint16(20, format, true);
  dataView.setUint16(22, numChannels, true);
  dataView.setUint32(24, sampleRate, true);
  dataView.setUint32(28, sampleRate * blockAlign, true);
  dataView.setUint16(32, blockAlign, true);
  dataView.setUint16(34, bitsPerSample, true);
  writeString(dataView, 36, "data");
  dataView.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, buffer.getChannelData(channel)[i])
      );
      const int16Sample = sample < 0 ? sample * 32768 : sample * 32767;
      dataView.setInt16(offset, int16Sample, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
};

const writeString = (
  dataView: DataView,
  offset: number,
  string: string
): void => {
  for (let i = 0; i < string.length; i++) {
    dataView.setUint8(offset + i, string.charCodeAt(i));
  }
};

export const createLocalWhisperTranscriber = (
  config: LocalWhisperConfig = {}
): TranscriberProvider => {
  const apiUrl = config.apiUrl || "http://localhost:9000";

  const verifyWhisperServer = async (): Promise<ApiKeyVerificationResult> => {
    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: "GET",
      });

      if (response.ok) return { valid: true };
      else
        return {
          valid: false,
          error: "Local Whisper server is not responding properly",
        };
    } catch (error) {
      return {
        valid: false,
        error: `Cannot connect to Local Whisper server: ${
          (error as Error).message
        }`,
      };
    }
  };

  const transcribeWithWhisper = async (
    audioBlob: Blob,
    options: { language?: string } = {}
  ): Promise<string> => {
    try {
      const { blob: convertedBlob, extension } = await convertToWav(audioBlob);

      const formData = new FormData();
      formData.append(
        "file",
        new File([convertedBlob], `audio.${extension}`, {
          type: convertedBlob.type,
        })
      );

      if (options.language && options.language !== "auto")
        formData.append("language", options.language);

      const response = await fetch(`${apiUrl}/inference`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local Whisper transcription failed: ${errorText}`);
      }

      const result = await response.json();
      return result.text;
    } catch (error) {
      throw new Error(
        `Error with Local Whisper transcription: ${(error as Error).message}`
      );
    }
  };

  return {
    ...createBaseTranscriber(),
    verifyApiKey: verifyWhisperServer,
    transcribeAudio: transcribeWithWhisper,
  };
};

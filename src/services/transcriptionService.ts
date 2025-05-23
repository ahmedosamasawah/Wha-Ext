import { getProcessor, getTranscriber } from "$api/index";

import {
  initialize,
  updateStatus,
  getAllSettings,
  updateSettings,
  type Settings,
} from "./settingsService";

import { defaultTemplates } from "$utils/template";
import { TranscriptionError, formatTranscriptionError } from "$utils/apiErrors";

interface TranscriberConfig {
  apiKey: string;
  transcriptionModel?: string;
  apiUrl?: string;
}

export interface ApiKeyVerificationResult {
  valid: boolean;
  error?: string;
}

export interface ProcessedResult {
  original: string;
  processed: string;
  error?: string;
}

export interface TranscriberProvider {
  transcribeAudio: (
    audioBlob: Blob,
    options: { language: string }
  ) => Promise<string>;
  verifyApiKey: (apiKey?: string) => Promise<ApiKeyVerificationResult>;
}

export interface ProcessorProvider {
  processTranscription: (
    text: string,
    options: { language: string; promptTemplate?: string }
  ) => Promise<ProcessedResult>;
  verifyApiKey: (apiKey?: string) => Promise<ApiKeyVerificationResult>;
}

export const configureTranscriber = (
  settings: Partial<Settings> = {}
): TranscriberProvider => {
  const providerType = settings.transcriptionProviderType || "openai";

  const config: TranscriberConfig = {
    apiKey: settings.transcriptionApiKey || "",
    transcriptionModel: settings.transcriptionModel,
  };

  if (providerType === "localWhisper")
    config.apiUrl = settings.localWhisperUrl || "http://localhost:9000";

  console.log("Config", config);

  return getTranscriber(providerType, config);
};

export const configureProcessingProvider = (
  settings: Partial<Settings> = {}
): ProcessorProvider => {
  const providerType = settings.processingProviderType || "openai";

  const config: any = {
    apiKey: settings.processingApiKey || "",
    processingModel: settings.processingModel,
  };

  if (providerType === "ollama") {
    config.ollamaServerUrl =
      settings.ollamaServerUrl || "http://localhost:11434";
    config.model = settings.processingModel || "ollama3.2:latest";
  }

  return getProcessor(providerType, config);
};

export const verifyLocalWhisperServer = async (
  options: { localWhisperUrl?: string } = {}
): Promise<ApiKeyVerificationResult> => {
  const apiUrl = options.localWhisperUrl || "http://localhost:9000";

  const provider = getTranscriber("localWhisper", { apiUrl });

  const result = await provider.verifyApiKey();
  if (result.valid)
    await updateSettings({
      localWhisperUrl: apiUrl,
      transcriptionProviderType: "localWhisper",
    });

  return result;
};

export const verifyApiKey = async (
  apiKey: string,
  providerType: string,
  providerCategory: "transcription" | "processing",
  options: { localWhisperUrl?: string; ollamaServerUrl?: string } = {}
): Promise<ApiKeyVerificationResult> => {
  try {
    if (providerType === "localWhisper")
      return verifyLocalWhisperServer(options);

    if (providerType === "ollama" && providerCategory === "processing") {
      const ollamaServerUrl =
        options.ollamaServerUrl || "http://localhost:11434";
      const provider = getProcessor(providerType, { ollamaServerUrl });
      const result = await provider.verifyApiKey();

      if (result.valid) {
        await updateSettings({
          ollamaServerUrl,
          processingProviderType: "ollama",
        });
      }

      return result;
    }

    const provider =
      providerCategory === "transcription"
        ? getTranscriber(providerType, { apiKey })
        : getProcessor(providerType, { apiKey });

    const result = await provider.verifyApiKey(apiKey);

    if (result.valid)
      await updateSettings({
        [`${providerCategory}ApiKey`]: apiKey,
        [`${providerCategory}ProviderType`]: providerType,
      });

    return result;
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
};

export const processVoiceMessage = async (
  audioBlob: Blob
): Promise<ProcessedResult> => {
  updateStatus({ pendingTranscriptions: 1 });

  try {
    await initialize();

    const settings = getAllSettings();
    const transcriber = configureTranscriber(settings);
    const processor = configureProcessingProvider(settings);

    const transcription = await transcriber.transcribeAudio(audioBlob, {
      language: settings.language,
    });

    const promptTemplate =
      settings.promptTemplate ||
      defaultTemplates[settings.processingProviderType]?.processing;

    const processed = await processor.processTranscription(transcription, {
      language: settings.language,
      promptTemplate: promptTemplate,
    });

    updateStatus({ pendingTranscriptions: 0, lastError: null });
    return processed;
  } catch (error) {
    const err = new TranscriptionError((error as Error).message);

    updateStatus({
      pendingTranscriptions: 0,
      lastError: err.message,
    });
    return formatTranscriptionError(err);
  }
};

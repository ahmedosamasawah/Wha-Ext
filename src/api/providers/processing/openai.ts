import { createBaseProcessor } from "./base";
import { parseOpenAIError } from "$utils/apiErrors";
import { verifyApiKey } from "$utils/apiKeyVerifier";
import { parseProcessedResponse } from "$utils/responseParser";
import { renderTemplate, defaultTemplates } from "$utils/template";

import type {
  ProcessorProvider,
  ApiKeyVerificationResult,
  ProcessedResult,
} from "$types/providers";

interface OpenAIProcessorConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  processingModel?: string;
}

const DEFAULT_CONFIG: OpenAIProcessorConfig = {
  apiUrl: "https://api.openai.com",
  model: "gpt-4o",
};

export const createOpenAIProcessor = (
  config: OpenAIProcessorConfig = {}
): ProcessorProvider => {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const { apiKey } = settings;
  const model = config.processingModel || settings.model;

  const verifyOpenAIKey = async (
    key?: string
  ): Promise<ApiKeyVerificationResult> => {
    return verifyApiKey({
      apiKey: key || apiKey,
      providerType: "openai",
      apiUrl: settings.apiUrl,
      customValidation: {
        formatCheck: (k: string) => k.startsWith("sk-"),
        formatErrorMessage: "Invalid API key format, should start with sk-",
      },
    });
  };

  const processWithOpenAI = async (
    transcription: string,
    options: { promptTemplate?: string; language?: string } = {}
  ): Promise<ProcessedResult> => {
    if (!apiKey) throw new Error("API key not configured");

    const promptTemplate =
      options.promptTemplate || defaultTemplates.openai.processing;
    const promptContent = renderTemplate(promptTemplate, {
      transcription,
      language: options.language || "same as transcription",
    });

    const response = await fetch(`${settings.apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: promptContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorData = parseOpenAIError(errorText, "Processing failed");
      throw new Error(errorData.message);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    return parseProcessedResponse(content, transcription);
  };

  return {
    ...createBaseProcessor(),
    verifyApiKey: verifyOpenAIKey,
    processTranscription: processWithOpenAI,
  };
};

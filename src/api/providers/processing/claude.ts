import { createBaseProcessor } from "./base";
import { parseClaudeError } from "$utils/apiErrors";
import { verifyApiKey } from "$utils/apiKeyVerifier";
import { parseProcessedResponse } from "$utils/responseParser";
import { renderTemplate, defaultTemplates } from "$utils/template";

import type {
  ProcessorProvider,
  ApiKeyVerificationResult,
  ProcessedResult,
} from "$types/providers";

interface ClaudeProcessorConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  processingModel?: string;
}

const DEFAULT_CONFIG: ClaudeProcessorConfig = {
  apiUrl: "https://api.anthropic.com",
  model: "claude-3-opus-20240229",
};

export const createClaudeProcessor = (
  config: ClaudeProcessorConfig = {}
): ProcessorProvider => {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const { apiKey } = settings;
  const model = config.processingModel || settings.model;

  const verifyClaudeKey = async (
    key?: string
  ): Promise<ApiKeyVerificationResult> => {
    return verifyApiKey({
      apiKey: key || apiKey,
      providerType: "claude",
      apiUrl: settings.apiUrl,
      model: model,
      customValidation: {
        formatCheck: (k: string) => k.startsWith("sk-ant-"),
        formatErrorMessage: "Invalid API key format, should start with sk-ant-",
      },
    });
  };

  const processWithClaude = async (
    transcription: string,
    options: { promptTemplate?: string; language?: string } = {}
  ): Promise<ProcessedResult> => {
    if (!apiKey) throw new Error("API key not configured");

    const promptTemplate =
      options.promptTemplate ||
      defaultTemplates.claude?.processing ||
      defaultTemplates.openai.processing;

    const promptContent = renderTemplate(promptTemplate, {
      transcription,
      language: options.language || "same as transcription",
    });

    const response = await fetch(`${settings.apiUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: promptContent,
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorData = parseClaudeError(errorText, "Processing failed");
      throw new Error(errorData.message);
    }

    const result = await response.json();
    const content = result.content[0].text;
    return parseProcessedResponse(content, transcription);
  };

  return {
    ...createBaseProcessor(),
    verifyApiKey: verifyClaudeKey,
    processTranscription: processWithClaude,
  };
};

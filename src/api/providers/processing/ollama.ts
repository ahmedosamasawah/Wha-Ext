import { createBaseProcessor } from "./base";
import { parseProcessedResponse } from "$utils/responseParser";
import { renderTemplate, defaultTemplates } from "$utils/template";
import type {
  ProcessedResult,
  ProcessorProvider,
  OllamaProcessorConfig,
  ApiKeyVerificationResult,
} from "$types/providers";

const DEFAULT_CONFIG: OllamaProcessorConfig = {
  apiUrl: "http://localhost:11434",
  model: "ollama3.2:latest",
};

export const createOllamaProcessor = (
  config: OllamaProcessorConfig = {}
): ProcessorProvider => {
  const settings = { ...DEFAULT_CONFIG, ...config };

  if (config.ollamaServerUrl) settings.apiUrl = config.ollamaServerUrl;

  const verifyOllamaKey = async (): Promise<ApiKeyVerificationResult> => {
    try {
      const response = await fetch(`${settings.apiUrl}/api/tags`);

      if (!response.ok) throw new Error("Failed to connect to Ollama server");

      const data = await response.json();

      if (!data.models || !Array.isArray(data.models))
        throw new Error("Unexpected response from Ollama server");

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Ollama server error: ${
          (error as Error).message
        }. Make sure Ollama is running at ${settings.apiUrl}`,
      };
    }
  };

  const processWithOllama = async (
    transcription: string,
    options: { promptTemplate?: string; language?: string } = {}
  ): Promise<ProcessedResult> => {
    const promptTemplate =
      options.promptTemplate ||
      defaultTemplates.ollama?.processing ||
      defaultTemplates.openai.processing;

    const promptContent = renderTemplate(promptTemplate, {
      transcription,
      language: options.language || "same as transcription",
    });

    try {
      const response = await fetch(`${settings.apiUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model || "ollama3.2:latest",
          prompt: promptContent,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama processing failed: ${errorText}`);
      }

      const result = await response.json();

      const content =
        result.response[result.response.length - 1] !== "}"
          ? result.response + "}"
          : result.response;

      return parseProcessedResponse(content, transcription);
    } catch (error) {
      throw error;
    }
  };

  return {
    ...createBaseProcessor(),
    verifyApiKey: verifyOllamaKey,
    processTranscription: processWithOllama,
  };
};

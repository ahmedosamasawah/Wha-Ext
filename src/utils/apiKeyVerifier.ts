import { parseOpenAIError, parseClaudeError } from "$utils/apiErrors";
import { ApiKeyVerificationResult } from "$types/providers";

interface ApiKeyVerificationOptions {
  apiKey?: string;
  providerType: string;
  apiUrl?: string;
  model?: string;
  customValidation?: {
    formatCheck: (key: string) => boolean;
    formatErrorMessage?: string;
  };
}

export async function verifyApiKey(
  options: ApiKeyVerificationOptions
): Promise<ApiKeyVerificationResult> {
  const { apiKey, providerType, apiUrl, model, customValidation } = options;

  if (!apiKey) return { valid: false, error: "API key is empty" };

  if (customValidation?.formatCheck && !customValidation.formatCheck(apiKey))
    return {
      valid: false,
      error: customValidation.formatErrorMessage || "Invalid API key format",
    };

  try {
    if (providerType === "openai") return await verifyOpenAIKey(apiKey, apiUrl);
    else if (providerType === "claude") {
      console.log("Verifying Claude key", apiKey, "\n", apiUrl, "\n");
      return await verifyClaudeKey(apiKey, apiUrl, model);
    }
    return { valid: false, error: `Unknown provider type: ${providerType}` };
  } catch (error) {
    return {
      valid: false,
      error:
        (error as Error).message || `Error validating ${providerType} API key`,
    };
  }
}

async function verifyOpenAIKey(
  apiKey: string,
  apiUrl: string = "https://api.openai.com"
): Promise<ApiKeyVerificationResult> {
  const response = await fetch(`${apiUrl}/v1/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    const errorData = parseOpenAIError(errorText, "Invalid API key");
    return {
      valid: false,
      error: errorData.message,
    };
  }

  return { valid: true };
}

async function verifyClaudeKey(
  apiKey: string,
  apiUrl: string = "https://api.anthropic.com",
  model: string = "claude-3-opus-20240229"
): Promise<ApiKeyVerificationResult> {
  const response = await fetch(`${apiUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    const errorData = parseClaudeError(error, "Invalid API key");
    return {
      valid: false,
      error: errorData.message,
    };
  }

  return { valid: true };
}

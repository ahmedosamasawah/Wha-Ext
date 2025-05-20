import { ProcessedResult } from "$types/providers";

interface AIResponse {
  original_transcript?: string;
  cleaned_transcript?: string;
  summary?: string;
  reply?: string;
}

/**
 * Parse the JSON response from an AI model into a structured format
 * @param response The JSON response from the AI model
 * @param originalTranscription The original transcription text
 * @returns Processed result with transcript, cleaned text, summary, and reply
 */
export function parseProcessedResponse(
  response: string,
  originalTranscription: string
): ProcessedResult {
  let result: ProcessedResult = {
    original: originalTranscription,
    processed: "",
    error: undefined,
  };

  try {
    const json = JSON.parse(response) as AIResponse;
    if (json && typeof json === "object") {
      result.original = json.original_transcript || originalTranscription;
      result.processed = json.cleaned_transcript || "";

      // Additional fields that might be useful but aren't in the ProcessedResult interface
      const summary = json.summary || "";
      const reply = json.reply || "";

      if (!json.cleaned_transcript) console.warn("Missing cleaned_transcript");
      if (!json.summary) console.warn("Missing summary");
      if (!json.reply) console.warn("Missing reply");
      return result;
    }
  } catch (error) {
    console.warn("Failed to parse JSON:", (error as Error).message);
    result.processed = response.trim();
    result.error = "Error: Could not parse AI response as JSON";
  }

  return result;
}

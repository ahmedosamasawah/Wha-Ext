import { ProcessedResult } from "$types/providers";

interface AIResponse {
  original_transcript?: string;
  cleaned_transcript?: string;
  summary?: string;
  reply?: string;
}

export function parseProcessedResponse(
  response: string,
  originalTranscription: string
): ProcessedResult & { summary?: string; reply?: string } {
  let result: ProcessedResult & { summary?: string; reply?: string } = {
    original: originalTranscription,
    processed: "",
    error: undefined,
  };

  try {
    let cleanedResponse = response.trim();

    const jsonMarkdownMatch = cleanedResponse.match(
      /^```json\s*([\s\S]*?)```$/
    );
    if (jsonMarkdownMatch && jsonMarkdownMatch[1])
      cleanedResponse = jsonMarkdownMatch[1].trim();
    else if (
      cleanedResponse.startsWith("```") &&
      cleanedResponse.endsWith("```")
    )
      cleanedResponse = cleanedResponse.slice(3, -3).trim();

    const json = JSON.parse(cleanedResponse) as AIResponse;
    if (json && typeof json === "object") {
      result.original = json.original_transcript || originalTranscription;
      result.processed = json.cleaned_transcript || "";
      result.summary = json.summary || "";
      result.reply = json.reply || "";

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

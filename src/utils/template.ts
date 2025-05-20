interface Variables {
  [key: string]: string | undefined;
}

interface TemplateConfig {
  processing: string;
  [key: string]: string;
}

interface TemplateProviders {
  openai: TemplateConfig;
  claude: TemplateConfig;
  [key: string]: TemplateConfig;
}

export function renderTemplate(
  template: string,
  variables: Variables = {}
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    return variables[trimmedKey] !== undefined ? variables[trimmedKey]! : match;
  });
}

export const defaultTemplates: TemplateProviders = {
  openai: {
    processing: `You are an AI assistant that processes WhatsApp voice message transcriptions. Process the following transcript and provide your response in the following JSON format:

{
  "original_transcript": "Copy the original transcript exactly as provided.",
  "cleaned_transcript": "If the transcript is not in English, translate it to English. Then, create a grammatically correct, polished version in English. Remove filler words, false starts, and repetitions. Maintain the original meaning.",
  "summary": "Write a concise 1-2 sentence summary in English that captures the core message and key information from the transcript.",
  "reply": "Suggest a natural, conversational reply in English that directly addresses the main points or questions from the message."
}

Ensure that the response contains only the JSON object with no additional text.

TRANSCRIPT:
{{transcription}}`,
  },

  claude: {
    processing: `You are an AI assistant that processes WhatsApp voice message transcriptions. Process the following transcript and provide your response in the following JSON format:

{
  "original_transcript": "Copy the original transcript exactly as provided.",
  "cleaned_transcript": "If the transcript is not in English, translate it to English. Then, create a grammatically correct, polished version in English. Remove filler words, false starts, and repetitions. Maintain the original meaning.",
  "summary": "Write a concise 1-2 sentence summary in English that captures the core message and key information from the transcript.",
  "reply": "Suggest a natural, conversational reply in English that directly addresses the main points or questions from the message."
}

Ensure that the response contains only the JSON object with no additional text.

TRANSCRIPT:
{{transcription}}`,
  },
};

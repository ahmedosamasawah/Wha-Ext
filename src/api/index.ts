import { createOpenAIProcessor } from "./providers/processing/openai";
import { createClaudeProcessor } from "./providers/processing/claude";
import { createOpenAITranscriber } from "./providers/transcription/openai";
import type { ProcessorProvider, TranscriberProvider } from "$types/providers";
import { createLocalWhisperTranscriber } from "./providers/transcription/local-whisper";

interface ProviderCreator<T> {
  (config: any): T;
}

const TRANSCRIPTION_PROVIDERS: Record<
  string,
  ProviderCreator<TranscriberProvider>
> = {
  openai: createOpenAITranscriber,
  localWhisper: createLocalWhisperTranscriber,
};

const PROCESSING_PROVIDERS: Record<
  string,
  ProviderCreator<ProcessorProvider>
> = {
  openai: createOpenAIProcessor,
  claude: createClaudeProcessor,
};

export function getTranscriber(
  type: string,
  config: any = {}
): TranscriberProvider {
  const createProvider = TRANSCRIPTION_PROVIDERS[type];

  if (!createProvider)
    throw new Error(`Transcription provider '${type}' not found`);

  return createProvider(config);
}

export function getProcessor(
  type: string,
  config: any = {}
): ProcessorProvider {
  const createProvider = PROCESSING_PROVIDERS[type];

  if (!createProvider)
    throw new Error(`Processing provider '${type}' not found`);

  return createProvider(config);
}

export function getSupportedTranscribers(): string[] {
  return Object.keys(TRANSCRIPTION_PROVIDERS);
}

export function getSupportedProcessors(): string[] {
  return Object.keys(PROCESSING_PROVIDERS);
}

export function getDefaultTranscriber(): string {
  return "openai";
}

export function getDefaultProcessor(): string {
  return "openai";
}

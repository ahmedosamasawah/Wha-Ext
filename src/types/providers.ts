export interface Provider {
  id: string;
  name: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface ProviderModels {
  openai: {
    processing: ModelOption[];
    transcription: ModelOption[];
  };
  claude: {
    processing: ModelOption[];
    transcription: ModelOption[];
  };
  [key: string]: {
    processing: ModelOption[];
    transcription: ModelOption[];
  };
}

export interface ProcessedResult {
  original: string;
  processed: string;
  error?: string;
}

export interface ApiKeyVerificationResult extends VerificationResult {}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  message?: string;
}

export interface SettingsSavedStatus {
  success: boolean;
  message: string;
}

export interface VerificationStatus {
  valid: boolean;
  message: string;
}

export interface ProcessorProvider {
  id?: string;
  name?: string;
  apiKey?: string;
  model?: string;
  process?(text: string, language: string): Promise<ProcessedResult>;
  processTranscription(
    text: string,
    options: { language: string; promptTemplate?: string }
  ): Promise<ProcessedResult>;
  verifyApiKey(apiKey?: string): Promise<ApiKeyVerificationResult>;
}

export interface TranscriberProvider {
  id?: string;
  name?: string;
  apiKey?: string;
  model?: string;
  transcribe?(audio: Blob, language: string): Promise<string>;
  transcribeAudio(
    audioBlob: Blob,
    options: { language: string }
  ): Promise<string>;
  verifyApiKey(
    apiKey?: string,
    options?: any
  ): Promise<ApiKeyVerificationResult>;
}

export interface OllamaProcessorConfig {
  apiUrl?: string;
  model?: string;
  ollamaServerUrl?: string;
}

export interface ProcessorConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  processingModel?: string;
}

export interface ClaudeProcessorConfig extends ProcessorConfig {}

export interface OpenAIProcessorConfig extends ProcessorConfig {}

export interface OpenAITranscriberConfig extends ProcessorConfig {}

export interface LocalWhisperConfig {
  apiUrl?: string;
}

export interface ConversionResult {
  blob: Blob;
  extension: string;
}

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

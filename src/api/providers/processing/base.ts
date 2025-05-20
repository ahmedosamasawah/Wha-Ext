import type {
  ProcessorProvider,
  ApiKeyVerificationResult,
  ProcessedResult,
} from "$types/providers";

export const createBaseProcessor = (): ProcessorProvider => ({
  verifyApiKey: async (): Promise<ApiKeyVerificationResult> => {
    throw new Error("Function 'verifyApiKey' must be implemented");
  },

  processTranscription: async (): Promise<ProcessedResult> => {
    throw new Error("Function 'processTranscription' must be implemented");
  },
});

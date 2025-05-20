import type {
  TranscriberProvider,
  ApiKeyVerificationResult,
} from "$types/providers";

export const createBaseTranscriber = (): TranscriberProvider => ({
  verifyApiKey: async (): Promise<ApiKeyVerificationResult> => {
    throw new Error("Function 'verifyApiKey' must be implemented");
  },

  transcribeAudio: async (): Promise<string> => {
    throw new Error("Function 'transcribeAudio' must be implemented");
  },
});

import { ProcessedResult } from "./providers";

export interface TranscriptionData {
  transcript: string;
  cleaned: string;
  summary: string;
  reply: string;
}

export interface TranscriptionModalProps {
  data?: TranscriptionData;
  show?: boolean;
  loading?: boolean;
  close?: () => void;
}

export interface Tab {
  id: keyof TranscriptionData;
  label: string;
}

export interface TranscribeButtonProps {
  playBtn: HTMLElement;
  bubbleId: string;
  show?: (detail: ShowDetail) => void;
  transcribe?: (detail: TranscribeDetail) => void;
}

export interface TranscribeDetail {
  bubbleId: string;
  playBtn: HTMLElement;
}

export interface ShowDetail {
  data: TranscriptionData;
  bubbleId: string;
}

export function processedResultToTranscriptionData(
  result: ProcessedResult & { summary?: string; reply?: string }
): TranscriptionData {
  return {
    transcript: result.original,
    cleaned: result.processed,
    summary: result.summary || "",
    reply: result.reply || "",
  };
}

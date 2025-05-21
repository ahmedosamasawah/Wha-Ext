import {
  getDefaultProcessor,
  getDefaultTranscriber,
  getSupportedProcessors,
  getSupportedTranscribers,
} from "$api/index";

import {
  get,
  derived,
  writable,
  type Writable,
  type Readable,
} from "svelte/store";

import * as storageService from "./storageService";
import type { TranscriptionData } from "$types/components";

interface Language {
  id: string;
  name: string;
}

interface Provider {
  id: string;
  name: string;
  category: string;
}

export interface Settings {
  language: string;
  promptTemplate: string;
  processingApiKey: string;
  transcriptionApiKey: string;
  isExtensionEnabled: boolean;
  processingModel: string;
  transcriptionModel: string;
  localWhisperUrl: string;
  ollamaServerUrl?: string;
  processingProviderType: string;
  transcriptionProviderType: string;
}

interface Status {
  isApiKeyConfigured: boolean;
  isExtensionEnabled: boolean;
  pendingTranscriptions: number;
  lastError: string | null;
}

interface StatusTextResult {
  text: string;
  type: "error" | "warning" | "pending" | "success";
}

export const supportedLanguages: Language[] = [
  { id: "auto", name: "Auto-detect" },
  { id: "en", name: "English" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "it", name: "Italian" },
  { id: "ar", name: "Arabic" },
];

export const DEFAULT_SETTINGS: Settings = {
  language: "auto",
  promptTemplate: "",
  processingApiKey: "",
  transcriptionApiKey: "",
  isExtensionEnabled: true,
  processingModel: "gpt-4o",
  transcriptionModel: "whisper-1",
  localWhisperUrl: "http://localhost:9000",
  ollamaServerUrl: "http://localhost:11434",
  processingProviderType: getDefaultProcessor(),
  transcriptionProviderType: getDefaultTranscriber(),
};

export const availableTranscriptionProviders: Writable<Provider[]> = writable(
  getSupportedTranscribers().map((id: string) => ({
    id,
    name:
      id === "localWhisper"
        ? "Local Whisper Server"
        : id.charAt(0).toUpperCase() + id.slice(1),
    category: "transcription",
  }))
);

export const availableProcessingProviders: Writable<Provider[]> = writable(
  getSupportedProcessors().map((id: string) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    category: "processing",
  }))
);

const settings: Writable<Settings> = writable({ ...DEFAULT_SETTINGS });
const status: Writable<Status> = writable({
  isApiKeyConfigured: false,
  isExtensionEnabled: true,
  pendingTranscriptions: 0,
  lastError: null,
});

export const transcriptionCache: Writable<Map<string, TranscriptionData>> =
  writable(new Map());

export async function initialize(): Promise<void> {
  try {
    const storedTranscriptions = await storageService.get(
      "wa-transcriptions",
      "indexedDB"
    );

    if (storedTranscriptions && typeof storedTranscriptions === "object") {
      const transcriptionMap = new Map<string, TranscriptionData>();

      Object.entries(storedTranscriptions).forEach(([key, value]) => {
        if (value && typeof value === "object") {
          const valueAsAny = value as any;

          const typedValue: TranscriptionData = {
            transcript: String(valueAsAny.transcript || ""),
            cleaned: String(valueAsAny.cleaned || ""),
            summary: String(valueAsAny.summary || ""),
            reply: String(valueAsAny.reply || ""),
          };
          transcriptionMap.set(key, typedValue);
        }
      });

      transcriptionCache.set(transcriptionMap);
    }

    const storedSettings = await storageService.getAll("sync");

    const transcriptionApiKey =
      storedSettings.transcriptionApiKey ||
      (await storageService.get("transcriptionApiKey", "local")) ||
      (await storageService.get("transcriptionApiKey", "sync")) ||
      "";

    const processingApiKey =
      storedSettings.processingApiKey ||
      (await storageService.get("processingApiKey", "local")) ||
      (await storageService.get("processingApiKey", "sync")) ||
      "";

    settings.set({
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      transcriptionApiKey,
      processingApiKey,
    });

    updateStatus({
      isApiKeyConfigured: !!(transcriptionApiKey || processingApiKey),
      isExtensionEnabled: storedSettings.isExtensionEnabled !== false,
    });

    setupSettingsPersistence();

    try {
      await chrome.runtime.sendMessage({ action: "settingsUpdated" });
    } catch (err) {
      console.log(
        "Failed to notify about settings update, receivers may not be ready yet:",
        err
      );
    }
  } catch (error) {
    console.error("Error initializing settings:", error);
    settings.set({ ...DEFAULT_SETTINGS });
    updateStatus({
      isApiKeyConfigured: false,
      isExtensionEnabled: true,
    });
  }
}

function setupSettingsPersistence(): void {
  let previousSettings: Partial<Settings> = {};

  settings.subscribe(async (currentSettings) => {
    if (Object.keys(currentSettings).length === 0) return;

    const hasChanged = Object.entries(currentSettings).some(
      ([key, value]) => previousSettings[key as keyof Settings] !== value
    );

    if (!hasChanged && Object.keys(previousSettings).length > 0) return;

    previousSettings = { ...currentSettings };

    if (currentSettings.transcriptionApiKey) {
      await storageService.set(
        "transcriptionApiKey",
        currentSettings.transcriptionApiKey,
        ["local", "sync"]
      );
    }

    if (currentSettings.processingApiKey) {
      await storageService.set(
        "processingApiKey",
        currentSettings.processingApiKey,
        ["local", "sync"]
      );
    }

    for (const [key, value] of Object.entries(currentSettings))
      if (key !== "transcriptionApiKey" && key !== "processingApiKey")
        await storageService.set(key, value, "sync");
  });

  transcriptionCache.subscribe(async (cache) => {
    if (cache.size > 0) {
      const safeTranscriptions: Record<string, TranscriptionData> = {};

      cache.forEach((value, key) => {
        safeTranscriptions[key] = {
          transcript: String(value.transcript || ""),
          cleaned: String(value.cleaned || ""),
          summary: String(value.summary || ""),
          reply: String(value.reply || ""),
        };
      });

      await storageService.set(
        "wa-transcriptions",
        safeTranscriptions,
        "indexedDB"
      );
    }
  });
}

export function getSetting<T>(key: keyof Settings, defaultValue: T): T {
  return get(settings)[key] !== undefined
    ? (get(settings)[key] as unknown as T)
    : defaultValue;
}

export function getAllSettings(): Settings {
  return get(settings);
}

export async function updateSettings(
  updates: Partial<Settings>
): Promise<void> {
  settings.update((s) => ({ ...s, ...updates }));

  if (updates.transcriptionApiKey || updates.processingApiKey) {
    const currentSettings = get(settings);
    const isApiKeyConfigured = !!(
      currentSettings.transcriptionApiKey || currentSettings.processingApiKey
    );
    updateStatus({ isApiKeyConfigured });
  }

  try {
    await chrome.runtime.sendMessage({ action: "settingsUpdated" });
  } catch (err) {
    console.log(
      "Failed to notify about settings update, receivers may not be ready yet:",
      err
    );
  }
}

export async function resetSettings(): Promise<void> {
  await updateSettings(DEFAULT_SETTINGS);
}

export function updateStatus(updates: Partial<Status>): void {
  status.update((currentStatus) => {
    const newStatus = { ...currentStatus };

    if (updates.pendingTranscriptions !== undefined) {
      if (typeof updates.pendingTranscriptions === "boolean") {
        newStatus.pendingTranscriptions += updates.pendingTranscriptions
          ? 1
          : -1;
        if (newStatus.pendingTranscriptions < 0)
          newStatus.pendingTranscriptions = 0;
      } else newStatus.pendingTranscriptions = updates.pendingTranscriptions;
    }

    if (updates.lastError !== undefined)
      newStatus.lastError = updates.lastError;
    if (updates.isExtensionEnabled !== undefined)
      newStatus.isExtensionEnabled = updates.isExtensionEnabled;
    if (updates.isApiKeyConfigured !== undefined)
      newStatus.isApiKeyConfigured = updates.isApiKeyConfigured;

    return newStatus;
  });
}

export function getStatus(): Status {
  return get(status);
}

export const statusText: Readable<StatusTextResult> = derived(
  status,
  ($status): StatusTextResult => {
    if (!$status.isApiKeyConfigured)
      return { text: "API key not configured", type: "error" };
    if (!$status.isExtensionEnabled)
      return { text: "Extension disabled", type: "warning" };
    if ($status.lastError)
      return { text: "Error: " + $status.lastError, type: "error" };
    if ($status.pendingTranscriptions > 0)
      return { text: "Transcribing...", type: "pending" };

    return { text: "Ready", type: "success" };
  }
);

export async function cacheTranscription(
  id: string,
  data: TranscriptionData
): Promise<void> {
  try {
    const safeCopy: TranscriptionData = {
      transcript: String(data.transcript || ""),
      cleaned: String(data.cleaned || ""),
      summary: String(data.summary || ""),
      reply: String(data.reply || ""),
    };

    transcriptionCache.update((cache) => {
      cache.set(id, safeCopy);
      return cache;
    });
  } catch (error) {
    console.error("Error caching transcription:", error);
  }
}

export { settings, status };

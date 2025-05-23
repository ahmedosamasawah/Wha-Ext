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
  transcriptionProviderStatus: string | null;
  processingProviderStatus: string | null;
  lastRefreshed: Date | null;
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
  transcriptionProviderStatus: null,
  processingProviderStatus: null,
  lastRefreshed: null,
});

export const isInitialized: Writable<boolean> = writable(false);

export const transcriptionCache: Writable<Map<string, TranscriptionData>> =
  writable(new Map());

async function updateProviderStatuses(): Promise<void> {
  console.log("[settingsService] Updating provider statuses...");
  const currentSettings = get(settings);
  let tStatus: string | null = "Not Configured";
  let pStatus: string | null = "Not Configured";

  // Transcription Provider Status
  if (currentSettings.transcriptionProviderType === "openai") {
    tStatus = currentSettings.transcriptionApiKey
      ? "✅ OpenAI Ready"
      : "⚠️ OpenAI API Key Missing";
  } else if (currentSettings.transcriptionProviderType === "localWhisper") {
    // Placeholder: In a real scenario, you might ping localWhisperUrl
    tStatus = currentSettings.localWhisperUrl
      ? "✅ Local Whisper Ready"
      : "⚠️ Local Whisper URL Missing";
  }

  // Processing Provider Status
  if (currentSettings.processingProviderType === "openai") {
    pStatus = currentSettings.processingApiKey
      ? "✅ OpenAI Ready"
      : "⚠️ OpenAI API Key Missing";
  } else if (currentSettings.processingProviderType === "claude") {
    pStatus = currentSettings.processingApiKey
      ? "✅ Claude Ready"
      : "⚠️ Claude API Key Missing";
  } else if (currentSettings.processingProviderType === "ollama") {
    // Placeholder: In a real scenario, you might ping ollamaServerUrl
    pStatus = currentSettings.ollamaServerUrl
      ? "✅ Ollama Ready"
      : "⚠️ Ollama URL Missing";
  } else if (currentSettings.processingProviderType === "none") {
    pStatus = "✅ Processing Disabled";
  }

  const isApiKeyConfigured =
    (currentSettings.transcriptionProviderType === "openai" &&
      !!currentSettings.transcriptionApiKey) ||
    (currentSettings.processingProviderType === "openai" &&
      !!currentSettings.processingApiKey) ||
    (currentSettings.processingProviderType === "claude" &&
      !!currentSettings.processingApiKey) ||
    currentSettings.transcriptionProviderType === "localWhisper" || // Assuming local doesn't need a key in this context
    currentSettings.processingProviderType === "ollama"; // Assuming local doesn't need a key

  status.update((s) => ({
    ...s,
    transcriptionProviderStatus: tStatus,
    processingProviderStatus: pStatus,
    isApiKeyConfigured, // Update the general API key status
    lastRefreshed: new Date(),
  }));
  console.log("[settingsService] Provider statuses updated:", get(status));
}

export async function initialize(): Promise<void> {
  console.log("[settingsService] Initializing...");
  isInitialized.set(false);
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

    const storedSettingsObj = await storageService.get("settings", "sync");
    console.log(
      "[settingsService] Stored settings object from sync:",
      storedSettingsObj
    );

    const combinedSettings = {
      ...DEFAULT_SETTINGS,
      ...(storedSettingsObj || {}), // Ensure storedSettingsObj is an object
    };

    // API keys are still managed separately for potential multi-storage (local/sync)
    // This part prioritizes keys from the 'settings' object if present, then specific storage.
    combinedSettings.transcriptionApiKey =
      storedSettingsObj?.transcriptionApiKey ||
      (await storageService.get("transcriptionApiKey", "local")) ||
      (await storageService.get("transcriptionApiKey", "sync")) ||
      DEFAULT_SETTINGS.transcriptionApiKey;

    combinedSettings.processingApiKey =
      storedSettingsObj?.processingApiKey ||
      (await storageService.get("processingApiKey", "local")) ||
      (await storageService.get("processingApiKey", "sync")) ||
      DEFAULT_SETTINGS.processingApiKey;

    settings.set(combinedSettings);
    console.log("[settingsService] Initial settings merged:", get(settings));

    // Update status based on the just loaded settings
    updateStatus({
      isExtensionEnabled: combinedSettings.isExtensionEnabled !== false,
    });
    await updateProviderStatuses(); // This will also update isApiKeyConfigured

    setupSettingsPersistence();
    setupStorageListener();

    isInitialized.set(true);
    console.log("[settingsService] Initialization complete.");

    try {
      // Notify other parts of the extension that settings are initialized and potentially updated
      await chrome.runtime.sendMessage({ action: "settingsInitialized" });
      console.log("[settingsService] Sent 'settingsInitialized' message.");
    } catch (err) {
      console.warn(
        "[settingsService] Failed to send 'settingsInitialized' message, receivers may not be ready:",
        err
      );
    }
  } catch (error) {
    console.error("[settingsService] Error during initialization:", error);
    settings.set({ ...DEFAULT_SETTINGS }); // Fallback to defaults
    updateStatus({
      // Reset status on error
      isApiKeyConfigured: false,
      isExtensionEnabled: true,
      transcriptionProviderStatus: "Error during init",
      processingProviderStatus: "Error during init",
      lastError: "Initialization failed",
    });
    isInitialized.set(true); // Still set to true to allow UI to proceed, albeit with defaults/errors
  }
}

function setupSettingsPersistence(): void {
  let previousSettings: Partial<Settings> = { ...get(settings) }; // Initialize with current settings

  settings.subscribe(async (currentSettings) => {
    if (Object.keys(currentSettings).length === 0 || !get(isInitialized)) {
      // Avoid persisting empty or during non-initialization phase if needed,
      // though typically settings are initialized with defaults first.
      return;
    }

    const changedKeys = Object.keys(currentSettings).filter(
      (key) =>
        currentSettings[key as keyof Settings] !==
        previousSettings[key as keyof Settings]
    );

    if (changedKeys.length === 0 && Object.keys(previousSettings).length > 0) {
      console.log(
        "[settingsService] No settings changed, skipping persistence."
      );
      return;
    }

    console.log(
      "[settingsService] Settings changed, persisting:",
      changedKeys.join(", ")
    );
    previousSettings = { ...currentSettings };

    // Separate handling for API keys to potentially store them in 'local' as well for security/preference
    if (currentSettings.transcriptionApiKey !== undefined) {
      // Check for undefined to allow empty string
      await storageService.set(
        "transcriptionApiKey",
        currentSettings.transcriptionApiKey,
        ["local", "sync"] // Save to both, sync will be part of the main 'settings' object too
      );
    }

    if (currentSettings.processingApiKey !== undefined) {
      await storageService.set(
        "processingApiKey",
        currentSettings.processingApiKey,
        ["local", "sync"]
      );
    }

    // Create a settings object for chrome.storage.sync, excluding API keys if they are handled separately
    // or including them if we want them in the main 'settings' blob as well.
    // For simplicity and to ensure they are part of the 'settings' object read by other contexts, include them.
    const settingsToSync = { ...currentSettings };

    // No, we want the main settings object to be the single source of truth in sync
    // API keys will also be there. The individual writes above are for 'local' primarily.
    // So, we will ensure that the settingsToSync has the latest API keys from currentSettings.

    console.log(
      "[settingsService] Saving to chrome.storage.sync 'settings':",
      settingsToSync
    );
    const success = await storageService.set(
      "settings",
      settingsToSync,
      "sync"
    );
    if (success) {
      console.log(
        "[settingsService] Successfully saved 'settings' to sync storage."
      );
    } else {
      console.error(
        "[settingsService] Failed to save 'settings' to sync storage."
      );
    }

    // After successful save, it's good to notify others, but storage.onChanged should handle this.
    // However, explicit message can be useful for immediate UI updates if onChanged has latency.
    try {
      await chrome.runtime.sendMessage({
        action: "settingsUpdated",
        payload: settingsToSync,
      });
      console.log(
        "[settingsService] Sent 'settingsUpdated' message after persistence."
      );
    } catch (err) {
      console.warn(
        "[settingsService] Failed to send settingsUpdated message post-persistence:",
        err
      );
    }
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
      console.log(
        "[settingsService] Persisting transcription cache to IndexedDB..."
      );
      await storageService.set(
        "wa-transcriptions",
        safeTranscriptions,
        "indexedDB"
      );
      console.log("[settingsService] Transcription cache persisted.");
    }
  });
}

function setupStorageListener(): void {
  (chrome.storage as any).onChanged.addListener(
    (changes: any, areaName: string) => {
      console.log(
        `[settingsService] storage.onChanged event. Area: ${areaName}`,
        changes
      );
      if (areaName === "sync" && changes.settings?.newValue) {
        console.log(
          "[settingsService] 'settings' changed in sync storage. Updating local store.",
          changes.settings.newValue
        );
        const newSettings = changes.settings.newValue as Settings;
        settings.set(newSettings); // Update the Svelte store with the new settings
        updateProviderStatuses(); // Re-evaluate provider statuses based on new settings
        // Potentially update other parts of the status store if needed
        updateStatus({
          isExtensionEnabled: newSettings.isExtensionEnabled !== false,
        });
        console.log(
          "[settingsService] Local settings store and statuses updated from storage.onChanged."
        );
      } else if (
        areaName === "sync" &&
        (changes.transcriptionApiKey || changes.processingApiKey)
      ) {
        // If API keys are changed directly in sync (e.g. by older version or other direct manipulation)
        console.log(
          "[settingsService] API key changed directly in sync storage. Re-evaluating."
        );
        settings.update((s) => ({
          ...s,
          transcriptionApiKey:
            changes.transcriptionApiKey?.newValue ?? s.transcriptionApiKey,
          processingApiKey:
            changes.processingApiKey?.newValue ?? s.processingApiKey,
        }));
        updateProviderStatuses();
      }
      // We might also want to listen for 'local' changes if API keys stored there are primary
    }
  );
  console.log("[settingsService] Storage listener set up.");
}

export function getSetting<T>(key: keyof Settings, defaultValue: T): T {
  const current = get(settings)[key];
  return current !== undefined ? (current as unknown as T) : defaultValue;
}

export function getAllSettings(): Settings {
  return get(settings);
}

export async function updateSettings(
  updates: Partial<Settings>
): Promise<void> {
  console.log("[settingsService] updateSettings called with:", updates);
  settings.update((s) => ({ ...s, ...updates }));

  // The settings.subscribe in setupSettingsPersistence will handle saving to chrome.storage.
  // We need to ensure provider statuses are updated after the Svelte store is updated.
  await updateProviderStatuses(); // Update statuses based on new settings

  // isApiKeyConfigured is now handled by updateProviderStatuses
  // if (updates.transcriptionApiKey || updates.processingApiKey) {
  //   const currentSettings = get(settings);
  //   const isApiKeyConfigured = !!(
  //     currentSettings.transcriptionApiKey || currentSettings.processingApiKey
  //   );
  //   updateStatus({ isApiKeyConfigured });
  // }

  // Message sending is now part of setupSettingsPersistence after successful save.
  // try {
  //   await chrome.runtime.sendMessage({ action: "settingsUpdated", payload: get(settings) });
  //   console.log("[settingsService] Sent 'settingsUpdated' message from updateSettings.");
  // } catch (err) {
  //   console.warn(
  //     "[settingsService] Failed to notify about settings update from updateSettings:",
  //     err
  //   );
  // }
  console.log(
    "[settingsService] updateSettings finished. Current settings:",
    get(settings)
  );
}

export async function resetSettings(): Promise<void> {
  console.log("[settingsService] Resetting settings to default...");
  // updateSettings will trigger persistence and status updates
  await updateSettings(DEFAULT_SETTINGS);
  console.log("[settingsService] Settings reset complete.");
}

export function updateStatus(updates: Partial<Status>): void {
  status.update((currentStatus) => {
    const newStatus = { ...currentStatus, ...updates }; // Apply general updates first

    // Specific logic for pendingTranscriptions
    if (updates.pendingTranscriptions !== undefined) {
      if (typeof updates.pendingTranscriptions === "boolean") {
        // true for increment, false for decrement
        newStatus.pendingTranscriptions += updates.pendingTranscriptions
          ? 1
          : -1;
        if (newStatus.pendingTranscriptions < 0) {
          newStatus.pendingTranscriptions = 0;
        }
      } else {
        // direct number assignment
        newStatus.pendingTranscriptions = updates.pendingTranscriptions;
      }
    }
    console.log("[settingsService] Status updated:", newStatus);
    return newStatus;
  });
}

export function getStatus(): Status {
  return get(status);
}

export const statusText: Readable<StatusTextResult> = derived(
  [settings, status], // Depend on both settings and status
  ([$settings, $status]): StatusTextResult => {
    // Priority 1: Critical configuration issues from provider statuses
    if (
      $status.transcriptionProviderStatus &&
      $status.transcriptionProviderStatus.startsWith("⚠️")
    ) {
      return { text: $status.transcriptionProviderStatus, type: "error" };
    }
    if (
      $status.processingProviderStatus &&
      $status.processingProviderStatus.startsWith("⚠️")
    ) {
      // Don't show processing error if it's disabled
      if ($settings.processingProviderType !== "none") {
        return { text: $status.processingProviderStatus, type: "error" };
      }
    }

    // General isApiKeyConfigured can be a fallback or used if provider statuses are null
    // if (!$status.isApiKeyConfigured && ($settings.transcriptionProviderType === 'openai' || $settings.processingProviderType === 'openai')) {
    //   return { text: "API key not configured for OpenAI", type: "error" };
    // }

    if (!$status.isExtensionEnabled) {
      return { text: "Extension disabled", type: "warning" };
    }
    if ($status.lastError) {
      return { text: "Error: " + $status.lastError, type: "error" };
    }
    if ($status.pendingTranscriptions > 0) {
      return {
        text: `Transcribing (${$status.pendingTranscriptions})...`,
        type: "pending",
      };
    }

    // If no errors or pending tasks, check if providers are ready
    let readyMessage = "Ready";
    const tReady = $status.transcriptionProviderStatus?.startsWith("✅");
    const pReadyOrDisabled =
      $status.processingProviderStatus?.startsWith("✅") ||
      $settings.processingProviderType === "none";

    if (tReady && pReadyOrDisabled) {
      readyMessage = "✅ All systems go!";
      if ($settings.processingProviderType === "none") {
        readyMessage = "✅ Transcription ready (Processing disabled)";
      }
      return { text: readyMessage, type: "success" };
    } else if (!tReady && $settings.transcriptionProviderType !== "none") {
      return { text: "Transcription provider not ready", type: "warning" };
    } else if (
      !pReadyOrDisabled &&
      $settings.processingProviderType !== "none"
    ) {
      return { text: "Processing provider not ready", type: "warning" };
    }

    return { text: "Ready", type: "success" }; // Default ready state
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
    console.log(`[settingsService] Cached transcription for ID: ${id}`);
  } catch (error) {
    console.error("[settingsService] Error caching transcription:", error);
  }
}

export { settings, status };

<script lang="ts">
  import {
    status,
    statusText,
    initialize,
    updateStatus,
    isInitialized,
    settings,
    supportedLanguages,
  } from "$services/settingsService";
  import type { ModelOption, ProviderModels } from "$types/providers";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardHeader, CardContent } from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";

  let isEnabled = $state(true);
  let currentSettings = $derived($settings);

  const providerModels = $state<ProviderModels>({
    openai: {
      processing: [
        { id: "gpt-4.1", name: "GPT-4.1" },
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o-mini" },
      ],
      transcription: [
        { id: "whisper-1", name: "Whisper-1" },
        { id: "gpt-4o", name: "GPT-4o (Transcription)" },
      ],
    },
    claude: {
      processing: [
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
      ],
      transcription: [],
    },
    ollama: {
      processing: [
        { id: "ollama3", name: "Llama 3 (Default)" },
        { id: "codellama", name: "CodeLlama" },
      ],
      transcription: [],
    },
    localWhisper: {
      processing: [],
      transcription: [],
    },
  });

  function getModelsForProvider(
    providerType: string | undefined,
    category: "processing" | "transcription"
  ): ModelOption[] {
    if (!providerType || !providerModels[providerType]) return [];
    return providerModels[providerType][category] || [];
  }

  function getProcessingModels(): ModelOption[] {
    const providerType = currentSettings.processingProviderType;
    return getModelsForProvider(providerType, "processing");
  }

  function getTranscriptionModels(): ModelOption[] {
    const providerType = currentSettings.transcriptionProviderType;
    if (providerType === "localWhisper") return [];
    return getModelsForProvider(providerType, "transcription");
  }

  let selectedLanguageLabel = $derived(
    supportedLanguages.find((l) => l.id === currentSettings.language)?.name ??
      "N/A"
  );

  let transcriptionModelDisplay = $derived(
    getTranscriptionModels().find(
      (m) => m.id === currentSettings.transcriptionModel
    )?.name ??
      (currentSettings.transcriptionProviderType === "localWhisper"
        ? "Default (Local Whisper)"
        : currentSettings.transcriptionModel || "N/A")
  );
  let processingModelDisplay = $derived(
    getProcessingModels().find((m) => m.id === currentSettings.processingModel)
      ?.name ??
      (currentSettings.processingModel || "N/A")
  );

  (async () => {
    await initialize();
    status.subscribe((currentStatus) => {
      isEnabled = currentStatus.isExtensionEnabled;
    });
  })();

  function openOptions() {
    browser.tabs.create({
      url: browser.runtime.getURL("/onboarding.html"),
    });
  }

  function toggleExtension() {
    const newStatus = !isEnabled;

    isEnabled = newStatus;
    updateStatus({
      isExtensionEnabled: isEnabled,
    });

    chrome.runtime.sendMessage({
      action: "settingsUpdated",
    });
  }
</script>

{#if $isInitialized}
  <main class="w-80 font-sans p-4 text-gray-800">
    <header class="mb-4 pb-3 border-b border-gray-200">
      <h1 class="text-lg font-semibold text-[#00a884] m-0">
        WhatsApp AI Transcriber
      </h1>
    </header>

    <Card class="mb-4">
      <CardHeader>
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium text-sm">Status:</span>
          <span
            class={[
              "flex items-center text-sm",
              $statusText.type === "error" && "text-red-500",
              $statusText.type === "warning" && "text-yellow-600",
              $statusText.type === "success" && "text-green-600",
            ]}
            dir="auto"
          >
            <span
              class={[
                "inline-block w-2.5 h-2.5 rounded-full mr-1.5",
                $statusText.type === "error" && "bg-red-500",
                $statusText.type === "warning" && "bg-yellow-600",
                $statusText.type === "success" && "bg-green-600",
              ]}
              aria-hidden="true"
            ></span>
            {$statusText.text}
          </span>
        </div>

        {#if $status.lastError && $status.lastError.includes("API key has reached its usage limit")}
          <div
            class="bg-yellow-50 border border-yellow-200 rounded-md p-2 mb-3 text-xs text-yellow-800"
          >
            <p class="m-0">
              Your OpenAI API key has reached its usage limit. You need to:
            </p>
            <ul class="pl-4 mt-1.5 mb-0">
              <li>Check your OpenAI account billing</li>
              <li>Update payment method or add credits</li>
              <li>Or use a different API key</li>
            </ul>
          </div>
        {/if}

        <div class="flex justify-between items-center">
          <span class="font-medium text-sm">Extension:</span>
          <button
            type="button"
            class={[
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
              isEnabled ? "bg-[#00a884]" : "bg-gray-300",
            ]}
            onclick={toggleExtension}
            role="switch"
            aria-checked={isEnabled}
          >
            <span class="sr-only">Enable extension</span>
            <span
              class={[
                "inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ease-in-out",
                isEnabled ? "-translate-x-[8px]" : "translate-x-[13px]",
              ]}
              aria-hidden="true"
            ></span>
          </button>
        </div>
      </CardHeader>
    </Card>

    <Card class="mb-4">
      <CardHeader>
        <h2 class="text-md font-semibold text-gray-700 m-0">
          Current Settings
        </h2>
      </CardHeader>
      <CardContent class="text-sm space-y-2 pt-3">
        <div class="flex justify-between items-center">
          <Label class="text-gray-600">Language:</Label>
          <span class="font-medium text-gray-800">{selectedLanguageLabel}</span>
        </div>
        <div class="flex justify-between items-center">
          <Label class="text-gray-600">Transcription Model:</Label>
          <span class="font-medium text-gray-800"
            >{transcriptionModelDisplay}</span
          >
        </div>
        <div class="flex justify-between items-center">
          <Label class="text-gray-600">Processing Model:</Label>
          <span class="font-medium text-gray-800">{processingModelDisplay}</span
          >
        </div>
      </CardContent>
    </Card>

    <section class="mb-4">
      <Button
        variant="default"
        class="w-full bg-[#00a884] hover:bg-[#008f72] text-white"
        onclick={openOptions}
      >
        Open Settings
      </Button>
    </section>

    <footer class="text-xs leading-relaxed text-gray-600">
      <p class="my-2" dir="auto">
        This extension transcribes WhatsApp voice messages using AI and
        provides:
      </p>
      <ul class="my-2 pl-5">
        <li class="mb-1" dir="auto">Raw transcription</li>
        <li class="mb-1" dir="auto">Cleaned version</li>
        <li class="mb-1" dir="auto">Brief summary</li>
        <li class="mb-1" dir="auto">Suggested reply</li>
      </ul>
      <p class="my-2" dir="auto">
        Click the "Transcribe" button next to voice messages to process them.
      </p>
    </footer>
  </main>
{:else}
  <div class="w-80 p-4 text-center font-sans text-gray-600">
    Loading settings...
  </div>
{/if}

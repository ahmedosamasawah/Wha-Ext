<script lang="ts">
  import {
    settings,
    initialize,
    updateSettings,
    supportedLanguages,
    availableProcessingProviders,
    availableTranscriptionProviders,
  } from "$services/settingsService";

  import { getDefaultProcessor, getDefaultTranscriber } from "$api/index";

  import { defaultTemplates } from "$utils/template";
  import { verifyApiKey as verifyApiKeyService } from "$services/transcriptionService";
  import type {
    Provider,
    ModelOption,
    ProviderModels,
    VerificationStatus,
    SettingsSavedStatus,
  } from "$types/providers";

  let transcriptionProviders = $state<Provider[]>([]);
  let processingProviders = $state<Provider[]>([]);

  let processingApiKey = $state("");
  let transcriptionApiKey = $state("");
  let localWhisperUrl = $state("http://localhost:9000");
  let ollamaServerUrl = $state("http://localhost:11434");

  let language = $state("auto");
  let promptTemplate = $state("");
  let isExtensionEnabled = $state(true);
  let processingModel = $state("gpt-4o");
  let transcriptionModel = $state("whisper-1");
  let processingProviderType = $state(getDefaultProcessor());
  let transcriptionProviderType = $state(getDefaultTranscriber());

  let settingsSaved = $state<SettingsSavedStatus | null>(null);
  let isVerifyingProcessing = $state(false);
  let isVerifyingTranscription = $state(false);
  let processingVerificationStatus = $state<VerificationStatus | null>(null);
  let transcriptionVerificationStatus = $state<VerificationStatus | null>(null);

  const providerModels = $state<ProviderModels>({
    openai: {
      processing: [
        { id: "gpt-4.1", name: "GPT-4.1" },
        { id: "gpt-4o", name: "GPT-4o" },
        { id: "gpt-4o-mini", name: "GPT-4o-mini" },
      ],
      transcription: [
        { id: "whisper-1", name: "Whisper-1" },
        { id: "gpt-4o-transcribe", name: "GPT-4o Transcribe" },
      ],
    },
    claude: {
      processing: [
        {
          id: "claude-3-7-sonnet-20250219",
          name: "Claude 3.7 Sonnet (Recommended)",
        },
        { id: "claude-3-5-sonnet-20240620", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Fastest)" },
      ],
      transcription: [],
    },
    ollama: {
      processing: [{ id: "llama3.2:latest", name: "Llama 3.2" }],
      transcription: [],
    },
  });

  function getProcessingModels(): ModelOption[] {
    return providerModels[processingProviderType]?.processing || [];
  }

  function getTranscriptionModels(): ModelOption[] {
    return providerModels[transcriptionProviderType]?.transcription || [];
  }

  $effect(() => {
    if (!settings || Object.keys(settings).length === 0) return;

    processingApiKey = "";
    processingVerificationStatus = null;

    const models = getProcessingModels();
    if (models.length > 0) processingModel = models[0].id;
    else processingModel = "";

    resetPromptTemplate();
  });

  $effect(() => {
    if (!settings || Object.keys(settings).length === 0) return;

    transcriptionApiKey = "";
    transcriptionVerificationStatus = null;

    const models = getTranscriptionModels();
    if (models.length > 0) transcriptionModel = models[0].id;
    else transcriptionModel = "whisper-1";
  });

  (async () => {
    await initialize();

    const unsubscribeTranscriptionProviders =
      availableTranscriptionProviders.subscribe((providers) => {
        transcriptionProviders = providers;
      });

    const unsubscribeProcessingProviders =
      availableProcessingProviders.subscribe((providers) => {
        processingProviders = providers;
      });

    const unsubscribeSettings = settings.subscribe((value) => {
      if (Object.keys(value).length === 0) return;

      language = value.language || "auto";
      promptTemplate = value.promptTemplate || "";
      processingModel = value.processingModel || "gpt-4o";
      transcriptionModel = value.transcriptionModel || "whisper-1";
      isExtensionEnabled = value.isExtensionEnabled !== false;
      localWhisperUrl = value.localWhisperUrl || "http://localhost:9000";
      ollamaServerUrl = value.ollamaServerUrl || "http://localhost:11434";

      transcriptionProviderType =
        value.transcriptionProviderType || getDefaultTranscriber();

      processingProviderType =
        value.processingProviderType || getDefaultProcessor();

      processingApiKey = value.processingApiKey || "";
      transcriptionApiKey = value.transcriptionApiKey || "";
    });

    return () => {
      unsubscribeSettings();
      unsubscribeTranscriptionProviders();
      unsubscribeProcessingProviders();
    };
  })();

  function resetPromptTemplate() {
    promptTemplate =
      defaultTemplates[processingProviderType]?.processing ||
      defaultTemplates.openai.processing;
  }

  async function verifyTranscriptionApiKey() {
    if (!transcriptionApiKey) {
      transcriptionVerificationStatus = {
        valid: false,
        message: "API key cannot be empty",
      };
      return;
    }

    isVerifyingTranscription = true;
    transcriptionVerificationStatus = null;

    try {
      const result = await verifyApiKeyService(
        transcriptionApiKey,
        transcriptionProviderType,
        "transcription"
      );

      if (result.valid) {
        transcriptionVerificationStatus = {
          valid: true,
          message: "API key verified successfully!",
        };

        updateSettings({ transcriptionApiKey });
      } else {
        transcriptionVerificationStatus = {
          valid: false,
          message: result.error || "Invalid API key",
        };
      }
    } catch (error: unknown) {
      transcriptionVerificationStatus = {
        valid: false,
        message:
          error instanceof Error ? error.message : "Error verifying API key",
      };
    } finally {
      isVerifyingTranscription = false;
    }
  }

  async function verifyProcessingApiKey() {
    if (processingProviderType === "ollama") {
      isVerifyingProcessing = true;
      processingVerificationStatus = null;

      try {
        const result = await verifyApiKeyService(
          "",
          processingProviderType,
          "processing"
        );

        if (result.valid) {
          processingVerificationStatus = {
            valid: true,
            message: "Ollama server connection verified successfully!",
          };
        } else {
          processingVerificationStatus = {
            valid: false,
            message: result.error || "Failed to connect to Ollama server",
          };
        }
      } catch (error: unknown) {
        processingVerificationStatus = {
          valid: false,
          message:
            error instanceof Error
              ? error.message
              : "Error verifying Ollama server connection",
        };
      } finally {
        isVerifyingProcessing = false;
      }
      return;
    }

    if (!processingApiKey) {
      processingVerificationStatus = {
        valid: false,
        message: "API key cannot be empty",
      };
      return;
    }

    isVerifyingProcessing = true;
    processingVerificationStatus = null;

    try {
      const result = await verifyApiKeyService(
        processingApiKey,
        processingProviderType,
        "processing"
      );

      if (result.valid) {
        processingVerificationStatus = {
          valid: true,
          message: "API key verified successfully!",
        };

        updateSettings({ processingApiKey });
      } else {
        processingVerificationStatus = {
          valid: false,
          message: result.error || "Invalid API key",
        };
      }
    } catch (error: unknown) {
      processingVerificationStatus = {
        valid: false,
        message:
          error instanceof Error ? error.message : "Error verifying API key",
      };
    } finally {
      isVerifyingProcessing = false;
    }
  }

  async function verifyLocalWhisperServer() {
    isVerifyingTranscription = true;
    transcriptionVerificationStatus = null;

    try {
      const result = await verifyApiKeyService(
        "",
        "localWhisper",
        "transcription",
        {
          localWhisperUrl,
        }
      );

      if (result.valid) {
        transcriptionVerificationStatus = {
          valid: true,
          message: "Successfully connected to Local Whisper server!",
        };

        updateSettings({ localWhisperUrl });
      } else {
        transcriptionVerificationStatus = {
          valid: false,
          message: result.error || "Failed to connect to Local Whisper server",
        };
      }
    } catch (error: unknown) {
      transcriptionVerificationStatus = {
        valid: false,
        message:
          error instanceof Error
            ? error.message
            : "Error connecting to Local Whisper server",
      };
    } finally {
      isVerifyingTranscription = false;
    }
  }

  function saveSettings() {
    updateSettings({
      transcriptionProviderType,
      processingProviderType,
      transcriptionApiKey,
      transcriptionModel,
      isExtensionEnabled,
      processingApiKey,
      processingModel,
      promptTemplate,
      language,
      localWhisperUrl,
      ollamaServerUrl,
    });

    settingsSaved = {
      success: true,
      message: "Settings saved successfully!",
    };

    setTimeout(() => (settingsSaved = null), 3000);
  }
</script>

<main class={["p-6 max-w-3xl mx-auto font-sans"]}>
  <header class={["mb-8"]}>
    <h1 class={["text-2xl font-bold text-[#128c7e] mb-2"]}>
      WhatsApp AI Transcriber Settings
    </h1>
    <p class={["text-gray-600"]}>
      Configure your WhatsApp transcription settings and AI providers.
    </p>
  </header>

  <section class={["mb-8 p-6 bg-white rounded-lg shadow-md"]}>
    <h2 class={["text-xl font-semibold mb-4 text-gray-800"]}>
      API Configuration
    </h2>

    <p class={["mb-4 text-sm text-gray-600"]}>
      Configure separate API keys for each provider or use the same key for
      both.
    </p>
  </section>

  <section class={["mb-8 p-6 bg-white rounded-lg shadow-md"]}>
    <h2 class={["text-xl font-semibold mb-4 text-gray-800"]}>
      Transcription Provider
    </h2>

    <div class={["mb-4"]}>
      <label
        for="transcriptionProvider"
        class={["block text-sm font-medium text-gray-700 mb-1"]}
      >
        Transcription Provider
      </label>
      <select
        id="transcriptionProvider"
        bind:value={transcriptionProviderType}
        class={[
          "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
        ]}
      >
        {#each transcriptionProviders as provider}
          <option value={provider.id}>{provider.name}</option>
        {/each}
      </select>
      <p class={["mt-1 text-xs text-gray-500"]}>
        Provider used for converting voice messages to text.
      </p>
    </div>

    {#if transcriptionProviderType !== "localWhisper"}
      <div class={["mb-4"]}>
        <label
          for="transcriptionApiKey"
          class={["block text-sm font-medium text-gray-700 mb-1"]}
        >
          Transcription API Key
        </label>
        <div class={["flex"]}>
          <input
            id="transcriptionApiKey"
            type="password"
            placeholder={`Enter ${transcriptionProviderType} API key`}
            bind:value={transcriptionApiKey}
            class={[
              "flex-1 p-2 border border-gray-300 rounded-l-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
            ]}
          />
          <button
            onclick={verifyTranscriptionApiKey}
            disabled={isVerifyingTranscription}
            class={[
              "bg-[#00a884] text-white px-4 py-2 rounded-r-md hover:bg-[#008f72] focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:ring-offset-2 disabled:opacity-50",
            ]}
            type="button"
          >
            {isVerifyingTranscription ? "Verifying..." : "Verify"}
          </button>
        </div>

        {#if transcriptionVerificationStatus}
          <p
            class={[
              "mt-2 text-sm break-words max-w-full overflow-hidden",
              transcriptionVerificationStatus.valid
                ? "text-green-600"
                : "text-red-600",
            ]}
          >
            {transcriptionVerificationStatus.message}
          </p>
        {/if}
      </div>
    {:else}
      <div class={["mb-4"]}>
        <label
          for="localWhisperUrl"
          class={["block text-sm font-medium text-gray-700 mb-1"]}
        >
          Local Whisper Server URL
        </label>
        <input
          id="localWhisperUrl"
          type="text"
          placeholder="http://localhost:9000"
          bind:value={localWhisperUrl}
          class={[
            "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
          ]}
        />
        <p class={["mt-1 text-xs text-gray-500"]}>
          URL of your local Whisper server (default: http://localhost:9000)
        </p>
        <div class={["mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md"]}>
          <p class={["text-xs text-blue-800"]}>
            <strong>Local Server Setup:</strong> You need to run a local Whisper
            server using whisper.cpp.
          </p>
        </div>
        <button
          onclick={() => verifyLocalWhisperServer()}
          disabled={isVerifyingTranscription}
          class={[
            "mt-2 bg-[#00a884] text-white px-4 py-2 rounded-md hover:bg-[#008f72] focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:ring-offset-2 disabled:opacity-50",
          ]}
          type="button"
        >
          {isVerifyingTranscription
            ? "Checking Connection..."
            : "Check Connection"}
        </button>

        {#if transcriptionVerificationStatus}
          <p
            class={[
              "mt-2 text-sm break-words max-w-full overflow-hidden",
              transcriptionVerificationStatus.valid
                ? "text-green-600"
                : "text-red-600",
            ]}
          >
            {transcriptionVerificationStatus.message}
          </p>
        {/if}
      </div>
    {/if}

    {#if transcriptionProviderType !== "localWhisper"}
      <div class={["mb-4"]}>
        <label
          for="transcriptionModel"
          class={["block text-sm font-medium text-gray-700 mb-1"]}
        >
          Transcription Model
        </label>
        <select
          id="transcriptionModel"
          bind:value={transcriptionModel}
          class={[
            "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
          ]}
          disabled={transcriptionProviderType === "localWhisper"}
        >
          {#each getTranscriptionModels() as model}
            <option value={model.id}>{model.name}</option>
          {/each}
          {#if getTranscriptionModels().length === 0 && transcriptionProviderType !== "localWhisper"}
            <option value="whisper-1">Whisper-1</option>
          {/if}
          {#if transcriptionProviderType === "localWhisper"}
            <option value="local-whisper">Local Whisper Model</option>
          {/if}
        </select>
      </div>
    {/if}
  </section>

  <section class={["mb-8 p-6 bg-white rounded-lg shadow-md"]}>
    <h2 class={["text-xl font-semibold mb-4 text-gray-800"]}>
      Processing Provider
    </h2>

    <div class={["mb-4"]}>
      <label
        for="processingProvider"
        class={["block text-sm font-medium text-gray-700 mb-1"]}
      >
        Processing Provider
      </label>
      <select
        id="processingProvider"
        bind:value={processingProviderType}
        class={[
          "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
        ]}
      >
        {#each processingProviders as provider}
          <option value={provider.id}>{provider.name}</option>
        {/each}
      </select>
      <p class={["mt-1 text-xs text-gray-500"]}>
        Provider used for cleaning, summarizing and generating replies.
      </p>
    </div>

    <div class={["mb-4"]}>
      <label
        for={processingProviderType === "ollama"
          ? "ollamaServerUrl"
          : "processingApiKey"}
        class={["block text-sm font-medium text-gray-700 mb-1"]}
      >
        {processingProviderType === "ollama"
          ? "Ollama Server"
          : "Processing API Key"}
      </label>
      <div class={["flex"]}>
        {#if processingProviderType === "ollama"}
          <input
            id="ollamaServerUrl"
            type="text"
            placeholder="http://localhost:11434"
            bind:value={ollamaServerUrl}
            readonly={true}
            class={[
              "flex-1 p-2 border border-gray-300 rounded-l-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884] bg-gray-100",
            ]}
          />
        {:else}
          <input
            id="processingApiKey"
            type="password"
            placeholder={`Enter ${processingProviderType} API key`}
            bind:value={processingApiKey}
            class={[
              "flex-1 p-2 border border-gray-300 rounded-l-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
            ]}
          />
        {/if}
        <button
          onclick={verifyProcessingApiKey}
          disabled={isVerifyingProcessing}
          class="bg-[#00a884] text-white px-4 py-2 rounded-r-md hover:bg-[#008f72] focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:ring-offset-2 disabled:opacity-50"
          type="button"
        >
          {isVerifyingProcessing ? "Verifying..." : "Verify"}
        </button>
      </div>

      {#if processingVerificationStatus}
        <p
          class={[
            "mt-2 text-sm break-words max-w-full overflow-hidden",
            processingVerificationStatus.valid
              ? "text-green-600"
              : "text-red-600",
          ]}
        >
          {processingVerificationStatus.message}
        </p>
      {/if}

      {#if processingProviderType === "ollama"}
        <p class={["mt-1 text-xs text-gray-500"]}>
          Ollama is a local LLM server. Make sure it's running with the
          OLLAMA_ORIGINS environment variable set to allow this extension.
        </p>
      {/if}
    </div>

    <div class={["mb-4"]}>
      <label
        for="processingModel"
        class={["block text-sm font-medium text-gray-700 mb-1"]}
      >
        Processing Model
      </label>
      <select
        id="processingModel"
        bind:value={processingModel}
        class={[
          "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
        ]}
      >
        {#each getProcessingModels() as model}
          <option value={model.id}>{model.name}</option>
        {/each}
      </select>
      <p class={["mt-1 text-xs text-gray-500"]}>
        The specific model used for text processing (depends on selected
        provider).
      </p>
    </div>

    <div class={["mb-4"]}>
      <div class={["flex justify-between items-center mb-1"]}>
        <label
          for="promptTemplate"
          class={["block text-sm font-medium text-gray-700"]}
        >
          Prompt Template
        </label>
        <button
          onclick={resetPromptTemplate}
          class={["text-xs text-[#00a884] hover:text-[#008f72] underline"]}
          type="button"
        >
          Reset to default
        </button>
      </div>
      <textarea
        id="promptTemplate"
        bind:value={promptTemplate}
        rows="8"
        class={[
          "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884] font-mono text-sm",
        ]}
        placeholder="Enter your custom prompt template"
      ></textarea>
      <p class={["mt-1 text-xs text-gray-500"]}>
        Customize how the AI processes your transcriptions. Use double curly
        braces around "transcription" and "language" to use them as variables.
      </p>
    </div>
  </section>

  <section class={["mb-8 p-6 bg-white rounded-lg shadow-md"]}>
    <h2 class={["text-xl font-semibold mb-4 text-gray-800"]}>
      General Settings
    </h2>

    <div class={["mb-4"]}>
      <label
        for="language"
        class={["block text-sm font-medium text-gray-700 mb-1"]}
      >
        Language
      </label>
      <select
        id="language"
        bind:value={language}
        class={[
          "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#00a884] focus:border-[#00a884]",
        ]}
      >
        {#each supportedLanguages as lang}
          <option value={lang.id}>{lang.name}</option>
        {/each}
      </select>
      <p class={["mt-1 text-xs text-gray-500"]}>
        Default language for transcription. Auto-detect will try to identify the
        language automatically.
      </p>
    </div>

    <div class={["mb-4"]}>
      <div class={["flex items-center justify-between"]}>
        <label
          for="extension-enabled"
          class={["text-sm font-medium text-gray-700"]}
        >
          Enable Extension
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={isExtensionEnabled}
          id="extension-enabled"
          class={[
            "relative inline-flex flex-shrink-0 h-6 w-11 border-2 items-center border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00a884]",
            isExtensionEnabled ? "bg-[#00a884]" : "bg-gray-200",
          ]}
          onclick={() => (isExtensionEnabled = !isExtensionEnabled)}
        >
          <span class="sr-only">Use setting</span>
          <span
            aria-hidden="true"
            class={[
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200",
              isExtensionEnabled ? "translate-x-[13px]" : "-translate-x-[9px]",
            ]}
          ></span>
        </button>
      </div>
      <p class={["mt-1 text-xs text-gray-500"]}>
        Turn the extension on or off without uninstalling.
      </p>
    </div>
  </section>

  <div class={["flex justify-end"]}>
    <button
      onclick={saveSettings}
      class={[
        "bg-[#00a884] text-white px-6 py-2 rounded-md hover:bg-[#008f72] focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:ring-offset-2",
      ]}
      type="button"
    >
      Save Settings
    </button>
  </div>

  {#if settingsSaved}
    <div class={["mt-4 p-3 bg-green-100 text-green-800 rounded-md"]}>
      {settingsSaved.message}
    </div>
  {/if}
</main>

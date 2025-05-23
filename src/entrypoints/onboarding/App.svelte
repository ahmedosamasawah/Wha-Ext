<script lang="ts">
  import "../../app.pcss";
  import { get } from "svelte/store";

  import {
    status,
    settings,
    initialize,
    statusText,
    isInitialized,
    updateSettings,
    DEFAULT_SETTINGS,
    supportedLanguages,
    availableProcessingProviders,
    availableTranscriptionProviders,
  } from "$services/settingsService";

  import {
    verifyLocalWhisperServer,
    verifyApiKey as verifyApiKeyService,
  } from "$services/transcriptionService";

  import type {
    Provider,
    ModelOption,
    ProviderModels,
    VerificationStatus,
    SettingsSavedStatus,
  } from "$types/providers";
  import { defaultTemplates } from "$utils/template";
  import { getDefaultProcessor, getDefaultTranscriber } from "$api/index";
  import type { Settings as AppSettings } from "$services/settingsService";
  import type { ApiKeyVerificationResult } from "$services/transcriptionService";

  import { Toaster, toast } from "svelte-sonner";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Select from "$lib/components/ui/select";
  import { Switch } from "$lib/components/ui/switch";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Alert from "$lib/components/ui/alert";
  import { Progress } from "$lib/components/ui/progress";

  import {
    Mic,
    Check,
    Brain,
    ArrowLeft,
    ArrowRight,
    LoaderCircle,
    Settings as SettingsIcon,
  } from "@lucide/svelte";

  let processingProviders = $state<Provider[]>([]);
  let transcriptionProviders = $state<Provider[]>([]);

  let language = $state(DEFAULT_SETTINGS.language);
  let promptTemplate = $state(DEFAULT_SETTINGS.promptTemplate);
  let processingApiKey = $state(DEFAULT_SETTINGS.processingApiKey);
  let transcriptionApiKey = $state(DEFAULT_SETTINGS.transcriptionApiKey);
  let isExtensionEnabled = $state(DEFAULT_SETTINGS.isExtensionEnabled);
  let processingModel = $state(DEFAULT_SETTINGS.processingModel || "");
  let transcriptionModel = $state(DEFAULT_SETTINGS.transcriptionModel || "");
  let localWhisperUrl = $state(DEFAULT_SETTINGS.localWhisperUrl);
  let ollamaServerUrl = $state(
    DEFAULT_SETTINGS.ollamaServerUrl || "http://localhost:11434"
  );
  let processingProviderType = $state(DEFAULT_SETTINGS.processingProviderType);
  let transcriptionProviderType = $state(
    DEFAULT_SETTINGS.transcriptionProviderType
  );

  let isVerifyingProcessing = $state(false);
  let isVerifyingTranscription = $state(false);
  let settingsSaved = $state<SettingsSavedStatus | null>(null);
  let processingVerificationStatus = $state<VerificationStatus | null>(null);
  let transcriptionVerificationStatus = $state<VerificationStatus | null>(null);

  let currentStep = $state(1);
  const totalSteps = 4;

  const providerModels = $state<ProviderModels>({
    openai: {
      processing: [
        { id: "gpt-4.1", name: "GPT-4.1" },
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
      processing: [{ id: "llama3.2:latest", name: "Llama 3.2" }],
      transcription: [],
    },
    localWhisper: {
      processing: [],
      transcription: [],
    },
  });

  const selectedTranscriptionProviderLabel = $derived(
    transcriptionProviders.find((p) => p.id === transcriptionProviderType)
      ?.name ?? "Select a provider"
  );
  const selectedTranscriptionModelLabel = $derived(
    getTranscriptionModels().find((m) => m.id === transcriptionModel)?.name ??
      (transcriptionModel || "Select a model")
  );
  const selectedProcessingProviderLabel = $derived(
    processingProviders.find((p) => p.id === processingProviderType)?.name ??
      (processingProviderType === "none"
        ? "None (Disabled)"
        : "Select a provider")
  );
  const selectedProcessingModelLabel = $derived(
    getProcessingModels().find((m) => m.id === processingModel)?.name ??
      (processingModel || "Select a model")
  );
  const selectedLanguageLabel = $derived(
    supportedLanguages.find((l) => l.id === language)?.name ?? "Select language"
  );
  const progressPercentage = $derived((currentStep / totalSteps) * 100);

  function getModelsForProvider(
    providerType: string | undefined,
    category: "processing" | "transcription"
  ): ModelOption[] {
    if (!providerType || !providerModels[providerType]) return [];
    return providerModels[providerType][category] || [];
  }

  function getProcessingModels(): ModelOption[] {
    return getModelsForProvider(processingProviderType, "processing");
  }

  function getTranscriptionModels(): ModelOption[] {
    if (transcriptionProviderType === "localWhisper") return [];
    return getModelsForProvider(transcriptionProviderType, "transcription");
  }

  $effect(() => {
    if (!get(isInitialized)) return;
    const _currentProvider = processingProviderType;
    processingApiKey = "";
    processingVerificationStatus = null;
    updateSettings({ processingApiKey: "" });
    const models = getProcessingModels();
    const currentModelInSettings = get(settings).processingModel;
    if (models.length > 0) {
      if (
        !models.find((m) => m.id === currentModelInSettings) ||
        currentModelInSettings === DEFAULT_SETTINGS.processingModel
      ) {
        processingModel = models[0].id;
        updateSettings({ processingModel: models[0].id });
      }
    } else {
      processingModel = "";
      updateSettings({ processingModel: "" });
    }
    resetPromptTemplate();
  });

  $effect(() => {
    if (!get(isInitialized)) return;
    const _currentProvider = transcriptionProviderType;
    transcriptionApiKey = "";
    transcriptionVerificationStatus = null;
    updateSettings({ transcriptionApiKey: "" });
    const models = getTranscriptionModels();
    const currentModelInSettings = get(settings).transcriptionModel;
    if (models.length > 0) {
      if (
        !models.find((m) => m.id === currentModelInSettings) ||
        currentModelInSettings === DEFAULT_SETTINGS.transcriptionModel
      ) {
        transcriptionModel = models[0].id;
        updateSettings({ transcriptionModel: models[0].id });
      }
    } else if (transcriptionProviderType !== "localWhisper") {
      transcriptionModel = "";
      updateSettings({ transcriptionModel: "" });
    } else {
      transcriptionModel = DEFAULT_SETTINGS.transcriptionModel || "whisper-1";
      updateSettings({ transcriptionModel: transcriptionModel });
    }
  });

  (async () => {
    await initialize();
    const unsubSettings = settings.subscribe((val) => {
      if (!get(isInitialized) || Object.keys(val).length === 0) return;
      language = val.language;
      promptTemplate = val.promptTemplate;
      processingApiKey = val.processingApiKey;
      transcriptionApiKey = val.transcriptionApiKey;
      isExtensionEnabled = val.isExtensionEnabled;
      processingModel = val.processingModel || "";
      transcriptionModel = val.transcriptionModel || "";
      localWhisperUrl = val.localWhisperUrl;
      ollamaServerUrl = val.ollamaServerUrl || "http://localhost:11434";
      if (
        transcriptionProviders.length > 0 &&
        !transcriptionProviders.find(
          (p) => p.id === val.transcriptionProviderType
        )
      ) {
        transcriptionProviderType = getDefaultTranscriber();
      } else {
        transcriptionProviderType = val.transcriptionProviderType;
      }
      if (
        processingProviders.length > 0 &&
        !processingProviders.find((p) => p.id === val.processingProviderType)
      ) {
        processingProviderType = getDefaultProcessor();
      } else {
        processingProviderType = val.processingProviderType;
      }
    });

    const unsubTransProviders = availableTranscriptionProviders.subscribe(
      (val) => {
        transcriptionProviders = val;
        if (get(isInitialized)) {
          const currentSettings = get(settings);
          if (
            val.length > 0 &&
            currentSettings.transcriptionProviderType &&
            !val.find((p) => p.id === currentSettings.transcriptionProviderType)
          ) {
            transcriptionProviderType = getDefaultTranscriber();
          } else if (currentSettings.transcriptionProviderType) {
            transcriptionProviderType =
              currentSettings.transcriptionProviderType;
          }
        }
      }
    );

    const unsubProcProviders = availableProcessingProviders.subscribe((val) => {
      processingProviders = val;
      if (get(isInitialized)) {
        const currentSettings = get(settings);
        if (
          val.length > 0 &&
          currentSettings.processingProviderType &&
          !val.find((p) => p.id === currentSettings.processingProviderType)
        ) {
          processingProviderType = getDefaultProcessor();
        } else if (currentSettings.processingProviderType) {
          processingProviderType = currentSettings.processingProviderType;
        }
      }
    });

    return () => {
      unsubSettings();
      unsubTransProviders();
      unsubProcProviders();
    };
  })();

  function resetPromptTemplate() {
    const defaultTpl =
      (processingProviderType &&
        defaultTemplates[processingProviderType]?.processing) ||
      defaultTemplates.openai.processing;
    promptTemplate = defaultTpl;
    updateSettings({ promptTemplate: defaultTpl });
  }

  async function verifyTranscriptionApiKey() {
    if (!transcriptionProviderType) return;
    isVerifyingTranscription = true;
    transcriptionVerificationStatus = null;
    let opResult: ApiKeyVerificationResult;
    try {
      if (transcriptionProviderType === "localWhisper") {
        opResult = await verifyLocalWhisperServer({ localWhisperUrl });
        if (opResult.valid) updateSettings({ localWhisperUrl });
      } else if (transcriptionProviderType === "openai") {
        if (!transcriptionApiKey) {
          transcriptionVerificationStatus = {
            valid: false,
            message: "API Key is required for OpenAI.",
          };
          isVerifyingTranscription = false;
          toast.error("OpenAI API Key is required.");
          return;
        }
        opResult = await verifyApiKeyService(
          transcriptionApiKey,
          transcriptionProviderType,
          "transcription"
        );
        if (opResult.valid)
          updateSettings({ transcriptionApiKey, transcriptionProviderType });
      } else {
        opResult = {
          valid: false,
          error: "Verification not supported for this provider.",
        };
      }
      transcriptionVerificationStatus = {
        valid: opResult.valid,
        message: opResult.error || "Verified successfully!",
      };
      if (opResult.valid) {
        toast.success(transcriptionVerificationStatus.message);
        const settingsToUpdate: Partial<AppSettings> = {
          transcriptionProviderType,
        };
        if (transcriptionProviderType === "localWhisper")
          settingsToUpdate.localWhisperUrl = localWhisperUrl;
        else if (transcriptionProviderType === "openai")
          settingsToUpdate.transcriptionApiKey = transcriptionApiKey;
        await updateSettings(settingsToUpdate);
      } else {
        toast.error(opResult.error || "Verification failed.");
      }
    } catch (e: any) {
      toast.error(
        e.message || "An unexpected error occurred during verification."
      );
      transcriptionVerificationStatus = {
        valid: false,
        message: e.message || "Verification error.",
      };
    } finally {
      isVerifyingTranscription = false;
    }
  }

  async function verifyProcessingApiKey() {
    if (!processingProviderType || processingProviderType === "none") return;
    isVerifyingProcessing = true;
    processingVerificationStatus = null;
    let opResult: ApiKeyVerificationResult;
    try {
      if (processingProviderType === "ollama") {
        opResult = await verifyApiKeyService(
          "",
          processingProviderType,
          "processing",
          { ollamaServerUrl }
        );
        if (opResult.valid) updateSettings({ ollamaServerUrl });
      } else if (
        processingProviderType === "openai" ||
        processingProviderType === "claude"
      ) {
        if (!processingApiKey) {
          processingVerificationStatus = {
            valid: false,
            message: `API Key is required for ${processingProviderType}.`,
          };
          isVerifyingProcessing = false;
          toast.error(`API Key is required for ${processingProviderType}.`);
          return;
        }
        opResult = await verifyApiKeyService(
          processingApiKey,
          processingProviderType,
          "processing"
        );
        if (opResult.valid)
          updateSettings({ processingApiKey, processingProviderType });
      } else {
        opResult = {
          valid: false,
          error: "Verification not supported for this provider.",
        };
      }
      processingVerificationStatus = {
        valid: opResult.valid,
        message: opResult.error || "Verified successfully!",
      };
      if (opResult.valid) {
        toast.success(processingVerificationStatus.message);
        const settingsToUpdate: Partial<AppSettings> = {
          processingProviderType,
        };
        if (processingProviderType === "ollama")
          settingsToUpdate.ollamaServerUrl = ollamaServerUrl;
        else if (
          processingProviderType === "openai" ||
          processingProviderType === "claude"
        )
          settingsToUpdate.processingApiKey = processingApiKey;
        await updateSettings(settingsToUpdate);
      } else {
        toast.error(opResult.error || "Verification failed.");
      }
    } catch (e: any) {
      toast.error(
        e.message || "An unexpected error occurred during verification."
      );
      processingVerificationStatus = {
        valid: false,
        message: e.message || "Verification error.",
      };
    } finally {
      isVerifyingProcessing = false;
    }
  }

  async function saveSettingsAndContinue(nextStepNum: number) {
    let currentStepSettings: Partial<AppSettings> = {};
    if (currentStep === 1) {
      currentStepSettings = {
        transcriptionProviderType: transcriptionProviderType,
        transcriptionModel: transcriptionModel || "",
        transcriptionApiKey: transcriptionApiKey,
        localWhisperUrl: localWhisperUrl,
      };
    } else if (currentStep === 2) {
      currentStepSettings = {
        processingProviderType: processingProviderType,
        processingModel: processingModel || "",
        processingApiKey: processingApiKey,
        ollamaServerUrl: ollamaServerUrl,
        promptTemplate: promptTemplate,
      };
    } else if (currentStep === 3) {
      currentStepSettings = {
        language: language,
        isExtensionEnabled: isExtensionEnabled,
      };
    }
    if (Object.keys(currentStepSettings).length > 0) {
      await updateSettings(currentStepSettings);
    }
    toast.success(`Configuration for Step ${currentStep} saved.`);
    currentStep = nextStepNum;
  }

  function closeOnboarding() {
    if (chrome?.tabs) {
      (chrome.tabs as any).getCurrent((tab: any) => {
        if (tab?.id) {
          (chrome.tabs as any).remove(tab.id);
        } else {
          window.close();
        }
      });
    } else {
      window.close();
    }
  }

  $effect(() => {
    if (!get(isInitialized)) return;
    const _currentVal = promptTemplate;
    // updateSettings({ promptTemplate: _currentVal }); // Debounce or save on specific action
  });
</script>

<svelte:head>
  <title>Setup - WhatsApp AI Transcriber</title>
</svelte:head>

{#if $isInitialized}
  <Toaster richColors position="top-center" />
  <div class="container mx-auto max-w-3xl p-4 md:p-8 font-sans text-gray-800">
    <header class="mb-8 text-center">
      <h1 class="text-4xl font-bold text-[#00a884]">Welcome!</h1>
      <p class="text-lg text-gray-600 mt-2">
        Let\'s set up your WhatsApp AI Transcriber extension.
      </p>
      <Progress
        value={progressPercentage}
        class="w-full mt-6 max-w-md mx-auto"
      />
      <p class="text-sm text-gray-500 mt-2">
        Step {currentStep} of {totalSteps}
      </p>
    </header>

    <!-- Step 1: Transcription Settings -->
    {#if currentStep === 1}
      <Card.Root class="shadow-xl">
        <Card.Header class="border-b border-gray-200">
          <Card.Title class="text-2xl flex items-center text-gray-700">
            <Mic class="w-7 h-7 mr-3 text-[#00a884]" />
            Transcription Settings
          </Card.Title>
          <Card.Description class="text-gray-500 mt-1">
            Choose your preferred transcription provider and model.
          </Card.Description>
        </Card.Header>
        <Card.Content class="p-6 space-y-6">
          <div>
            <Label for="transcription-provider" class="text-md font-semibold"
              >Provider</Label
            >
            <Select.Root
              type="single"
              value={transcriptionProviderType}
              onValueChange={(v: string) => {
                if (v) {
                  transcriptionProviderType = v;
                  updateSettings({ transcriptionProviderType: v });
                  transcriptionApiKey = "";
                  transcriptionVerificationStatus = null;
                }
              }}
            >
              <Select.Trigger
                id="transcription-provider"
                class="w-full mt-1.5 h-11 text-md"
              >
                {selectedTranscriptionProviderLabel}
              </Select.Trigger>
              <Select.Content>
                {#each transcriptionProviders as provider}
                  <Select.Item value={provider.id} class="text-md">
                    {provider.name}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          {#if transcriptionProviderType === "openai"}
            <div>
              <Label for="transcription-api-key" class="text-md font-semibold"
                >OpenAI API Key</Label
              >
              <Input
                type="password"
                id="transcription-api-key"
                placeholder="Enter your OpenAI API key"
                bind:value={transcriptionApiKey}
                class="w-full mt-1.5 h-11 text-md"
              />
              <Button
                variant="outline"
                onclick={verifyTranscriptionApiKey}
                disabled={isVerifyingTranscription || !transcriptionApiKey}
                class="mt-3 w-full md:w-auto"
              >
                {#if isVerifyingTranscription}
                  <LoaderCircle class="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                {:else}
                  <Check class="w-4 h-4 mr-2" />
                  Verify & Save Key
                {/if}
              </Button>
              {#if transcriptionVerificationStatus}
                <Alert.Root
                  variant={transcriptionVerificationStatus.valid
                    ? "default"
                    : "destructive"}
                  class="mt-3"
                >
                  <Alert.Title class="font-semibold"
                    >Verification Status</Alert.Title
                  >
                  <Alert.Description>
                    {transcriptionVerificationStatus.message}
                  </Alert.Description>
                </Alert.Root>
              {/if}
              {#if $status.transcriptionProviderStatus && $status.transcriptionProviderStatus !== transcriptionVerificationStatus?.message}
                <p
                  class="mt-2 text-sm {$status.transcriptionProviderStatus?.startsWith(
                    '✅'
                  )
                    ? 'text-green-600'
                    : 'text-red-500'}"
                >
                  Current Saved Status: {$status.transcriptionProviderStatus}
                </p>
              {/if}
            </div>
          {/if}

          {#if transcriptionProviderType === "localWhisper"}
            <div>
              <Label for="local-whisper-url" class="text-md font-semibold"
                >Local Whisper Server URL</Label
              >
              <Input
                type="url"
                id="local-whisper-url"
                placeholder="http://localhost:9000"
                bind:value={localWhisperUrl}
                class="w-full mt-1.5 h-11 text-md"
              />
              <Button
                variant="outline"
                onclick={verifyTranscriptionApiKey}
                disabled={isVerifyingTranscription || !localWhisperUrl}
                class="mt-3 w-full md:w-auto"
              >
                {#if isVerifyingTranscription}
                  <LoaderCircle class="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                {:else}
                  <Check class="w-4 h-4 mr-2" />
                  Verify & Save URL
                {/if}
              </Button>
              {#if transcriptionVerificationStatus}
                <Alert.Root
                  variant={transcriptionVerificationStatus.valid
                    ? "default"
                    : "destructive"}
                  class="mt-3"
                >
                  <Alert.Title class="font-semibold"
                    >Verification Status</Alert.Title
                  >
                  <Alert.Description>
                    {transcriptionVerificationStatus.message}
                  </Alert.Description>
                </Alert.Root>
              {/if}
              {#if $status.transcriptionProviderStatus && $status.transcriptionProviderStatus !== transcriptionVerificationStatus?.message}
                <p
                  class="mt-2 text-sm {$status.transcriptionProviderStatus?.startsWith(
                    '✅'
                  )
                    ? 'text-green-600'
                    : 'text-red-500'}"
                >
                  Current Saved Status: {$status.transcriptionProviderStatus}
                </p>
              {/if}
            </div>
          {/if}

          {#if getTranscriptionModels().length > 0 && transcriptionProviderType !== "localWhisper"}
            <div>
              <Label for="transcription-model" class="text-md font-semibold"
                >Model</Label
              >
              <Select.Root
                type="single"
                value={transcriptionModel}
                onValueChange={(v: string) => {
                  if (v) {
                    transcriptionModel = v;
                    updateSettings({ transcriptionModel: v });
                  }
                }}
              >
                <Select.Trigger
                  id="transcription-model"
                  class="w-full mt-1.5 h-11 text-md"
                >
                  {selectedTranscriptionModelLabel}
                </Select.Trigger>
                <Select.Content>
                  {#each getTranscriptionModels() as model}
                    <Select.Item value={model.id} class="text-md">
                      {model.name}
                    </Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </div>
          {/if}
        </Card.Content>
        <Card.Footer class="flex justify-end p-6 border-t border-gray-200">
          <Button
            onclick={() => saveSettingsAndContinue(2)}
            class="text-md h-11"
          >
            Next <ArrowRight class="w-5 h-5 ml-2" />
          </Button>
        </Card.Footer>
      </Card.Root>

      <!-- Step 2: Processing Settings -->
    {:else if currentStep === 2}
      <Card.Root class="shadow-xl">
        <Card.Header class="border-b border-gray-200">
          <Card.Title class="text-2xl flex items-center text-gray-700">
            <Brain class="w-7 h-7 mr-3 text-[#00a884]" />
            Processing Settings
          </Card.Title>
          <Card.Description class="text-gray-500 mt-1">
            Configure how transcribed text is processed (e.g., summarization,
            cleaning).
          </Card.Description>
        </Card.Header>
        <Card.Content class="p-6 space-y-6">
          <div>
            <Label for="processing-provider" class="text-md font-semibold"
              >Provider</Label
            >
            <Select.Root
              type="single"
              value={processingProviderType}
              onValueChange={(v: string) => {
                if (v) {
                  processingProviderType = v;
                  processingApiKey = "";
                  processingVerificationStatus = null;

                  const newProviderModels = getModelsForProvider(
                    v,
                    "processing"
                  );
                  const newModel =
                    newProviderModels.length > 0 ? newProviderModels[0].id : "";
                  processingModel = newModel;

                  updateSettings({
                    processingProviderType: v,
                    processingApiKey: "",
                    processingModel: newModel,
                  });
                }
              }}
            >
              <Select.Trigger
                id="processing-provider"
                class="w-full mt-1.5 h-11 text-md"
              >
                {selectedProcessingProviderLabel}
              </Select.Trigger>
              <Select.Content>
                {#each processingProviders as provider}
                  <Select.Item value={provider.id} class="text-md">
                    {provider.name}
                  </Select.Item>
                {/each}
                <Select.Item value="none" class="text-md"
                  >None (Disable Processing)</Select.Item
                >
              </Select.Content>
            </Select.Root>
          </div>

          {#if processingProviderType && processingProviderType !== "none"}
            {#if processingProviderType === "openai" || processingProviderType === "claude"}
              <div>
                <Label for="processing-api-key" class="text-md font-semibold"
                  >{processingProviderType === "openai" ? "OpenAI" : "Claude"} API
                  Key</Label
                >
                <Input
                  type="password"
                  id="processing-api-key"
                  placeholder="Enter your API key"
                  bind:value={processingApiKey}
                  class="w-full mt-1.5 h-11 text-md"
                />
                <Button
                  variant="outline"
                  onclick={verifyProcessingApiKey}
                  disabled={isVerifyingProcessing || !processingApiKey}
                  class="mt-3 w-full md:w-auto"
                >
                  {#if isVerifyingProcessing}
                    <LoaderCircle class="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  {:else}
                    <Check class="w-4 h-4 mr-2" />
                    Verify & Save Key
                  {/if}
                </Button>
                {#if processingVerificationStatus}
                  <Alert.Root
                    variant={processingVerificationStatus.valid
                      ? "default"
                      : "destructive"}
                    class="mt-3"
                  >
                    <Alert.Title class="font-semibold"
                      >Verification Status</Alert.Title
                    >
                    <Alert.Description>
                      {processingVerificationStatus.message}
                    </Alert.Description>
                  </Alert.Root>
                {/if}
                {#if $status.processingProviderStatus && $status.processingProviderStatus !== processingVerificationStatus?.message}
                  <p
                    class="mt-2 text-sm {$status.processingProviderStatus?.startsWith(
                      '✅'
                    )
                      ? 'text-green-600'
                      : 'text-red-600'}"
                  >
                    Current Saved Status: {$status.processingProviderStatus}
                  </p>
                {/if}
              </div>
            {/if}

            {#if processingProviderType === "ollama"}
              <div>
                <Label for="ollama-server-url" class="text-md font-semibold"
                  >Ollama Server URL</Label
                >
                <Input
                  type="url"
                  id="ollama-server-url"
                  bind:value={ollamaServerUrl}
                  class="w-full mt-1.5 h-11 text-md"
                  placeholder="http://localhost:11434"
                />
                <Button
                  variant="outline"
                  onclick={verifyProcessingApiKey}
                  disabled={isVerifyingProcessing || !ollamaServerUrl}
                  class="mt-3 w-full md:w-auto"
                >
                  {#if isVerifyingProcessing}
                    <LoaderCircle class="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  {:else}
                    <Check class="w-4 h-4 mr-2" />
                    Verify & Save URL
                  {/if}
                </Button>
                {#if processingVerificationStatus}
                  <Alert.Root
                    variant={processingVerificationStatus.valid
                      ? "default"
                      : "destructive"}
                    class="mt-3"
                  >
                    <Alert.Title class="font-semibold"
                      >Verification Status</Alert.Title
                    >
                    <Alert.Description>
                      {processingVerificationStatus.message}
                    </Alert.Description>
                  </Alert.Root>
                {/if}
                {#if $status.processingProviderStatus && $status.processingProviderStatus !== processingVerificationStatus?.message}
                  <p
                    class="mt-2 text-sm {$status.processingProviderStatus?.startsWith(
                      '✅'
                    )
                      ? 'text-green-600'
                      : 'text-red-600'}"
                  >
                    Current Saved Status: {$status.processingProviderStatus}
                  </p>
                {/if}
              </div>
            {/if}

            {#if getProcessingModels().length > 0}
              <div>
                <Label for="processing-model" class="text-md font-semibold"
                  >Model</Label
                >
                <Select.Root
                  type="single"
                  value={processingModel}
                  onValueChange={(v: string) => {
                    if (v) {
                      processingModel = v;
                      updateSettings({ processingModel: v });
                    }
                  }}
                >
                  <Select.Trigger
                    id="processing-model"
                    class="w-full mt-1.5 h-11 text-md"
                  >
                    {selectedProcessingModelLabel}
                  </Select.Trigger>
                  <Select.Content>
                    {#each getProcessingModels() as model}
                      <Select.Item value={model.id} class="text-md">
                        {model.name}
                      </Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
            {/if}

            <div>
              <Label for="prompt-template" class="text-md font-semibold"
                >Prompt Template</Label
              >
              <Textarea
                id="prompt-template"
                placeholder="Enter your custom prompt or use default. Use &lbrace;transcript&rbrace; for original transcript."
                bind:value={promptTemplate}
                rows={5}
                class="w-full mt-1.5 text-md"
              />
              <Button
                variant="link"
                onclick={resetPromptTemplate}
                class="p-0 h-auto mt-1.5 text-[#00a884]"
                >Reset to default</Button
              >
            </div>
          {/if}

          {#if processingProviderType === "none"}
            <p class="text-gray-600 text-center py-4">
              Text processing is disabled.
            </p>
          {/if}
        </Card.Content>
        <Card.Footer class="flex justify-between p-6 border-t border-gray-200">
          <Button
            variant="outline"
            onclick={() => (currentStep = 1)}
            class="text-md h-11"
          >
            <ArrowLeft class="w-5 h-5 mr-2" /> Previous
          </Button>
          <Button
            onclick={() => saveSettingsAndContinue(3)}
            class="text-md h-11"
          >
            Next <ArrowRight class="w-5 h-5 ml-2" />
          </Button>
        </Card.Footer>
      </Card.Root>

      <!-- Step 3: General Settings -->
    {:else if currentStep === 3}
      <Card.Root class="shadow-xl">
        <Card.Header class="border-b border-gray-200">
          <Card.Title class="text-2xl flex items-center text-gray-700">
            <SettingsIcon class="w-7 h-7 mr-3 text-[#00a884]" />
            General Settings
          </Card.Title>
          <Card.Description class="text-gray-500 mt-1">
            Configure language and other preferences.
          </Card.Description>
        </Card.Header>
        <Card.Content class="p-6 space-y-6">
          <div>
            <Label for="language" class="text-md font-semibold"
              >Transcription Language</Label
            >
            <Select.Root
              type="single"
              value={language}
              onValueChange={(v: string) => {
                if (v) {
                  language = v;
                  updateSettings({ language: v });
                }
              }}
            >
              <Select.Trigger id="language" class="w-full mt-1.5 h-11 text-md">
                {selectedLanguageLabel}
              </Select.Trigger>
              <Select.Content>
                {#each supportedLanguages as lang}
                  <Select.Item value={lang.id} class="text-md">
                    {lang.name}
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            <p class="text-xs text-gray-500 mt-1.5">
              Select the primary language for your voice messages, or choose
              auto-detect.
            </p>
          </div>

          <div class="flex items-center justify-between pt-2">
            <Label
              for="extension-enabled"
              class="text-md font-semibold flex flex-col"
            >
              Enable Extension
              <span class="text-sm font-normal text-gray-500 mt-0.5">
                Toggle the extension on or off globally.
              </span>
            </Label>
            <Switch
              id="extension-enabled"
              checked={isExtensionEnabled}
              onCheckedChange={(checked: boolean) => {
                isExtensionEnabled = checked;
                updateSettings({ isExtensionEnabled: checked });
              }}
              class="data-[state=checked]:bg-[#00a884]"
            />
          </div>
        </Card.Content>
        <Card.Footer class="flex justify-between p-6 border-t border-gray-200">
          <Button
            variant="outline"
            onclick={() => (currentStep = 2)}
            class="text-md h-11"
          >
            <ArrowLeft class="w-5 h-5 mr-2" /> Previous
          </Button>
          <Button
            onclick={() => saveSettingsAndContinue(4)}
            class="text-md h-11"
          >
            Next <ArrowRight class="w-5 h-5 ml-2" />
          </Button>
        </Card.Footer>
      </Card.Root>

      <!-- Step 4: Finish -->
    {:else if currentStep === 4}
      <Card.Root class="shadow-xl text-center">
        <Card.Header>
          <Card.Title class="text-2xl text-gray-700">All Set!</Card.Title>
          <Card.Description class="text-gray-500 mt-1">
            You have successfully configured the extension.
            {#if $statusText.type !== "success" && $statusText.text !== "Ready" && !$statusText.text.startsWith("✅")}
              <span
                class="block mt-2 {$statusText.type === 'error'
                  ? 'text-red-600'
                  : 'text-yellow-600'}">Current Status: {$statusText.text}</span
              >
            {/if}
          </Card.Description>
        </Card.Header>
        <Card.Content class="p-6">
          <Check class="w-20 h-20 text-green-500 mx-auto mb-6" />
          <p class="text-gray-600 mb-6">
            You can change these settings anytime from the extension popup.
          </p>
          <Button
            onclick={closeOnboarding}
            class="w-full md:w-auto text-md h-11"
          >
            Finish & Close
          </Button>
        </Card.Content>
        <Card.Footer class="flex justify-start p-6 border-t border-gray-200">
          <Button
            variant="outline"
            onclick={() => (currentStep = 3)}
            class="text-md h-11"
          >
            <ArrowLeft class="w-5 h-5 mr-2" /> Previous
          </Button>
        </Card.Footer>
      </Card.Root>
    {/if}

    {#if settingsSaved}
      <div
        class="fixed bottom-5 right-5 p-4 rounded-lg shadow-md text-white animate-pulse-once {settingsSaved.success
          ? 'bg-green-500'
          : 'bg-red-500'}"
      >
        {settingsSaved.message}
      </div>
    {/if}
  </div>
{:else}
  <div
    class="flex items-center justify-center h-screen fixed inset-0 bg-white z-50"
  >
    <LoaderCircle class="w-12 h-12 text-[#00a884] animate-spin" />
    <p class="ml-4 text-lg text-gray-600">Loading settings, please wait...</p>
  </div>
{/if}

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
  }

  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>

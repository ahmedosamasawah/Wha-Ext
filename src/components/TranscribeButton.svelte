<script lang="ts">
  import type { TranscriptionData } from "$types/components";
  import { transcriptionCache } from "$services/settingsService";
  import { FileAudio, Check, Loader, AlertTriangle } from "@lucide/svelte";

  const {
    playBtn,
    bubbleId,
    show = undefined,
    transcribe = undefined,
  } = $props();

  let isError = $state(false);
  let isLoading = $state(false);
  let isTranscribed = $state(false);

  let iconSize = 18;

  $effect(() => {
    if (bubbleId && $transcriptionCache.has(bubbleId)) {
      const data = $transcriptionCache.get(bubbleId);
      if (data) {
        const hasError = data.transcript.startsWith("ERROR:");
        isTranscribed = !hasError;
        isError = hasError;
      }
    }
  });

  const handleClick = (): void => {
    if (isLoading) return;

    if (isTranscribed) {
      const data = $transcriptionCache.get(bubbleId);
      if (data && show) show({ data, bubbleId });
      return;
    }

    isLoading = true;
    isError = false;
    if (transcribe) transcribe({ bubbleId, playBtn });
  };

  export const setTranscribed = (data?: TranscriptionData): void => {
    isLoading = false;
    isTranscribed = true;
  };

  export const setError = (): void => {
    isLoading = false;
    isTranscribed = false;
    isError = true;
  };

  const getButtonClasses = (): string[] =>
    [
      "transcribe-button",
      isTranscribed && "transcribed",
      isLoading && "loading",
      isError && "error",
    ].filter(Boolean) as string[];
</script>

<button
  class={getButtonClasses()}
  onclick={handleClick}
  aria-label="Transcribe voice message"
  type="button"
>
  {#if isLoading}
    <Loader
      size={iconSize}
      strokeWidth={2.5}
      class="animate-spin"
      aria-hidden="true"
    />
  {:else if isTranscribed}
    <Check size={iconSize} strokeWidth={2.5} aria-hidden="true" />
  {:else if isError}
    <AlertTriangle size={iconSize} strokeWidth={2.5} aria-hidden="true" />
  {:else}
    <FileAudio size={iconSize} strokeWidth={2.5} aria-hidden="true" />
  {/if}
</button>

<style>
  .transcribe-button {
    padding: 6px;
    color: #ffffff;
    background-color: rgba(0, 168, 132, 0.85);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    position: absolute;
    bottom: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }

  :global(.transcribe-container) {
    position: relative;
  }

  :global([data-testid="audio-player"] .transcribe-container),
  :global(.audio-player .transcribe-container) {
    position: relative;
  }

  .transcribe-button:hover {
    background-color: rgba(0, 143, 114, 0.85);
    transform: translateY(-2px);
  }

  .transcribe-button:active {
    transform: translateY(1px);
  }

  .transcribe-button:disabled {
    opacity: 0.7;
    cursor: default;
    transform: none;
  }

  .transcribe-button.transcribed {
    background-color: rgba(76, 175, 80, 0.85);
  }

  .transcribe-button.loading {
    background-color: rgba(255, 160, 0, 0.85);
  }

  .transcribe-button.error {
    background-color: rgba(244, 67, 54, 0.85);
  }
</style>

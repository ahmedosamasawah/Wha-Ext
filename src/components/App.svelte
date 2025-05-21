<script lang="ts">
  import { mount } from "svelte";
  import TranscribeButton from "./TranscribeButton.svelte";
  import TranscriptionModal from "./TranscriptionModal.svelte";
  import { formatTranscriptionError } from "$utils/apiErrors";
  import { processVoiceMessage } from "$services/transcriptionService";
  import { processedResultToTranscriptionData } from "$types/components";

  import {
    initialize,
    transcriptionCache,
    cacheTranscription,
  } from "$services/settingsService";

  import type {
    ShowDetail,
    TranscribeDetail,
    TranscriptionData,
  } from "$types/components";

  (async () => await initialize())();

  const PLAY_BUTTON_SELECTORS = [
    'span[data-icon="audio-play"]',
    '[data-testid="audio-player"]',
    'button[aria-label="Play voice message"]',
    ".audio-player",
  ];

  let audioData = $state<Blob | null>(null);
  let buttons = $state<Map<string, any>>(new Map());
  let observer = $state<MutationObserver | null>(null);

  let showModal = $state<boolean>(false);
  let modalLoading = $state<boolean>(false);
  let modalData = $state<TranscriptionData>({
    transcript: "",
    cleaned: "",
    summary: "",
    reply: "",
  });

  let currentBubbleId = $state<string | null>(null);

  (async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    initializeButtons();
    setupMessageListener();

    observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.addedNodes.length > 0)) initializeButtons();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  })();

  function initializeButtons(): void {
    document
      .querySelectorAll(PLAY_BUTTON_SELECTORS.join(","))
      .forEach((playBtn) => {
        const bubble = playBtn.closest(
          ".message-out, ._amkz, ._amjy"
        ) as HTMLElement;
        if (!bubble || bubble.querySelector(".transcribe-button")) return;

        const parentElement = bubble.parentElement as HTMLElement;
        const whatsAppId = parentElement.dataset.id;
        bubble.dataset.transcriptionId = `wa-${whatsAppId}`;
        const bubbleId = bubble.dataset.transcriptionId as string;

        const component = mount(TranscribeButton, {
          target: bubble.children[1],
          props: {
            bubbleId,
            playBtn,
            transcribe: (detail: TranscribeDetail) => handleTranscribe(detail),
            show: (detail: ShowDetail) => showTranscription(detail),
          },
        });

        buttons.set(bubbleId, component);

        if ($transcriptionCache.has(bubbleId))
          component.setTranscribed($transcriptionCache.get(bubbleId));
      });
  }

  function setupMessageListener(): void {
    window.addEventListener("message", (e: MessageEvent) => {
      if (
        e.source !== window ||
        e.data?.source !== "WA_TRANSCRIBER" ||
        e.data.type !== "WA_AUDIO"
      )
        return;

      const blob = new Blob([new Uint8Array(e.data.data)], {
        type: e.data.mime,
      });

      audioData = blob;

      if (currentBubbleId && modalLoading) processAudio();
    });
  }

  async function handleTranscribe({
    bubbleId,
    playBtn,
  }: TranscribeDetail): Promise<void> {
    currentBubbleId = bubbleId;

    modalData = {
      transcript: "",
      cleaned: "",
      summary: "",
      reply: "",
    };

    modalLoading = true;
    showModal = true;

    const component = buttons.get(bubbleId);
    if (component) {
      component.isLoading = true;
      component.isError = false;
    }

    if ($transcriptionCache.has(bubbleId)) {
      const cachedData = $transcriptionCache.get(bubbleId);

      if (cachedData && !cachedData.transcript.startsWith("ERROR:")) {
        modalData = cachedData;
        modalLoading = false;

        if (component) {
          component.isLoading = false;
          component.isTranscribed = true;
        }

        return;
      }
    }

    audioData = null;
    playBtn.click();

    setTimeout(() => playBtn.click(), 200);

    if (audioData) processAudio();
  }

  async function processAudio(): Promise<void> {
    if (!audioData || !currentBubbleId) return;

    const blob = audioData;
    audioData = null;

    try {
      const result = await processVoiceMessage(blob);

      if (result.original.startsWith("ERROR")) {
        modalLoading = false;

        modalData = processedResultToTranscriptionData(result);

        const component = buttons.get(currentBubbleId);
        if (component) component.setError();

        await cacheTranscription(currentBubbleId, modalData);
        return;
      }

      modalData = processedResultToTranscriptionData(result);
      modalLoading = false;

      const component = buttons.get(currentBubbleId);
      if (component) component.setTranscribed(modalData);

      await cacheTranscription(currentBubbleId, modalData);
    } catch (error) {
      const errorResult = formatTranscriptionError(error as Error);

      modalData = processedResultToTranscriptionData(errorResult);
      modalLoading = false;

      const component = buttons.get(currentBubbleId);
      if (component) component.setError();

      await cacheTranscription(currentBubbleId, modalData);
    }
  }

  function showTranscription({ data, bubbleId }: ShowDetail): void {
    modalData = data;
    currentBubbleId = bubbleId;
    modalLoading = false;
    showModal = true;
  }

  function handleModalClose(): void {
    showModal = false;
    currentBubbleId = null;
  }
</script>

<TranscriptionModal
  data={modalData}
  show={showModal}
  loading={modalLoading}
  close={handleModalClose}
/>

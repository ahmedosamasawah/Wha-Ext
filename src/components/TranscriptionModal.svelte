<script lang="ts">
  import type { TranscriptionData, Tab } from "$types/components";

  const {
    data = {
      transcript: "",
      cleaned: "",
      summary: "",
      reply: "",
    },
    show = false,
    loading = false,
    close = () => {},
  } = $props();

  const tabs: Tab[] = [
    { id: "transcript", label: "Transcript" },
    { id: "cleaned", label: "Cleaned" },
    { id: "summary", label: "Summary" },
    { id: "reply", label: "Suggested Reply" },
  ];

  let copyTimeout = $state<number | null>(null);
  let activeTab = $state<keyof TranscriptionData>("transcript");
  let copyButtonText = $state<string>("Copy Text");
  let copyAllButtonText = $state<string>("Copy All");

  const setActiveTab = (tabId: keyof TranscriptionData): void => {
    activeTab = tabId;
  };

  const copyText = (text: string): void => {
    navigator.clipboard.writeText(text);
    copyButtonText = "Copied to clipboard!";
    resetCopyTimeout(() => (copyButtonText = "Copy Text"));
  };

  const copyAllText = (): void => {
    const allText = [
      `TRANSCRIPT:\n${data.transcript}`,
      `\nCLEANED:\n${data.cleaned}`,
      `\nSUMMARY:\n${data.summary}`,
      `\nSUGGESTED REPLY:\n${data.reply}`,
    ].join("\n");

    navigator.clipboard.writeText(allText);
    copyAllButtonText = "All copied!";
    resetCopyTimeout(() => (copyAllButtonText = "Copy All"));
  };

  const resetCopyTimeout = (callback: () => void): void => {
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(callback, 2000) as unknown as number;
  };

  const handleModalClick = (event: MouseEvent): void => {
    event.stopPropagation();
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  const handleModalKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") event.stopPropagation();
  };

  const isErrorState = (): boolean => data.transcript?.startsWith("ERROR:");

  const getTabButtonClass = (tabId: keyof TranscriptionData): string[] => [
    "flex-1 py-2.5 px-2 border-opacity-0 cursor-pointer transition-all flex flex-col items-center text-xs text-black",
    activeTab === tabId
      ? "border-b-[3px] border-[#00a884] text-[#00a884] font-medium bg-[#00a884]"
      : "hover:bg-gray-200 bg-white border-gray-200",
  ];

  const openOptionsPage = (): void => {
    chrome.runtime.sendMessage({ action: "openOptionsPage" });
    close();
  };

  const handleClose = (e: MouseEvent): void => close();
</script>

{#if show}
  <div
    class={["fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-fadeIn"]}
    onclick={handleClose}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onkeydown={handleKeydown}
  ></div>

  <div
    class={[
      "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-0 z-[1000] max-w-lg w-[90%] overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]",
    ]}
    onclick={handleModalClick}
    onkeydown={handleModalKeydown}
    tabindex="0"
    role="dialog"
    aria-labelledby="modal-title"
  >
    <header
      class={[
        "flex justify-between items-center p-4 bg-gray-100 border-b border-gray-200",
      ]}
    >
      <h2 class={["font-semibold text-[#128c7e] text-base"]} id="modal-title">
        Voice Message Transcription
      </h2>
      <button
        class={[
          "bg-white bg-opacity-0 border-none text-gray-500 text-lg cursor-pointer w-6 h-6 flex items-center justify-center rounded-full transition-all hover:bg-gray-200 hover:text-gray-700",
        ]}
        onclick={handleClose}>✕</button
      >
    </header>

    <nav class={["flex bg-gray-100 border-b border-gray-200"]}>
      {#each tabs as tab}
        <button
          class={getTabButtonClass(tab.id)}
          disabled={loading || !data[tab.id]}
          onclick={() => setActiveTab(tab.id)}
          aria-selected={activeTab === tab.id}
          role="tab"
          aria-controls={`panel-${tab.id}`}
        >
          <span>{tab.label}</span>
        </button>
      {/each}
    </nav>

    <main class={["p-5 overflow-y-auto max-h-[60vh] flex-grow"]}>
      {#if loading}
        <div class={["flex flex-col items-center justify-center py-10"]}>
          <div
            class={[
              "w-10 h-10 border-4 border-gray-200 border-t-[#00a884] rounded-full animate-spin mb-5",
            ]}
          ></div>
          <p class={["text-gray-500 text-sm"]}>Processing voice message...</p>
        </div>
      {:else if isErrorState()}
        <section class={["flex flex-col items-center justify-center py-5"]}>
          <div
            class={[
              "w-12 h-12 text-red-500 mb-3 flex items-center justify-center",
            ]}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class={["w-12 h-12"]}
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <p
            class={["text-red-500 font-medium text-center text-base mb-2"]}
            dir="auto"
          >
            {data.transcript.replace("ERROR: ", "")}
          </p>
          <p class={["text-gray-600 text-sm text-center"]} dir="auto">
            {data.cleaned}
          </p>

          {#if data.transcript.includes("API key has reached its usage limit")}
            <div class={["mt-6 text-center"]}>
              <button
                class={[
                  "bg-[#00a884] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#008f70] transition-colors",
                ]}
                onclick={openOptionsPage}
              >
                Update API Key
              </button>
            </div>
          {/if}
        </section>
      {:else}
        <div
          class={["leading-relaxed"]}
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          <p
            class={["m-0 whitespace-pre-wrap font-kitab"]}
            dir="auto"
            style="unicode-bidi: plaintext;"
          >
            {data[activeTab]}
          </p>
        </div>
      {/if}
    </main>

    <footer
      class={[
        "p-3 flex justify-end gap-2.5 border-t border-gray-200 bg-gray-100",
      ]}
    >
      {#if !loading}
        <button
          disabled={!data.transcript ||
            !data.cleaned ||
            !data.summary ||
            !data.reply}
          onclick={copyAllText}
          class={[
            "py-2 px-4 border-none rounded-full text-xs cursor-pointer transition-all font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed",
          ]}
        >
          {copyAllButtonText}
        </button>
        <button
          disabled={!data[activeTab]}
          onclick={() => copyText(data[activeTab])}
          class={[
            "py-2 px-4 border-none rounded-full text-xs cursor-pointer transition-all font-medium bg-[#00a884] text-white hover:bg-[#008f72] disabled:opacity-50 disabled:cursor-not-allowed",
          ]}
        >
          {copyButtonText}
        </button>
      {/if}
    </footer>
  </div>
{/if}

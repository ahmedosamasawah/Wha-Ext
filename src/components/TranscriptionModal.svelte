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

  const getTabButtonClass = (tabId: string): string => {
    const baseClass = "tab-button";
    return activeTab === tabId ? `${baseClass} active` : baseClass;
  };

  const openOptionsPage = (): void => {
    chrome.runtime.sendMessage({ action: "openOptionsPage" });
    close();
  };

  const handleClose = (e: MouseEvent): void => close();
</script>

{#if show}
  <div class="modal-root">
    <div
      class="modal-backdrop"
      onclick={handleClose}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onkeydown={handleKeydown}
    ></div>

    <div
      class="modal-container"
      onclick={handleModalClick}
      onkeydown={handleModalKeydown}
      tabindex="0"
      role="dialog"
      aria-labelledby="modal-title"
    >
      <header class="modal-header">
        <h2 class="modal-title" id="modal-title">
          Voice Message Transcription
        </h2>
        <button class="close-button" onclick={handleClose}>✕</button>
      </header>

      <nav class="tab-nav">
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

      <main class="modal-content">
        {#if loading}
          <div class="loading-container">
            <div class="spinner"></div>
            <p>Processing voice message...</p>
          </div>
        {:else if isErrorState()}
          <section class="error-container">
            <div class="error-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                width="48"
                height="48"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <p class="error-text" dir="auto">
              {data.transcript.replace("ERROR: ", "")}
            </p>
            <p class="error-details" dir="auto">
              {data.cleaned}
            </p>

            {#if data.transcript.includes("API key has reached its usage limit")}
              <div style="margin-top: 24px; text-align: center;">
                <button class="api-key-button" onclick={openOptionsPage}>
                  Update API Key
                </button>
              </div>
            {/if}
          </section>
        {:else}
          <div
            class="transcription-container"
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            <p
              class="transcription-text"
              dir="auto"
              style="unicode-bidi: plaintext;"
            >
              {data[activeTab]}
            </p>
          </div>
        {/if}
      </main>

      <footer class="modal-footer">
        {#if !loading}
          <button
            disabled={!data.transcript ||
              !data.cleaned ||
              !data.summary ||
              !data.reply}
            onclick={copyAllText}
            class="button-secondary"
          >
            {copyAllButtonText}
          </button>
          <button
            disabled={!data[activeTab]}
            onclick={() => copyText(data[activeTab])}
            class="button-primary"
          >
            {copyButtonText}
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  /* Reset styles to prevent WhatsApp styles from affecting our modal */
  .modal-root * {
    all: revert;
    box-sizing: border-box;
    font-family:
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    line-height: 1.5;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 9997;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out forwards;
  }

  .modal-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 0;
    z-index: 9999;
    max-width: 500px;
    width: 90%;
    overflow: hidden;
    animation: scaleIn 0.2s ease-out forwards;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background-color: #f8f8f8;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-title {
    font-weight: 600;
    color: #128c7e;
    font-size: 16px;
    margin: 0;
  }

  .close-button {
    background-color: transparent;
    border: none;
    color: #888;
    font-size: 20px;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .close-button:hover {
    background-color: #eee;
    color: #444;
  }

  .tab-nav {
    display: flex;
    background-color: #f8f8f8;
    border-bottom: 1px solid #e0e0e0;
  }

  .tab-button {
    flex: 1;
    padding: 10px 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 12px;
    color: black;
    background-color: white;
    border: none;
    border-bottom: 3px solid transparent;
  }

  .tab-button:hover {
    background-color: #f0f0f0;
  }

  .tab-button.active {
    border-bottom: 3px solid #00a884;
    color: #00a884;
    font-weight: 500;
    background-color: rgba(0, 168, 132, 0.08);
  }

  .tab-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-content {
    padding: 20px;
    overflow-y: auto;
    max-height: 60vh;
    flex-grow: 1;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #00a884;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
  }

  .error-icon {
    width: 48px;
    height: 48px;
    color: #e74c3c;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-text {
    color: #e74c3c;
    font-weight: 500;
    text-align: center;
    font-size: 16px;
    margin-bottom: 8px;
  }

  .error-details {
    color: #666;
    font-size: 14px;
    text-align: center;
  }

  .transcription-text {
    margin: 0;
    white-space: pre-wrap;
  }

  .modal-footer {
    padding: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    border-top: 1px solid #e0e0e0;
    background-color: #f8f8f8;
  }

  .button-secondary {
    padding: 8px 16px;
    border: none;
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    background-color: #e0e0e0;
    color: #333;
  }

  .button-secondary:hover {
    background-color: #d0d0d0;
  }

  .button-primary {
    padding: 8px 16px;
    border: none;
    border-radius: 999px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    background-color: #00a884;
    color: white;
  }

  .button-primary:hover {
    background-color: #008f72;
  }

  .button-primary:disabled,
  .button-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .api-key-button {
    background-color: #00a884;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .api-key-button:hover {
    background-color: #008f70;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      transform: translate(-50%, -50%) scale(0.95);
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>

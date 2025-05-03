(() => {
  const whisper_model = "whisper-1";

  const play_selectors = [
    'span[data-icon="audio-play"]',
    '[data-testid="audio-player"]',
    'button[aria-label="Play voice message"]',
    ".audio-player",
  ];

  const transcription_cache = new Map();
  let has_api_key = false;

  // Check if API key is configured
  function check_api_key() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["openai_api_key"], function (result) {
        has_api_key = !!result.openai_api_key;
        resolve(has_api_key);
      });
    });
  }

  function load_styles() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = chrome.runtime.getURL("styles.css");
    document.head.appendChild(link);
  }

  const ui_components = {
    create_transcribe_button(is_transcribed = false, bubble_id = null) {
      const btn = document.createElement("button");
      btn.className = "transcribe-button";

      if (is_transcribed) {
        btn.textContent = "✓";
        btn.dataset.transcribed = "true";
        if (bubble_id) {
          btn.dataset.bubbleId = bubble_id;
        }
      } else btn.textContent = "Transcribe";

      return btn;
    },

    show_transcription_popup(text, bubble_id = null) {
      const existing_overlay = document.querySelector(".overlay");
      const existing_popup = document.querySelector(".transcription-popup");

      if (existing_overlay) document.body.removeChild(existing_overlay);
      if (existing_popup) document.body.removeChild(existing_popup);

      const overlay = document.createElement("div");
      overlay.className = "overlay";

      const popup = document.createElement("div");
      popup.className = "transcription-popup";

      const header = document.createElement("div");
      header.className = "transcription-popup-header";

      const title = document.createElement("div");
      title.className = "transcription-popup-title";
      title.textContent = "Voice Message Transcription";

      const close_btn = document.createElement("button");
      close_btn.className = "transcription-popup-close";
      close_btn.textContent = "✕";
      close_btn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        document.body.removeChild(popup);
      });

      header.appendChild(title);
      header.appendChild(close_btn);

      const content = document.createElement("div");
      content.className = "transcription-popup-content";

      // Check if it's an API key error
      if (text.includes("API key not configured")) {
        content.innerHTML = `
          <p>${text}</p>
          <p>To configure your API key:</p>
          <ol>
            <li>Click on the extension icon in your browser toolbar</li>
            <li>Click "Open Settings"</li>
            <li>Enter your OpenAI API key and save</li>
          </ol>
          <p>Don't have an API key?</p>
          <ol>
            <li>Go to <a href="https://platform.openai.com/signup" target="_blank">OpenAI Platform</a> and create an account</li>
            <li>Navigate to <a href="https://platform.openai.com/api-keys" target="_blank">API Keys</a> in your dashboard</li>
            <li>Click "Create new secret key" and copy it</li>
          </ol>
        `;

        // Add "Configure API Key" button
        const configure_btn = document.createElement("button");
        configure_btn.className = "transcription-copy-button";
        configure_btn.textContent = "Configure API Key";
        configure_btn.style.backgroundColor = "#4285f4";
        configure_btn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ action: "openOptionsPage" });
        });

        const footer = document.createElement("div");
        footer.className = "transcription-popup-footer";
        footer.appendChild(configure_btn);

        popup.appendChild(header);
        popup.appendChild(content);
        popup.appendChild(footer);
      } else {
        content.textContent = text;

        const copy_btn = document.createElement("button");
        copy_btn.className = "transcription-copy-button";
        copy_btn.textContent = "Copy Text";
        copy_btn.addEventListener("click", () => {
          navigator.clipboard.writeText(text).then(() => {
            copy_btn.textContent = "Copied!";
            setTimeout(() => (copy_btn.textContent = "Copy Text"), 2000);
          });
        });

        // Don't show copy button for error messages
        const footer = document.createElement("div");
        footer.className = "transcription-popup-footer";
        if (!text.includes("⚠️")) {
          footer.appendChild(copy_btn);
        }

        popup.appendChild(header);
        popup.appendChild(content);
        popup.appendChild(footer);
      }

      document.body.appendChild(overlay);
      document.body.appendChild(popup);

      overlay.addEventListener("click", () => {
        document.body.removeChild(overlay);
        document.body.removeChild(popup);
      });

      if (bubble_id && text && !text.includes("⚠️"))
        transcription_cache.set(bubble_id, text);
    },
  };

  const audio_processor = {
    pending: [],

    async handle_click(bubble, play_btn, btn) {
      if (!bubble.dataset.transcriptionId) {
        bubble.dataset.transcriptionId = `bubble-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      const bubble_id = bubble.dataset.transcriptionId;

      if (
        btn.dataset.transcribed === "true" &&
        transcription_cache.has(bubble_id)
      ) {
        ui_components.show_transcription_popup(
          transcription_cache.get(bubble_id),
          bubble_id
        );
        return;
      }

      // Check for API key before proceeding
      const has_key = await check_api_key();
      if (!has_key) {
        ui_components.show_transcription_popup(
          "⚠️ API key not configured. Please set your OpenAI API key in the extension settings.",
          null
        );
        return;
      }

      if (btn.disabled) return;

      btn.disabled = true;
      btn.textContent = "⏳";
      this.pending.push({ bubble, btn, bubble_id });

      play_btn.click();
      setTimeout(() => play_btn.click(), 100);
    },

    async transcribe({ data, mime }) {
      // Get API key from storage
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(["openai_api_key"], resolve);
      });

      if (!result.openai_api_key) {
        throw new Error("API key not configured");
      }

      const blob = new Blob([new Uint8Array(data)], { type: mime });
      const form_data = new FormData();
      form_data.append("model", whisper_model);
      form_data.append("file", new File([blob], "voice.ogg", { type: mime }));

      const res = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${result.openai_api_key}` },
          body: form_data,
        }
      );

      if (!res.ok) throw new Error(await res.text());
      return (await res.json()).text;
    },
  };

  // Listen for changes to API key in storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.openai_api_key) {
      has_api_key = !!changes.openai_api_key.newValue;
    }
  });

  const dom_handler = {
    add_buttons() {
      document
        .querySelectorAll(play_selectors.join(","))
        .forEach((play_btn) => {
          const bubble = play_btn.closest(".message-out, ._amkz, ._amjy");
          if (!bubble || bubble.querySelector(".transcribe-button")) return;

          if (!bubble.dataset.transcriptionId) {
            bubble.dataset.transcriptionId = `bubble-${Date.now()}-${Math.random()
              .toString(36)
              .substr(2, 9)}`;
          }

          const bubble_id = bubble.dataset.transcriptionId;
          const is_transcribed = transcription_cache.has(bubble_id);

          const btn = ui_components.create_transcribe_button(
            is_transcribed,
            bubble_id
          );
          btn.addEventListener("click", () =>
            audio_processor.handle_click(bubble, play_btn, btn)
          );
          bubble.appendChild(btn);
        });
    },

    setup_message_listener() {
      window.addEventListener("message", (e) => {
        if (
          e.source !== window ||
          e.data?.source !== "WA_TRANSCRIBER" ||
          e.data.type !== "WA_AUDIO"
        )
          return;

        if (!audio_processor.pending.length) return;
        const { btn, bubble_id } = audio_processor.pending.shift();

        audio_processor
          .transcribe(e.data)
          .then((text) => {
            ui_components.show_transcription_popup(text, bubble_id);
            btn.textContent = "✓";
            btn.dataset.transcribed = "true";
            if (bubble_id) btn.dataset.bubbleId = bubble_id;
          })
          .catch(() => (btn.textContent = "⚠️"))
          .finally(() => (btn.disabled = false));
      });
    },

    init() {
      load_styles();
      check_api_key().then(() => {
        this.add_buttons();
        this.setup_message_listener();

        new MutationObserver((m) => {
          if (m.some((x) => x.addedNodes.length)) this.add_buttons();
        }).observe(document.body, { childList: true, subtree: true });
      });
    },
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", () => dom_handler.init())
    : dom_handler.init();
})();

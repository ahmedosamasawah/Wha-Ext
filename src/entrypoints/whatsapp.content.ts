import "../assets/app.css";
import { mount } from "svelte";
import App from "../components/App.svelte";
import { initialize, getAllSettings } from "../services/settingsService.js";

// Helper function to detect extension context invalidation
function isExtensionContextInvalidated(error: any): boolean {
  return (
    error?.message?.includes("Extension context invalidated") ||
    error?.message?.includes("context invalidated") ||
    !chrome?.runtime ||
    typeof chrome?.runtime?.sendMessage !== "function"
  );
}

// Helper function to show user notification
function showExtensionContextError() {
  // Prevent multiple notifications
  if (document.querySelector(".transcriber-context-error")) return;

  // Create a toast-like notification
  const notification = document.createElement("div");
  notification.className = "transcriber-context-error";
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
    ">
      <strong>WhatsApp Transcriber:</strong><br>
      Extension was reloaded. Please refresh this page to continue using transcription.
      <button onclick="window.location.reload()" style="
        background: white;
        color: #ff4444;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        margin-left: 8px;
        cursor: pointer;
        font-size: 12px;
      ">Refresh Page</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 15 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.parentElement.removeChild(notification);
    }
  }, 15000);
}

export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_end",
  main: async () => {
    async function initTranscriber() {
      try {
        const app = document.createElement("div");
        app.id = "whatsapp-transcriber-app";
        app.className = "whatsapp-transcriber-app";
        app.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 0;
          height: 0;
          overflow: visible;
          z-index: 9996;
        `;
        document.body.appendChild(app);

        // Initialize with error handling
        try {
          await initialize();
        } catch (error) {
          console.error("Error initializing settings:", error);
          if (isExtensionContextInvalidated(error)) {
            showExtensionContextError();
            return; // Don't continue if context is invalidated
          }
          throw error; // Re-throw if it's a different error
        }

        let previousSettingsJson = JSON.stringify(getAllSettings());
        let component = mount(App, { target: app });

        // @ts-ignore
        chrome.runtime.onMessage.addListener((message: { action: string }) => {
          try {
            if (message.action === "settingsUpdated") {
              const currentSettingsJson = JSON.stringify(getAllSettings());
              if (currentSettingsJson !== previousSettingsJson) {
                previousSettingsJson = currentSettingsJson;

                if (component) component.$destroy();
                component = mount(App, { target: app });

                window.dispatchEvent(
                  new CustomEvent("wa-transcriber-settings-updated")
                );
              }
            }
          } catch (error) {
            console.error("Error handling settings update:", error);
            if (isExtensionContextInvalidated(error)) {
              showExtensionContextError();
            }
          }
          return true;
        });

        // Send ready message with error handling
        try {
          chrome.runtime.sendMessage({ action: "contentScriptReady" });
        } catch (error) {
          console.error("Error sending contentScriptReady message:", error);
          if (isExtensionContextInvalidated(error)) {
            showExtensionContextError();
          }
        }
      } catch (error) {
        console.error("Error in initTranscriber:", error);
        if (isExtensionContextInvalidated(error)) {
          showExtensionContextError();
        }
      }
    }

    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", initTranscriber);
    else await initTranscriber();
  },
});

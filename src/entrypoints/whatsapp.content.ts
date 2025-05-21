import "../assets/app.css";
import { mount } from "svelte";
import App from "../components/App.svelte";
import { initialize, getAllSettings } from "../services/settingsService.js";

export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_end",
  main: async () => {
    async function initTranscriber() {
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

      await initialize();
      let previousSettingsJson = JSON.stringify(getAllSettings());

      mount(App, { target: app });

      // @ts-ignore
      chrome.runtime.onMessage.addListener((message: { action: string }) => {
        if (message.action === "settingsUpdated") {
          const currentSettingsJson = JSON.stringify(getAllSettings());
          if (currentSettingsJson !== previousSettingsJson) {
            previousSettingsJson = currentSettingsJson;
            window.location.reload();
          }
        }
        return true;
      });

      chrome.runtime.sendMessage({ action: "contentScriptReady" });
    }

    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", initTranscriber);
    else await initTranscriber();
  },
});

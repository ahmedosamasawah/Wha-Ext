import { mount } from "svelte";
import App from "../components/App.svelte";
import { initialize, getAllSettings } from "$services/settingsService";

export default defineContentScript({
  matches: ["https://web.whatsapp.com/*"],
  runAt: "document_end",
  main: async (ctx) => {
    const setupMessageListener = () => {
      browser.runtime.onMessage.addListener((message) => {
        console.log("Content script received message:", message);
        if (message.action === "settingsUpdated") {
          try {
            const currentSettings = localStorage.getItem(
              "whatsapp-transcriber-settings"
            );
            const latestSettings = JSON.stringify(getAllSettings());

            if (latestSettings !== currentSettings) {
              localStorage.setItem(
                "whatsapp-transcriber-settings",
                latestSettings
              );
              if (document.getElementById("whatsapp-transcriber-app")) {
                window.location.reload();
              }
            }
          } catch (error) {
            console.error("Error handling settings update:", error);
          }
        }
        return true;
      });

      browser.runtime
        .sendMessage({ action: "contentScriptReady" })
        .catch((e) => {
          console.log("Could not notify background script of readiness:", e);
        });
    };

    setupMessageListener();

    const initApp = async () => {
      // Create a container with minimal styling and no external dependencies
      const container = document.createElement("div");
      container.id = "whatsapp-transcriber-app";

      // Apply basic styles to ensure our container doesn't affect the page
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        overflow: visible;
        z-index: 9996;
      `;

      document.body.appendChild(container);

      await initialize();
      const currentSettings = JSON.stringify(getAllSettings());
      localStorage.setItem("whatsapp-transcriber-settings", currentSettings);

      mount(App, { target: container });
    };

    if (document.readyState === "loading")
      ctx.addEventListener(document, "DOMContentLoaded", initApp);
    else await initApp();
  },
});

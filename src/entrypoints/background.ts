import * as storageService from "../services/storageService.js";
import { initialize, getSetting } from "../services/settingsService.js";

export default defineBackground(() => {
  const readyWhatsappTabs = new Set<number>();

  (async () => await initialize())();

  function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const notifyWhatsappTabs = debounce(async () => {
    const tabs = await chrome.tabs.query({
      url: "https://web.whatsapp.com/*",
    });

    if (tabs && tabs.length > 0) {
      const messagePromises = tabs.map(
        (tab) =>
          new Promise<void>((resolve) => {
            if (tab.id && readyWhatsappTabs.has(tab.id)) {
              chrome.tabs.sendMessage(
                tab.id,
                { action: "settingsUpdated" },
                () => {
                  const lastError = chrome.runtime.lastError;
                  if (lastError) {
                    console.log(
                      `Error sending message to tab ${tab.id}: ${lastError.message}`
                    );
                    readyWhatsappTabs.delete(tab.id);
                  }
                  resolve();
                }
              );
            } else resolve();
          })
      );

      await Promise.all(messagePromises);
    }
  }, 500);

  interface Message {
    action: string;
    [key: string]: any;
  }

  interface MessageSender {
    tab?: chrome.tabs.Tab;
    frameId?: number;
    id?: string;
    url?: string;
    origin?: string;
  }

  const messageHandlers = {
    async contentScriptReady(message: Message, sender: MessageSender) {
      if (sender.tab?.id) readyWhatsappTabs.add(sender.tab.id);

      return { success: true };
    },

    async checkStorage() {
      const syncStorage = await storageService.getAll("sync");
      const localStorage = await storageService.getAll("local");

      return { syncStorage, localStorage };
    },

    async getApiKey() {
      const transcriptionApiKey = getSetting("transcriptionApiKey", "");
      const processingApiKey = getSetting("processingApiKey", "");

      return {
        apiKey: transcriptionApiKey || processingApiKey || null,
      };
    },

    async settingsUpdated() {
      await initialize();
      notifyWhatsappTabs();
      return { success: true };
    },
  };

  // @ts-ignore
  chrome.runtime.onMessage.addListener(
    (
      message: Message,
      sender: MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (!message || !message.action) return false;

      const handler =
        messageHandlers[message.action as keyof typeof messageHandlers];
      if (!handler) return false;

      handler(message, sender)
        .then(sendResponse)
        .catch((error: Error) => {
          sendResponse({ error: error.message });
        });

      return true;
    }
  );

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install")
      browser.tabs.create({
        url: browser.runtime.getURL("/onboarding.html"),
      });
  });
});

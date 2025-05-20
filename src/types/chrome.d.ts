declare namespace chrome {
  namespace runtime {
    function openOptionsPage(): void;
    function sendMessage(message: any): void;
    const lastError: Error | undefined;

    interface InstalledDetails {
      reason: "install" | "update" | "chrome_update" | "shared_module_update";
      previousVersion?: string;
      id?: string;
    }

    interface MessageSender {
      tab?: tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      tlsChannelId?: string;
      origin?: string;
    }

    function onMessage(
      callback: (
        message: any,
        sender: MessageSender,
        sendResponse: (response?: any) => void
      ) => boolean | void
    ): void;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
      removeListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
      hasListeners(): boolean;
    };

    const onInstalled: {
      addListener(callback: (details: InstalledDetails) => void): void;
      removeListener(callback: (details: InstalledDetails) => void): void;
      hasListeners(): boolean;
    };
  }

  namespace storage {
    interface StorageArea {
      get(
        keys: string | string[] | null,
        callback: (items: Record<string, any>) => void
      ): void;
      set(items: Record<string, any>, callback?: () => void): void;
      remove(keys: string | string[], callback?: () => void): void;
      clear(callback?: () => void): void;
    }

    const sync: StorageArea;
    const local: StorageArea;
    const session: StorageArea;
  }

  namespace tabs {
    interface Tab {
      id: number;
      url?: string;
    }

    function query(queryInfo: { url: string }): Promise<Tab[]>;
    function sendMessage(
      tabId: number,
      message: any,
      callback?: (response?: any) => void
    ): void;
  }
}

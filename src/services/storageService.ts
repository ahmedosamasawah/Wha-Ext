import * as kv from "idb-keyval";

type StorageType = "local" | "sync" | "indexedDB";

export async function get(
  key: string,
  storageType: StorageType = "local"
): Promise<any> {
  if (storageType === "indexedDB") {
    try {
      return await kv.get(key);
    } catch (error) {
      console.error(`Error retrieving '${key}' from indexedDB:`, error);
      return null;
    }
  }

  return new Promise((resolve) =>
    chrome.storage[storageType].get([key], (result) =>
      resolve(result[key] !== undefined ? result[key] : null)
    )
  );
}

export async function set(
  key: string,
  value: any,
  storageType: StorageType | StorageType[] = "local"
): Promise<boolean> {
  const storageTypes = Array.isArray(storageType) ? storageType : [storageType];

  const promises = storageTypes.map((type) => {
    if (type === "indexedDB") {
      try {
        // Ensure value is safely serializable before storing
        // For indexedDB, we need to make sure it doesn't contain circular references
        const safeValue = makeSerializable(value);
        return kv.set(key, safeValue);
      } catch (error) {
        console.error(`Error storing '${key}' in indexedDB:`, error);
        return Promise.resolve(false);
      }
    }

    return new Promise<boolean>((resolve) => {
      const data: Record<string, any> = {};
      data[key] = value;
      chrome.storage[type].set(data, () => resolve(!chrome.runtime.lastError));
    });
  });

  const results = await Promise.all(promises);
  return results.every(Boolean);
}

export async function getAll(
  storageType: StorageType = "local"
): Promise<Record<string, any>> {
  if (storageType === "indexedDB") {
    try {
      const entries = await kv.entries();
      return Object.fromEntries(entries);
    } catch (error) {
      console.error("Error retrieving all entries from indexedDB:", error);
      return {};
    }
  }

  return new Promise((resolve) => {
    chrome.storage[storageType].get(null, (items) => resolve(items || {}));
  });
}

// Helper function to make an object safely serializable by removing circular references
// and non-serializable values like functions, DOM nodes, etc.
function makeSerializable(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitive types
  if (typeof obj !== "object") {
    // Convert functions to undefined
    if (typeof obj === "function") {
      return undefined;
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => makeSerializable(item));
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // For other objects, create a clean copy
  const clean: Record<string, any> = {};

  // Use a try-catch to handle potential getter errors
  for (const key in obj) {
    try {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];

        // Skip functions and symbols
        if (typeof value === "function" || typeof value === "symbol") {
          continue;
        }

        // Skip DOM nodes
        if (value instanceof Node || value instanceof Window) {
          continue;
        }

        clean[key] = makeSerializable(value);
      }
    } catch (e) {
      // If accessing a property throws an error, skip it
      continue;
    }
  }

  return clean;
}

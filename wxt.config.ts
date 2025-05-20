import { defineConfig } from "wxt";
import path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  outDir: "dist",
  modules: ["@wxt-dev/module-svelte"],
  alias: {
    $lib: path.resolve("src/lib"),
    $api: path.resolve("src/api"),
    $services: path.resolve("src/services"),
    $utils: path.resolve("src/utils"),
    $types: path.resolve("src/types"),
  },
  manifest: {
    name: "WhatsApp AI Transcriber",
    version: "0.0.1",
    description:
      "A browser extension that adds voice message transcription functionality to WhatsApp Web, using OpenAI's Whisper API.",
    permissions: ["activeTab", "storage", "tabs", "scripting"],
    host_permissions: ["https://web.whatsapp.com/*"],
    web_accessible_resources: [
      {
        resources: ["whatsapp_hook.js"],
        matches: ["https://web.whatsapp.com/*"],
      },
    ],
  },
});

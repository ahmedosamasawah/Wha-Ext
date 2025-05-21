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
    version: "1.0.0",
    description:
      "Transcribe, clean, summarize, and get suggested replies for WhatsApp voice messages",

    permissions: ["activeTab", "storage", "tabs", "scripting"],
    host_permissions: [
      "https://web.whatsapp.com/*",
      "http://localhost:11434/*",
      "http://127.0.0.1:11434/*",
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: [
          "whatsapp_hook.js",
          "fonts/kitab-base.woff2",
          "fonts/kitab-base-bold.woff2",
          "fonts/kitab-phrases.woff2",
        ],
        matches: ["https://web.whatsapp.com/*"],
      },
    ],
  },
});

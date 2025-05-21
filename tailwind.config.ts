export default {
  content: [
    "./src/**/*.{html,js,ts,svelte,css}",
    "./src/entrypoints/**/*.{html,js,ts,svelte,css}",
  ],
  theme: {
    extend: {
      fontFamily: {
        kitab: [
          "Kitab",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  important: ".whatsapp-transcriber-app",
  plugins: [],
};

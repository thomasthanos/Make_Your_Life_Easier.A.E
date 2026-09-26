import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;
const root = import.meta.dirname;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // WebView2 is evergreen Chromium, so no legacy transpilation is needed.
    target: "chrome120",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rolldownOptions: {
      // Two windows, two entry pages: the updater splash and the main shell.
      input: {
        main: resolve(root, "index.html"),
        splash: resolve(root, "splash.html"),
      },
    },
  },
});

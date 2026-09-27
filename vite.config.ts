import { defineConfig, type UserConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;
const project = import.meta.dirname;
const src = resolve(project, "src");

// https://v2.tauri.app/start/frontend/vite/
//
// The pages live in src/ (index.html, splash.html, installer.html), static
// files in src/public/. Two builds come out of it:
//   vite build               the app's two windows -> dist/ (src-tauri embeds it)
//   vite build --mode setup  the setup and uninstaller window -> dist-installer/
//                            (only src-tauri/installer embeds it)
// The dev server serves all three pages.
export default defineConfig(({ mode }): UserConfig => {
  const setup = mode === "setup";
  return {
    root: src,
    envDir: project,
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
      outDir: resolve(project, setup ? "dist-installer" : "dist"),
      emptyOutDir: true,
      // The setup window needs none of the app's icons.
      copyPublicDir: !setup,
      rolldownOptions: {
        input: setup
          ? { installer: resolve(src, "installer.html") }
          : {
              // Two windows, two entry pages: the updater splash and the main shell.
              main: resolve(src, "index.html"),
              splash: resolve(src, "splash.html"),
            },
      },
    },
  };
});

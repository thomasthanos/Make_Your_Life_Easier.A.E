import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

const root = import.meta.dirname;

// The setup and uninstaller window (src-tauri/installer). Built on its own
// into dist-installer/, which only that crate embeds.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  build: {
    target: "chrome120",
    outDir: "dist-installer",
    emptyOutDir: true,
    rolldownOptions: {
      input: { installer: resolve(root, "installer.html") },
    },
  },
});

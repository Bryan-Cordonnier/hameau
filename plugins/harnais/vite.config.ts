/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Une page HTML par app. Le dossier public/ (manifest.json) est copié tel quel dans dist/.
const page = (chemin: string) => fileURLToPath(new URL(`./${chemin}/index.html`, import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [svelte()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome120",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        ile: page("apps/ile"),
        tableau: page("apps/tableau"),
        chantiers: page("apps/chantiers"),
        courrier: page("apps/courrier"),
        petitmot: page("apps/petitmot"),
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});

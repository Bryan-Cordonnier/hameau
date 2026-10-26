// Serveur des démos : même greffon Svelte que le plugin ; le moteur est remplacé par un faux (données d'exemple).
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [svelte()],
  resolve: { alias: { "@etabli/sdk": fileURLToPath(new URL("./faux-sdk.ts", import.meta.url)) } },
});

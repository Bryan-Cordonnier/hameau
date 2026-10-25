// Serveur des démos : même greffon Svelte que le plugin (les modules communs importent des composants).
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({ root: __dirname, plugins: [svelte()] });

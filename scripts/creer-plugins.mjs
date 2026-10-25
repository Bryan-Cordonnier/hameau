// Écrit l'échafaudage commun des plugins de Hameau (package.json, vite.config.ts, une page HTML et un main.ts par app).
// Les composants (App.svelte de chaque app) et les manifestes sont écrits à la main. Relançable sans risque.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS = {
  harnais: { version: "0.1.0", apps: { ile: "Le hameau", tableau: "Tableau", chantiers: "Chantiers", courrier: "Courrier", petitmot: "Petit mot" }, deps: { three: "^0.180.0" }, devDeps: { "@types/three": "^0.180.0" } },
  agents: { version: "0.1.0", apps: { equipe: "Équipe" }, deps: {}, devDeps: {} },
  cerveau: { version: "0.1.0", apps: { carte: "Cerveau" }, deps: {}, devDeps: {} },
};
const ecrire = (chemin, contenu) => {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, contenu);
};
for (const [id, p] of Object.entries(PLUGINS)) {
  const d = join(racine, "plugins", id);
  ecrire(
    join(d, "package.json"),
    JSON.stringify(
      {
        name: `@hameau/plugin-${id}`,
        private: true,
        version: p.version,
        type: "module",
        scripts: { build: "vite build", check: "svelte-check --tsconfig ./tsconfig.json", test: "vitest run --passWithNoTests" },
        dependencies: { "@etabli/sdk": "*", "@etabli/ui": "^0.1.0", "@hameau/commun": "*", ...p.deps },
        devDependencies: {
          "@sveltejs/vite-plugin-svelte": "^7.3.1",
          "@tsconfig/svelte": "^5.0.8",
          "@types/node": "^26.6.4",
          svelte: "^5.57.1",
          "svelte-check": "^4.7.6",
          typescript: "^7.0.2",
          vite: "^8.3.2",
          vitest: "^5.0.3",
          ...p.devDeps,
        },
      },
      null,
      2,
    ) + "\n",
  );
  const entrees = Object.keys(p.apps).map((a) => `        ${a}: page("apps/${a}"),`).join("\n");
  ecrire(
    join(d, "vite.config.ts"),
    `/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Une page HTML par app. Le dossier public/ (manifest.json) est copié tel quel dans dist/.
const page = (chemin: string) => fileURLToPath(new URL(\`./\${chemin}/index.html\`, import.meta.url));

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
${entrees}
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
`,
  );
  for (const [app, titre] of Object.entries(p.apps)) {
    ecrire(
      join(d, "apps", app, "index.html"),
      `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${titre}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
`,
    );
    ecrire(
      join(d, "apps", app, "main.ts"),
      `import "@etabli/sdk/base.css";
import "@etabli/ui/kit.css";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
`,
    );
    if (!existsSync(join(d, "apps", app, "App.svelte"))) ecrire(join(d, "apps", app, "App.svelte"), `<p>${titre}</p>\n`);
  }
}
console.log("ok");

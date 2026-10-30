// Lance la ligne de commande Tauri du moteur (etable/apps/desktop) avec la configuration de Hameau et ses plugins.
//   node scripts/tauri.mjs dev | build | android init | android build ...
// Les plugins compilés (plugins/*/dist) sont donnés au moteur par ETABLE_PLUGINS_DIR : il les range dans le binaire.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const moteur = join(racine, "etable", "apps", "desktop");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage : node scripts/tauri.mjs <commande Tauri>  (dev, build, android init, android build…)");
  process.exit(1);
}
// Une version à publier (HAMEAU_RELEASE=1) produit aussi le fichier de signature de mise à jour : il faut la clé privée dans l'environnement.
const configs = ["hameau.conf.json", ...(process.env.HAMEAU_RELEASE === "1" ? ["hameau.release.conf.json"] : [])];
const resultat = spawnSync("npx", ["tauri", ...args, ...configs.flatMap((c) => ["--config", join(racine, c)])], {
  cwd: moteur,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ETABLE_PLUGINS_DIR: join(racine, "plugins"), ETABLE_DISTRIBUTION: join(racine, "distribution.json") },
});
process.exit(resultat.status ?? 1);

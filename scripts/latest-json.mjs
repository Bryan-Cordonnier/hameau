// Écrit latest.json, le fichier que l'AGL installé lit pour savoir s'il existe une nouvelle version
// (plugins.updater.endpoints de hameau.conf.json). Lancé par .github/workflows/publier.yml.
//   node scripts/latest-json.mjs v0.3.1 chemin/AGL_0.3.1_x64_fr-FR.msi notes.txt > latest.json
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const [tag, msi, notesFile] = process.argv.slice(2);
if (!tag || !msi || !notesFile) {
  console.error("Usage : node scripts/latest-json.mjs <étiquette> <fichier .msi> <notes.txt>");
  process.exit(1);
}

const depot = process.env.GITHUB_REPOSITORY ?? "Bryan-Cordonnier/hameau";
const url = `https://github.com/${depot}/releases/download/${tag}/${encodeURIComponent(basename(msi))}`;
const platform = { signature: readFileSync(`${msi}.sig`, "utf8").trim(), url };

const latest = {
  version: tag.replace(/^v/, ""),
  notes: readFileSync(notesFile, "utf8").trim(),
  pub_date: new Date().toISOString(),
  platforms: { "windows-x86_64-msi": platform, "windows-x86_64": platform },
};
process.stdout.write(`${JSON.stringify(latest, null, 2)}\n`);

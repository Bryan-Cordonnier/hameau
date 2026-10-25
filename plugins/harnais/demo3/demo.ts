// Démo du bureau numérique de Hameau (données d'exemple, rien n'est branché au cerveau) : glisser pour se déplacer,
// molette pour zoomer, survoler pour voir les noms, cliquer une pièce pour sa fiche. ?theme=clair, ?piece=dev.
import * as THREE from "three";
import { Bureau, type Piece } from "../src/bureau/bureau";
import { mascotteClaude } from "../src/bureau/mascotte";
import { MEUBLER, PIECES } from "../src/bureau/pieces";
import { Agent, pion, type Geste } from "../src/bureau/pion";

const params = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const b = new Bureau(canvas, PIECES, MEUBLER);

const INFOS: Record<string, { etat: [string, string]; lignes: [string, string][] }> = {
  boss: { etat: ["Max pilote", "ok"], lignes: [["Prochain rapport", "20:00"], ["Petits mots non lus", "1"]] },
  dev: { etat: ["Claude au travail", "ok"], lignes: [["Projet", "Hameau"], ["Commits aujourd'hui", "7"]] },
  atelier: { etat: ["2 tests en cours", "info"], lignes: [["Réussis", "48"], ["En échec", "1"]] },
  pause: { etat: ["Personne", "dort"], lignes: [["Cafés aujourd'hui", "3"]] },
  taches: { etat: ["5 tâches", "att"], lignes: [["En cours", "2"], ["Prévues", "3"]] },
  secretariat: { etat: ["Tri en cours", "info"], lignes: [["Mails à trier", "12"], ["Triés aujourd'hui", "40"]] },
  archives: { etat: ["868 neurones", "ok"], lignes: [["Écrits aujourd'hui", "14"], ["Liens", "212"], ["Tâches au mur", "5"]] },
  reunion: { etat: ["1 chantier", "att"], lignes: [["Étude chaudronnerie", "40 %"], ["Rapports à lire", "2"]] },
  serveur: { etat: ["Modèle coupé", "dort"], lignes: [["Carte graphique", "aucune"], ["Modèle", "Qwen3.8-27B"]] },
};
b.majServeur(params.get("serveur") === "allume");

// ---------- agents ----------
const poste = (piece: string, i = 0) => {
  const p = PIECES.find((q) => q.id === piece)!;
  const o = p.postes[i]!;
  return { x: p.x0 + o.x, z: p.z0 + o.z, cap: o.cap };
};
const placer = (a: Agent, piece: string, i = 0) => {
  const p = poste(piece, i);
  a.groupe.position.set(p.x, 0.03, p.z);
  a.faire("attend", "", p.cap);
};
const max = new Agent("max", "Max", pion("#b65cf0", ["costard"]), new THREE.Vector3());
const claude = new Agent("claude", "Claude", mascotteClaude(), new THREE.Vector3());
const facteur = new Agent("facteur", "Facteur (sous-agent)", pion("#f2c14e", ["oreillette"]), new THREE.Vector3());
const testeur = new Agent("testeur", "Testeur (sous-agent)", pion("#5fd18a", ["tablier", "casque"]), new THREE.Vector3());
const agents = [max, claude, facteur, testeur];
for (const a of agents) b.scene.add(a.groupe);
placer(max, "boss");
placer(claude, "dev", 1);
placer(facteur, "secretariat");
placer(testeur, "atelier");

const activite = document.getElementById("activite")!;
function noter(texte: string): void {
  const d = document.createElement("div");
  d.innerHTML = `${texte} <small>à l'instant</small>`;
  activite.insertBefore(d, activite.children[1] ?? null);
  while (activite.children.length > 5) activite.lastElementChild!.remove();
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Etape = [piece: string, poste: number, geste: Geste, texte: string, duree: number, note?: string];
async function tournee(a: Agent, etapes: Etape[]): Promise<void> {
  for (;;) {
    for (const [piece, i, geste, texte, duree, note] of etapes) {
      await a.suivre(b.chemin(a.groupe.position, poste(piece, i)), 2.2, performance.now());
      a.faire(geste, texte, poste(piece, i).cap);
      if (note) noter(note);
      await pause(duree);
    }
  }
}
void tournee(max, [
  ["boss", 0, "telephone", "lit tes messages", 6000],
  ["secretariat", 1, "lit", "relit le tri des mails", 5000, "🟣 Max a relu le tri des mails"],
  ["reunion", 0, "lit", "avance l'étude chaudronnerie", 7000, "🟣 Max a avancé l'étude chaudronnerie"],
  ["archives", 1, "porte", "range un rapport", 4000, "📮 Rapport « Tri des mails » classé"],
  ["taches", 0, "lit", "relit les tâches", 5000, "📌 Max a réordonné les tâches"],
  ["pause", 0, "cafe", "prend un café", 5000],
  ["boss", 1, "dort", "fait une sieste", 7000],
]);
void tournee(claude, [
  ["dev", 1, "tape", "code Hameau", 9000, "✴️ Claude a poussé un commit sur Hameau"],
  ["archives", 0, "lit", "relit le cahier Hameau", 5000],
  ["atelier", 1, "teste", "lance les tests", 5000, "🧪 Tests Hameau : 48 réussis"],
  ["dev", 3, "tape", "corrige un test", 7000],
]);
void tournee(facteur, [
  ["secretariat", 0, "tape", "trie les mails", 8000, "✉️ 4 mails triés"],
  ["archives", 0, "porte", "dépose un résumé", 3500],
  ["taches", 1, "lit", "note une tâche", 4000],
  ["secretariat", 0, "lit", "lit un mail", 6000],
]);
void tournee(testeur, [
  ["atelier", 0, "teste", "teste Quotidien", 8000],
  ["serveur", 0, "lit", "vérifie le serveur", 4000],
  ["atelier", 1, "tape", "note un échec", 5000, "🧪 1 test en échec sur Quotidien"],
  ["pause", 1, "cafe", "prend un café", 4000],
]);

// ---------- caméra ----------
const cible = new THREE.Vector3();
const cibleVoulue = new THREE.Vector3();
const DEFAUT = 54;
let distance = DEFAUT;
let distanceVoulue = DEFAUT;
const DIRECTION = new THREE.Vector3(0.32, 1, 0.78).normalize();
const DROITE = new THREE.Vector3(1, 0, 0);
const AVANT = new THREE.Vector3(0, 0, -1);
function voler(x: number, z: number, d: number, decalerPourFiche: boolean): void {
  cibleVoulue.set(x, 0, z);
  // la fiche occupe la droite : on décale la vue pour que la pièce reste bien visible
  if (decalerPourFiche) cibleVoulue.addScaledVector(DROITE, d * 0.1);
  distanceVoulue = d;
}
let glisse: { x: number; y: number } | null = null;
let aGlisse = false;
canvas.addEventListener("pointerdown", (e) => ((glisse = { x: e.clientX, y: e.clientY }), (aGlisse = false)));
addEventListener("pointerup", (e) => {
  if (glisse && !aGlisse && e.target === canvas) choisir(PIECES.find((p) => p.id === b.viser(e.clientX, e.clientY, innerWidth, innerHeight)) ?? null);
  glisse = null;
});
let survol: { piece?: Piece; agent?: Agent } | null = null;
const rayon = new THREE.Raycaster();
canvas.addEventListener("pointermove", (e) => {
  if (glisse) {
    const dx = e.clientX - glisse.x;
    const dy = e.clientY - glisse.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) aGlisse = true;
    const k = distance * 0.0011;
    cibleVoulue.addScaledVector(DROITE, -dx * k).addScaledVector(AVANT, -dy * k * 1.3);
    cible.copy(cibleVoulue);
    glisse = { x: e.clientX, y: e.clientY };
    return;
  }
  rayon.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), b.camera);
  const agent = agents.find((a) => rayon.intersectObject(a.groupe, true).length > 0);
  const piece = agent ? undefined : PIECES.find((p) => p.id === b.viser(e.clientX, e.clientY, innerWidth, innerHeight));
  survol = agent ? { agent } : piece ? { piece } : null;
  canvas.style.cursor = survol ? "pointer" : "grab";
});
canvas.addEventListener("wheel", (e) => (e.preventDefault(), (distanceVoulue = Math.min(90, Math.max(8, distanceVoulue * Math.exp(e.deltaY * 0.0012))))), { passive: false });
document.getElementById("plus")!.onclick = () => (distanceVoulue = Math.max(8, distanceVoulue * 0.75));
document.getElementById("moins")!.onclick = () => (distanceVoulue = Math.min(90, distanceVoulue * 1.33));
document.getElementById("centre")!.onclick = () => (choisir(null), voler(0, 0, DEFAUT, false));
document.getElementById("nuit")!.onclick = () => {
  b.majServeur(!b.serveurAllume);
  INFOS.serveur!.etat = b.serveurAllume ? ["Modèle allumé", "ok"] : ["Modèle coupé", "dort"];
};

// ---------- sélection : un liseré violet autour de la pièce ----------
const liseréMat = new THREE.MeshBasicMaterial({ color: "#c98bff", transparent: true, opacity: 0.9, depthWrite: false });
const liseré = new THREE.Group();
for (let i = 0; i < 4; i++) liseré.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), liseréMat));
liseré.visible = false;
b.scene.add(liseré);
let choisie: Piece | null = null;
const fiche = document.getElementById("fiche")!;
function choisir(p: Piece | null): void {
  choisie = p;
  liseré.visible = !!p;
  (document.getElementById("zone-nom") as HTMLElement).textContent = p ? `${p.emoji} ${p.nom}` : "Tout le bureau";
  if (!p) {
    fiche.hidden = true;
    return;
  }
  const l = p.x1 - p.x0 + 0.3;
  const pr = p.z1 - p.z0 + 0.3;
  const cx = (p.x0 + p.x1) / 2;
  const cz = (p.z0 + p.z1) / 2;
  const [n, s, o, e] = liseré.children as THREE.Mesh[];
  n!.scale.set(l, 1, 0.12), n!.position.set(cx, 1, cz - pr / 2);
  s!.scale.set(l, 1, 0.12), s!.position.set(cx, 1, cz + pr / 2);
  o!.scale.set(0.12, 1, pr), o!.position.set(cx - l / 2, 1, cz);
  e!.scale.set(0.12, 1, pr), e!.position.set(cx + l / 2, 1, cz);
  voler(cx, cz, 24, true);
  const i = INFOS[p.id]!;
  const presents = agents.filter((a) => {
    const q = a.groupe.position;
    return q.x > p.x0 && q.x < p.x1 && q.z > p.z0 && q.z < p.z1;
  });
  fiche.innerHTML = `<h3>${p.emoji} ${p.nom}</h3><span class="chip ${i.etat[1]}">● ${i.etat[0]}</span><div class="lignes">${i.lignes
    .map(([a, v]) => `<div class="ligne"><span>${a}</span><b>${v}</b></div>`)
    .join("")}<div class="ligne"><span>Présents</span><b>${presents.map((a) => a.nom.split(" ")[0]).join(", ") || "personne"}</b></div></div><button class="bouton">Ouvrir ${p.nom} →</button>`;
  fiche.hidden = false;
}
const reseau = document.getElementById("reseau")!;
reseau.innerHTML = PIECES.map((p) => `<button data-z="${p.id}"><span>${p.emoji}</span><span><b>${p.nom}</b><small>${INFOS[p.id]!.etat[0]}</small></span><span class="chip ${INFOS[p.id]!.etat[1]}">●</span></button>`).join("");
document.getElementById("zone")!.onclick = () => (reseau.hidden = !reseau.hidden);
reseau.onclick = (e) => {
  const id = (e.target as HTMLElement).closest("button")?.dataset.z;
  reseau.hidden = true;
  choisir(PIECES.find((p) => p.id === id) ?? null);
};

// ---------- thème ----------
const boutonTheme = document.getElementById("theme")!;
function theme(t: "sombre" | "clair"): void {
  b.appliquerTheme(t);
  document.documentElement.dataset.theme = t;
  boutonTheme.textContent = t === "sombre" ? "☀︎ Clair" : "☾ Sombre";
  liseréMat.color.set(t === "sombre" ? "#c98bff" : "#a24ee0");
}
boutonTheme.onclick = () => theme(b.theme === "sombre" ? "clair" : "sombre");
theme(params.get("theme") === "clair" ? "clair" : "sombre");
if (params.get("piece")) choisir(PIECES.find((p) => p.id === params.get("piece")) ?? null);

// ---------- étiquettes au survol seulement ----------
const tags = document.getElementById("tags")!;
const couleurEtat: Record<string, string> = { ok: "var(--ok)", att: "var(--attente)", info: "var(--info)", dort: "var(--doux)" };
function etiquettes(): void {
  const ecran = (v: THREE.Vector3) => {
    const p = v.clone().project(b.camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  };
  let html = "";
  for (const p of new Set([survol?.piece, choisie].filter(Boolean) as Piece[])) {
    const e = ecran(new THREE.Vector3((p.x0 + p.x1) / 2, 1.2, p.z0));
    html += `<div class="tag" style="left:${e.x}px;top:${e.y}px"><span class="pt" style="background:${couleurEtat[INFOS[p.id]!.etat[1]]}"></span>${p.emoji} ${p.nom}</div>`;
  }
  const a = survol?.agent;
  if (a) {
    const e = ecran(a.tete().add(new THREE.Vector3(0, 0.5, 0)));
    html += `<div class="tag agent" style="left:${e.x}px;top:${e.y}px">${a.nom} · ${a.marche ? "en route" : a.texte || "attend"}</div>`;
  }
  tags.innerHTML = html;
}

addEventListener("resize", () => b.taille(innerWidth, innerHeight));
b.taille(innerWidth, innerHeight);

let avant = performance.now();
function boucle(t: number): void {
  const dt = Math.min(0.1, Math.max(0, (t - avant) / 1000));
  avant = t;
  cible.lerp(cibleVoulue, 1 - Math.pow(0.002, dt));
  distance += (distanceVoulue - distance) * (1 - Math.pow(0.002, dt));
  b.camera.position.copy(cible).addScaledVector(DIRECTION, distance);
  b.camera.lookAt(cible);
  for (const a of agents) a.animer(t, dt);
  liseréMat.opacity = 0.6 + Math.sin(t / 350) * 0.3;
  b.rendre(t);
  etiquettes();
  document.getElementById("max-etat")!.textContent = `🟣 Max ${max.marche ? "en route" : max.texte || "au bureau"}`;
  document.getElementById("heure")!.textContent = `En direct ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);

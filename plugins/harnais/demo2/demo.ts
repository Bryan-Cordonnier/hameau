// Démo du quartier de Hameau (données d'exemple, rien n'est branché au cerveau) : glisser pour se déplacer, molette pour
// zoomer, survoler pour voir les noms, cliquer une zone pour sa fiche. ?theme=clair, ?zone=cerveau.
import * as THREE from "three";
import { habitant } from "../../../packages/commun/src/habitants";
import { Agent, type Geste } from "../src/quartier/agent";
import { Quartier, type Zone } from "../src/quartier/quartier";
import { BATIR, PARCS, ROUTES, SEGMENTS, ZONES } from "../src/quartier/zones";

const params = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const q = new Quartier(canvas, ZONES, ROUTES, BATIR, { segments: SEGMENTS, parcs: PARCS });
q.drone("courrier", "cerveau", 8000, 0);
q.drone("courrier", "cerveau", 8000, 4000);
q.drone("cerveau", "chantiers", 9000, 1500);
q.drone("tableau", "chantiers", 10000, 6000);

const INFOS: Record<string, { etat: [string, string]; lignes: [string, string][] }> = {
  courrier: { etat: ["Tri en cours", "info"], lignes: [["À trier", "12"], ["Triés aujourd'hui", "40"]] },
  cerveau: { etat: ["868 neurones", "ok"], lignes: [["Écrits aujourd'hui", "14"], ["Synapses", "212"]] },
  tableau: { etat: ["5 tâches", "att"], lignes: [["En cours", "2"], ["Prévues", "3"]] },
  chantiers: { etat: ["1 chantier", "att"], lignes: [["Étude chaudronnerie", "40 %"]] },
  centrale: { etat: ["Modèle coupé", "dort"], lignes: [["Carte graphique", "aucune"]] },
  atelier: { etat: ["Claude au travail", "ok"], lignes: [["Projet", "Hameau"]] },
  maison: { etat: ["Tu es là", "ok"], lignes: [["Notes à faire", "3"]] },
  cabane: { etat: ["Chez Max", "dort"], lignes: [["Rapport du soir", "20:00"]] },
};

// ---------- agents ----------
const max = new Agent(habitant("max")!, q.zones.find((z) => z.id === "cabane")!.porte.clone());
const claude = new Agent(habitant("claude-code-pc")!, q.zones.find((z) => z.id === "atelier")!.porte.clone());
max.groupe.scale.setScalar(1.8);
claude.groupe.scale.setScalar(1.8);
q.scene.add(max.groupe, claude.groupe);
const agents = [max, claude];
claude.faire("ecrit", "code Hameau");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function tournee(a: Agent, etapes: [string, Geste, string][]): Promise<void> {
  for (;;) {
    for (const [zone, geste, texte] of etapes) {
      await a.suivre(q.cheminVers(a.groupe.position, zone), 2.6, performance.now());
      a.faire(geste, texte);
      await pause(4500);
    }
  }
}
void tournee(max, [
  ["courrier", "trie", "trie les mails"],
  ["cerveau", "lit", "lit 3 neurones"],
  ["chantiers", "travaille", "avance l'étude"],
  ["tableau", "regarde", "relit les tâches"],
  ["cabane", "dort", "fait une sieste"],
]);
void (async () => {
  for (;;) {
    await pause(14000);
    await tournee1(claude, "cerveau", "lit", "relit le cahier");
    await tournee1(claude, "atelier", "ecrit", "code Hameau");
  }
})();
async function tournee1(a: Agent, zone: string, geste: Geste, texte: string): Promise<void> {
  await a.suivre(q.cheminVers(a.groupe.position, zone), 2.4, performance.now());
  a.faire(geste, texte);
  await pause(6000);
}

// ---------- caméra ----------
const cible = new THREE.Vector3();
const cibleVoulue = new THREE.Vector3();
let distance = 78;
let distanceVoulue = 78;
const DIRECTION = new THREE.Vector3(1, 0.9, 1).normalize();
const DROITE = new THREE.Vector3(1, 0, -1).normalize();
function voler(x: number, z: number, d: number, decalerPourFiche: boolean): void {
  cibleVoulue.set(x, 0, z);
  // la fiche occupe la droite : on décale la vue pour que la zone reste à gauche, bien visible
  if (decalerPourFiche) cibleVoulue.addScaledVector(DROITE, d * 0.12);
  distanceVoulue = d;
}
let glisse: { x: number; y: number } | null = null;
let aGlisse = false;
canvas.addEventListener("pointerdown", (e) => ((glisse = { x: e.clientX, y: e.clientY }), (aGlisse = false)));
addEventListener("pointerup", (e) => {
  if (glisse && !aGlisse && e.target === canvas) choisir(q.viser(e.clientX, e.clientY, innerWidth, innerHeight));
  glisse = null;
});
let survol: { zone?: Zone; agent?: Agent } | null = null;
const rayon = new THREE.Raycaster();
canvas.addEventListener("pointermove", (e) => {
  if (glisse) {
    const dx = e.clientX - glisse.x;
    const dy = e.clientY - glisse.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) aGlisse = true;
    const k = distance * 0.0011;
    cibleVoulue.addScaledVector(DROITE, -dx * k).addScaledVector(new THREE.Vector3(-1, 0, -1).normalize(), dy * k * 1.4);
    cible.copy(cibleVoulue);
    glisse = { x: e.clientX, y: e.clientY };
    return;
  }
  rayon.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), q.camera);
  const agent = agents.find((a) => rayon.intersectObject(a.groupe, true).length > 0);
  const zone = agent ? undefined : (q.viser(e.clientX, e.clientY, innerWidth, innerHeight) ?? undefined);
  survol = agent ? { agent } : zone ? { zone } : null;
  canvas.style.cursor = survol ? "pointer" : "grab";
});
canvas.addEventListener("wheel", (e) => (e.preventDefault(), (distanceVoulue = Math.min(170, Math.max(20, distanceVoulue * Math.exp(e.deltaY * 0.0012))))), { passive: false });
document.getElementById("plus")!.onclick = () => (distanceVoulue = Math.max(20, distanceVoulue * 0.75));
document.getElementById("moins")!.onclick = () => (distanceVoulue = Math.min(170, distanceVoulue * 1.33));
document.getElementById("centre")!.onclick = () => (choisir(null), voler(0, 0, 78, false));

// ---------- sélection ----------
const halo = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 96), new THREE.MeshBasicMaterial({ color: "#ff8a66", transparent: true, opacity: 0.9, depthWrite: false }));
halo.rotation.x = -Math.PI / 2;
halo.visible = false;
q.scene.add(halo);
let choisie: Zone | null = null;
const fiche = document.getElementById("fiche")!;
function choisir(z: Zone | null): void {
  choisie = z;
  halo.visible = !!z;
  (document.getElementById("zone-nom") as HTMLElement).textContent = z ? `${z.emoji} ${z.nom}` : "Tout le hameau";
  if (!z) {
    fiche.hidden = true;
    return;
  }
  const r = Math.hypot(z.l, z.p) / 2 + 0.8;
  halo.scale.setScalar(r);
  halo.position.set(z.x, 0.25, z.z);
  voler(z.x, z.z, 48, true);
  const i = INFOS[z.id]!;
  fiche.innerHTML = `<h3>${z.emoji} ${z.nom}</h3><span class="chip ${i.etat[1]}">● ${i.etat[0]}</span><div class="lignes">${i.lignes
    .map(([a, b]) => `<div class="ligne"><span>${a}</span><b>${b}</b></div>`)
    .join("")}</div><button class="bouton">Ouvrir ${z.nom} →</button>`;
  fiche.hidden = false;
}
const reseau = document.getElementById("reseau")!;
reseau.innerHTML = q.zones
  .map((z) => `<button data-z="${z.id}"><span>${z.emoji}</span><span><b>${z.nom}</b><small>${INFOS[z.id]!.etat[0]}</small></span><span class="chip ${INFOS[z.id]!.etat[1]}">●</span></button>`)
  .join("");
document.getElementById("zone")!.onclick = () => (reseau.hidden = !reseau.hidden);
reseau.onclick = (e) => {
  const id = (e.target as HTMLElement).closest("button")?.dataset.z;
  reseau.hidden = true;
  choisir(q.zones.find((z) => z.id === id) ?? null);
};

// ---------- thème ----------
const boutonTheme = document.getElementById("theme")!;
function theme(t: "sombre" | "clair"): void {
  q.appliquerTheme(t);
  document.documentElement.dataset.theme = t;
  boutonTheme.textContent = t === "sombre" ? "☀︎ Clair" : "☾ Sombre";
}
boutonTheme.onclick = () => theme(q.theme === "sombre" ? "clair" : "sombre");
theme(params.get("theme") === "clair" ? "clair" : "sombre");
if (params.get("zone")) choisir(q.zones.find((z) => z.id === params.get("zone")) ?? null);

// ---------- étiquettes au survol seulement ----------
const tags = document.getElementById("tags")!;
const couleurEtat: Record<string, string> = { ok: "var(--ok)", att: "var(--attente)", info: "var(--info)", dort: "var(--doux)" };
function etiquettes(): void {
  const ecran = (v: THREE.Vector3) => {
    const p = v.clone().project(q.camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  };
  let html = "";
  const z = survol?.zone ?? null;
  for (const zone of new Set([z, choisie].filter(Boolean) as Zone[])) {
    const p = ecran(new THREE.Vector3(zone.x, 7.5, zone.z));
    html += `<div class="tag" style="left:${p.x}px;top:${p.y}px"><span class="pt" style="background:${couleurEtat[INFOS[zone.id]!.etat[1]]}"></span>${zone.emoji} ${zone.nom}</div>`;
  }
  const a = survol?.agent;
  if (a) {
    const p = ecran(a.tete().add(new THREE.Vector3(0, 0.6, 0)));
    html += `<div class="tag agent" style="left:${p.x}px;top:${p.y}px">${a.qui.nom} · ${a.marche ? "en route" : a.texte || "attend"}</div>`;
  }
  tags.innerHTML = html;
}

function taille(): void {
  q.taille(innerWidth, innerHeight);
}
addEventListener("resize", taille);
taille();

let avant = performance.now();
function boucle(t: number): void {
  const dt = Math.min(0.1, Math.max(0, (t - avant) / 1000));
  avant = t;
  cible.lerp(cibleVoulue, 1 - Math.pow(0.002, dt));
  distance += (distanceVoulue - distance) * (1 - Math.pow(0.002, dt));
  q.camera.position.copy(cible).addScaledVector(DIRECTION, distance);
  q.camera.lookAt(cible);
  for (const a of agents) a.animer(t, dt);
  halo.material.opacity = 0.65 + Math.sin(t / 350) * 0.25;
  q.rendre(t);
  etiquettes();
  document.getElementById("heure")!.textContent = `En direct ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);

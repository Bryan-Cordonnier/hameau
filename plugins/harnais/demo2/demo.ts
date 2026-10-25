// Démo « Hameau » inspirée de la vidéo WareTrack, sans la copier : un quartier épuré façon maquette, sombre par défaut
// (et clair), Max en couleur de marque, des agents et des flux de données au lieu des camions, l'interface en panneaux
// flottants. Données d'exemple : rien n'est branché au cerveau.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { habitant } from "../../../packages/commun/src/habitants";
import { Personnage } from "../src/ile/personnages";

type Theme = "sombre" | "clair";
const PAL = {
  sombre: { sol: "#1b1e25", parcelle: "#2a303b", route: "#363d4b", trait: "#4a5160", corps: "#4a5263", toit: "#596274", arbre: "#3faa6c", tronc: "#5a4637", accent: "#ff8a66", froid: "#7fb7ff", vitre: "#151820", ciel: "#1a1e26" },
  clair: { sol: "#e6e9ef", parcelle: "#f3f4f7", route: "#dde1e8", trait: "#ffffff", corps: "#ffffff", toit: "#eef0f4", arbre: "#4cc07e", tronc: "#9b7a5a", accent: "#f2785a", froid: "#4f8fe8", vitre: "#cfe2f3", ciel: "#e6e9ef" },
};
let theme: Theme = "sombre";
const P = () => PAL[theme];

// matériaux partagés, recolorés au changement de thème
const M = {
  sol: new THREE.MeshStandardMaterial({ roughness: 1 }),
  parcelle: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
  route: new THREE.MeshStandardMaterial({ roughness: 1 }),
  trait: new THREE.MeshStandardMaterial({ roughness: 1 }),
  corps: new THREE.MeshStandardMaterial({ roughness: 0.75 }),
  toit: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
  arbre: new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
  tronc: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
  accent: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
  lueur: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
  froid: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
  vitre: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1 }),
};
function appliquerTheme(): void {
  const p = P();
  for (const k of ["sol", "parcelle", "route", "trait", "corps", "toit", "arbre", "tronc", "vitre"] as const) M[k].color.set(p[k]);
  M.accent.color.set(p.accent);
  M.lueur.color.set(p.accent);
  M.lueur.emissive.set(p.accent);
  M.lueur.emissiveIntensity = theme === "sombre" ? 1.4 : 0.5;
  M.froid.color.set(p.froid);
  M.froid.emissive.set(p.froid);
  M.froid.emissiveIntensity = theme === "sombre" ? 1.2 : 0.35;
  M.vitre.emissive.set(theme === "sombre" ? "#ffb48f" : "#000000");
  M.vitre.emissiveIntensity = theme === "sombre" ? 0.35 : 0;
  scene.fog = new THREE.Fog(p.sol, 80, 160);
  hemi.intensity = theme === "sombre" ? 1.25 : 1.5;
  soleil.intensity = theme === "sombre" ? 1.9 : 2.6;
  hemi.color.set(theme === "sombre" ? "#8fa4c8" : "#ffffff");
  hemi.groundColor.set(theme === "sombre" ? "#1b1f27" : "#d8dde6");
  document.documentElement.dataset.theme = theme;
  (document.getElementById("theme") as HTMLButtonElement).textContent = theme === "sombre" ? "☀︎ Clair" : "☾ Sombre";
}

// ---------- scène ----------
const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 1, 400);
const hemi = new THREE.HemisphereLight("#ffffff", "#d8dde6", 1.5);
const soleil = new THREE.DirectionalLight("#fff4e6", 2.6);
soleil.position.set(-30, 50, 20);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
soleil.shadow.radius = 8;
soleil.shadow.blurSamples = 16;
soleil.shadow.bias = -0.0004;
Object.assign(soleil.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 160 });
scene.add(hemi, soleil);

const boite = (l: number, h: number, p: number, m: THREE.Material, x: number, y: number, z: number, r = 0.12) => {
  const b = new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 3, Math.min(r, l / 2, h / 2, p / 2)), m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = b.receiveShadow = true;
  return b;
};

// sol infini, parcelles légèrement surélevées, routes à pointillés
const sol = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M.sol);
sol.rotation.x = -Math.PI / 2;
sol.receiveShadow = true;
scene.add(sol);

interface Zone {
  id: string;
  nom: string;
  emoji: string;
  x: number;
  z: number;
  groupe: THREE.Group;
  etat: [string, string];
  infos: [string, string][];
  avancement?: number;
}
const zones: Zone[] = [];
// Disposition libre : chaque zone a sa place, sa taille et son orientation ; les routes serpentent entre elles.
const DISPOSITION: Record<string, { x: number; z: number; l: number; p: number; r: number }> = {
  courrier: { x: -9, z: -8, l: 12.5, p: 8.5, r: 0.16 },
  cerveau: { x: 10.5, z: -10, l: 11, p: 11, r: -0.14 },
  tableau: { x: -2, z: 6.5, l: 7.5, p: 6, r: 0.38 },
  chantiers: { x: 12, z: 8, l: 10, p: 9, r: 0.22 },
  centrale: { x: 27, z: -1, l: 12, p: 9.5, r: -0.3 },
  atelier: { x: -24, z: -1, l: 10, p: 8, r: 0.12 },
  maison: { x: -22, z: -16, l: 8, p: 7, r: -0.32 },
  cabane: { x: -18, z: 14, l: 7, p: 6, r: 0.28 },
};
const ROUTES: [number, number][][] = [
  [[-40, 6], [-28, 6.5], [-16, 4], [-8, 0.5], [2, -1.5], [12, -1], [20, 4.5], [34, 6.5], [46, 4]],
  [[-8, 0.5], [-14, -6], [-17, -14], [-14, -26]],
  [[2, -1.5], [3, -10], [0, -20], [4, -32]],
  [[12, -1], [20, -6], [22, -14], [30, -24]],
  [[-16, 4], [-12, 10], [-10, 18], [-14, 28]],
  [[20, 4.5], [8, 15.5], [-2, 15], [-8, 22]],
];
function ruban(points: [number, number][]): void {
  const courbe = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0.03, z)), false, "centripetal");
  const n = 160;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = courbe.getPointAt(i / n);
    const t = courbe.getTangentAt(i / n);
    const nx = -t.z;
    const nz = t.x;
    pos.push(p.x + nx * 1.6, 0.03, p.z + nz * 1.6, p.x - nx * 1.6, 0.03, p.z - nz * 1.6);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const route = new THREE.Mesh(g, M.route);
  route.receiveShadow = true;
  scene.add(route);
  const longueur = courbe.getLength();
  for (let d = 1; d < longueur; d += 2.4) {
    const p = courbe.getPointAt(d / longueur);
    const t = courbe.getTangentAt(d / longueur);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.1), M.trait);
    m.position.set(p.x, 0.045, p.z);
    m.rotation.y = Math.atan2(t.x, t.z);
    scene.add(m);
  }
}
ROUTES.forEach(ruban);

function zone(id: string, nom: string, emoji: string, x: number, z: number, etat: [string, string], infos: [string, string][], construire: (g: THREE.Group) => void, avancement?: number): void {
  const d = DISPOSITION[id]!;
  x = d.x;
  z = d.z;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = d.r;
  g.add(boite(d.l, 0.18, d.p, M.parcelle, 0, 0, 0, 0.6));
  construire(g);
  g.traverse((o) => (o.userData.zone = id));
  scene.add(g);
  zones.push({ id, nom, emoji, x, z, groupe: g, etat, infos, ...(avancement !== undefined ? { avancement } : {}) });
}

function arbre(g: THREE.Group, x: number, z: number, s = 1): void {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.1 * s, 0.7 * s, 6), M.tronc);
  t.position.set(x, 0.18 + 0.35 * s, z);
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 1), M.arbre);
  f.position.set(x, 0.18 + 1.05 * s, z);
  t.castShadow = f.castShadow = true;
  g.add(t, f);
}

// ---------- les zones ----------
zone("courrier", "Courrier", "✉️", -7.5, -6, ["Tri en cours", "info"], [["À trier", "12"], ["Triés aujourd'hui", "40"], ["Désinscriptions", "18"]], (g) => {
  g.add(boite(7.4, 2.2, 4.2, M.corps, 0, 0.18, -0.8, 0.25));
  g.add(boite(7.6, 0.25, 4.4, M.toit, 0, 2.38, -0.8, 0.12));
  for (let i = 0; i < 4; i++) {
    g.add(boite(1.1, 1.4, 0.1, i === 1 ? M.lueur : M.accent, -2.6 + i * 1.75, 0.18, 1.32, 0.05));
    g.add(boite(1.3, 0.12, 0.6, M.toit, -2.6 + i * 1.75, 1.75, 1.55, 0.04));
  }
  for (let i = 0; i < 5; i++) g.add(boite(0.5, 0.32, 0.36, i % 2 ? M.accent : M.corps, 2.8 + (i % 2) * 0.6, 0.18 + Math.floor(i / 2) * 0.34, 2.6, 0.06));
  arbre(g, -4.6, 3.3, 0.9);
  arbre(g, 4.6, -3.4, 1.1);
});
zone("cerveau", "Cerveau", "🧠", 7.5, -6, ["868 neurones", "ok"], [["Lobes", "7"], ["Écrits aujourd'hui", "14"], ["Synapses", "212"]], (g) => {
  g.add(boite(4.6, 0.6, 4.6, M.corps, 0, 0.18, 0, 0.3));
  const tour = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 4.4, 32), M.corps);
  tour.position.set(0, 0.78 + 2.2, 0);
  tour.castShadow = tour.receiveShadow = true;
  g.add(tour);
  for (let i = 0; i < 6; i++) {
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(1.55 - i * 0.02, 0.06, 8, 48), i === 3 ? M.lueur : M.froid);
    anneau.rotation.x = Math.PI / 2;
    anneau.position.set(0, 1.2 + i * 0.7, 0);
    anneau.userData.anneau = i;
    g.add(anneau);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.toit);
  dome.position.y = 5.18;
  dome.castShadow = true;
  g.add(dome);
  // petits satellites (aires) reliés par des synapses
  for (const [sx, sz] of [[-3.6, 2.4], [3.6, 2.6], [3.4, -2.8]] as [number, number][]) {
    g.add(boite(1.4, 1, 1.4, M.corps, sx, 0.18, sz, 0.3));
    g.add(boite(1.42, 0.12, 1.42, M.froid, sx, 0.9, sz, 0.05));
    const lien = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, Math.hypot(sx, sz) - 1.6, 6), M.froid);
    lien.position.set(sx / 2, 0.55, sz / 2);
    lien.rotation.z = Math.PI / 2;
    lien.rotation.y = -Math.atan2(sz, sx);
    g.add(lien);
  }
});
zone("tableau", "Tableau", "📌", -7.5, 6, ["5 tâches", "att"], [["Missions", "2"], ["Routines", "2"], ["Expéditions", "1"]], (g) => {
  for (const x of [-2.2, 2.2]) g.add(boite(0.22, 3.2, 0.22, M.toit, x, 0.18, 0, 0.05));
  g.add(boite(5, 2.3, 0.25, M.corps, 0, 1.2, 0, 0.12));
  const couleurs = [M.accent, M.froid, M.lueur, M.accent, M.froid];
  couleurs.forEach((m, i) => g.add(boite(0.8, 0.85, 0.06, i % 2 ? M.toit : M.parcelle, -1.8 + i * 0.9, 1.6, 0.16, 0.03)));
  couleurs.forEach((m, i) => g.add(boite(0.14, 0.14, 0.08, m, -1.8 + i * 0.9, 2.38, 0.2, 0.06)));
  arbre(g, -4, 2.6);
  arbre(g, 4.2, 2.8, 0.8);
  arbre(g, 3.6, -3, 1.2);
});
zone("chantiers", "Chantiers", "🏗️", 7.5, 6, ["Étude chaudronnerie · 40 %", "att"], [["Chantiers ouverts", "1"], ["Avancement", "40 %"], ["Dernière modif", "il y a 12 min"]], (g) => {
  for (let i = 0; i < 2; i++) g.add(boite(4.2, 0.14, 3.6, M.toit, 0, 0.18 + i * 1.1, -0.4, 0.05));
  for (const [x, z] of [[-1.9, -2], [1.9, -2], [-1.9, 1.2], [1.9, 1.2]] as [number, number][]) g.add(boite(0.18, 2.2, 0.18, M.corps, x, 0.18, z, 0.04));
  g.add(boite(4.2, 0.9, 3.6, M.corps, 0, 0.32, -0.4, 0.1));
  g.add(boite(0.26, 6.2, 0.26, M.accent, -3.4, 0.18, -2.6, 0.06));
  g.add(boite(5.6, 0.22, 0.22, M.accent, -1.2, 6.2, -2.6, 0.05));
  g.add(boite(0.9, 0.5, 0.5, M.toit, -4.4, 5.9, -2.6, 0.08));
  g.add(boite(0.7, 0.4, 0.5, M.lueur, 0.9, 4.2, -2.6, 0.06));
  arbre(g, 4.2, 3, 0.9);
});
zone("centrale", "Centrale", "⚡", 22, 0, ["Modèle coupé", "dort"], [["Carte graphique", "aucune"], ["Modèle", "Qwen 27B"], ["Contexte", "65 536"]], (g) => {
  g.add(boite(6, 2.6, 4.4, M.corps, -0.8, 0.18, 0, 0.25));
  for (let i = 0; i < 6; i++) g.add(boite(0.18, 0.5, 3.6, M.toit, -3 + i * 0.85, 2.78, 0, 0.04));
  for (const [x, h] of [[2.9, 5.6], [3.9, 4.6]] as [number, number][]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, h, 20), M.corps);
    c.position.set(x, 0.18 + h / 2, -0.8);
    c.castShadow = true;
    g.add(c);
    const bande = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.25, 20), M.accent);
    bande.position.set(x, h - 0.3, -0.8);
    g.add(bande);
  }
  for (let i = 0; i < 5; i++) g.add(boite(0.2, 0.2, 0.06, i < 2 ? M.froid : M.toit, -2.8 + i * 0.5, 1.6, 2.22, 0.05));
});
zone("atelier", "Atelier", "🛠️", -22, 0, ["Claude code", "ok"], [["Visiteur", "Claude"], ["Session", "Hameau"], ["Depuis", "02:10"]], (g) => {
  g.add(boite(6.4, 1.8, 4.2, M.corps, 0, 0.18, -0.4, 0.25));
  for (let i = 0; i < 3; i++) {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2.1, 0), new THREE.Vector2(2.1, 0.8)]);
    const t = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 4.2, bevelEnabled: false }), M.toit);
    t.position.set(-3.2 + i * 2.1, 1.98, -2.5);
    t.castShadow = true;
    g.add(t);
    g.add(boite(0.06, 0.7, 4, M.lueur, -1.12 + i * 2.1, 2.0, -0.4, 0.02));
  }
  for (let i = 0; i < 3; i++) g.add(boite(1, 0.6, 0.06, M.froid, -1.7 + i * 1.3, 0.9, 1.72, 0.04));
  arbre(g, 4.4, 2.6, 1.1);
  arbre(g, -4.4, 3, 0.9);
});
zone("maison", "Ta maison", "🏠", -22, -13, ["Tu es là", "ok"], [["Notes à faire", "3"], ["Écran", "allumé"], ["Activité", "immobile"]], (g) => {
  g.add(boite(4, 2, 3.4, M.corps, 0, 0.18, 0, 0.2));
  const shape = new THREE.Shape([new THREE.Vector2(-2, 0), new THREE.Vector2(2, 0), new THREE.Vector2(0, 1.6)]);
  const toit = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3.6, bevelEnabled: false }), M.accent);
  toit.position.set(0, 2.18, -1.8);
  toit.castShadow = true;
  g.add(toit);
  g.add(boite(1.4, 1, 0.08, M.vitre, -0.6, 0.8, 1.72, 0.04));
  g.add(boite(0.7, 1.2, 0.08, M.toit, 1.2, 0.18, 1.72, 0.04));
  arbre(g, 3.6, 2, 1);
  arbre(g, -3.8, -2.4, 1.2);
});
zone("cabane", "Cabane de Max", "🪨", -22, 13, ["Max dort 💤", "dort"], [["Réveil", "nouvelle carte graphique"], ["Rapports du soir", "20:00"], ["Personnalité", "pote ado"]], (g) => {
  g.add(boite(4.2, 1.7, 2.2, M.accent, 0, 0.18, 0, 0.12));
  for (let i = 0; i < 12; i++) g.add(boite(0.08, 1.6, 2.26, M.lueur, -1.9 + i * 0.35, 0.22, 0, 0.02));
  g.add(boite(1.6, 0.06, 1.2, M.froid, 0, 2.2, 0, 0.02));
  g.add(boite(2.6, 0.12, 1.4, M.toit, 0.4, 0.18, 2.1, 0.04));
  arbre(g, 3.4, -2.6, 1.1);
});

// ---------- flux de données (paquets qui circulent entre les zones) ----------
const flux: { courbe: THREE.CatmullRomCurve3; paquets: THREE.Mesh[] }[] = [];
function relier(a: string, b: string, n = 3): void {
  const A = zones.find((z) => z.id === a)!;
  const B = zones.find((z) => z.id === b)!;
  const milieu = new THREE.Vector3((A.x + B.x) / 2, 4.5, (A.z + B.z) / 2);
  const courbe = new THREE.CatmullRomCurve3([new THREE.Vector3(A.x, 2.6, A.z), milieu, new THREE.Vector3(B.x, 2.6, B.z)]);
  const ligne = new THREE.Line(new THREE.BufferGeometry().setFromPoints(courbe.getPoints(60)), new THREE.LineDashedMaterial({ color: P().accent, dashSize: 0.4, gapSize: 0.35, transparent: true, opacity: 0.6 }));
  ligne.computeLineDistances();
  ligne.userData.flux = true;
  scene.add(ligne);
  const paquets = Array.from({ length: n }, () => {
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.3, 0.42, 2, 0.08), M.lueur);
    p.castShadow = true;
    scene.add(p);
    return p;
  });
  flux.push({ courbe, paquets });
}
relier("courrier", "cerveau");
relier("cerveau", "chantiers", 2);
relier("tableau", "chantiers", 2);

// ---------- agents ----------
const max = new Personnage(habitant("max")!, new THREE.Vector3(-2, 0.05, 0));
const claude = new Personnage(habitant("claude-code-pc")!, new THREE.Vector3(-23.5, 0.2, 3.6));
claude.faire("ecrit", "code Hameau");
max.groupe.scale.setScalar(1.3);
claude.groupe.scale.setScalar(1.3);
scene.add(max.groupe, claude.groupe);
const devant = (id: string): [number, number] => { const d = DISPOSITION[id]!; return [d.x + Math.sin(d.r) * (d.p / 2 + 1.2), d.z + Math.cos(d.r) * (d.p / 2 + 1.2)]; };
const tournee: [number, number, string, Parameters<Personnage["faire"]>[0]][] = [
  [...devant("courrier"), "trie les mails", "trie"],
  [...devant("cerveau"), "lit 3 neurones", "lit"],
  [...devant("chantiers"), "avance l'étude", "travaille"],
  [...devant("tableau"), "relit les tâches", "regarde"],
];
async function vieDeMax(): Promise<void> {
  for (;;) {
    for (const [x, z, texte, geste] of tournee) {
      const ici = max.groupe.position;
      const dist = Math.hypot(x - ici.x, z - ici.z);
      await max.aller(new THREE.Vector3(x, 0.05, z), dist * 380, performance.now());
      max.faire(geste, texte);
      await new Promise((r) => setTimeout(r, 3200));
    }
  }
}
void vieDeMax();

// ---------- caméra : vol vers une zone, glisser, zoomer ----------
const cible = new THREE.Vector3(0, 0, 0);
const cibleVoulue = cible.clone();
let distance = 72;
let distanceVoulue = 72;
const DIRECTION = new THREE.Vector3(1, 0.95, 1).normalize();
function placerCamera(): void {
  camera.position.copy(cible).addScaledVector(DIRECTION, distance);
  camera.lookAt(cible);
}
function voler(x: number, z: number, d: number): void {
  cibleVoulue.set(x, 0, z);
  distanceVoulue = d;
}
let glisse: { x: number; y: number } | null = null;
let aGlisse = false;
canvas.addEventListener("pointerdown", (e) => ((glisse = { x: e.clientX, y: e.clientY }), (aGlisse = false)));
addEventListener("pointerup", (e) => {
  if (glisse && !aGlisse) choisir(viser(e.clientX, e.clientY));
  glisse = null;
});
canvas.addEventListener("pointermove", (e) => {
  if (!glisse) return;
  const dx = e.clientX - glisse.x;
  const dy = e.clientY - glisse.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) aGlisse = true;
  const k = distance * 0.0011;
  const droite = new THREE.Vector3(1, 0, -1).normalize();
  const avant = new THREE.Vector3(-1, 0, -1).normalize();
  cibleVoulue.addScaledVector(droite, -dx * k).addScaledVector(avant, dy * k * 1.4);
  cible.copy(cibleVoulue);
  glisse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("wheel", (e) => (e.preventDefault(), (distanceVoulue = Math.min(160, Math.max(22, distanceVoulue * Math.exp(e.deltaY * 0.0012))))), { passive: false });
document.getElementById("plus")!.onclick = () => (distanceVoulue = Math.max(22, distanceVoulue * 0.75));
document.getElementById("moins")!.onclick = () => (distanceVoulue = Math.min(160, distanceVoulue * 1.33));
document.getElementById("centre")!.onclick = () => (choisir(null), voler(0, 0, 72));

const rayon = new THREE.Raycaster();
function viser(x: number, y: number): Zone | null {
  rayon.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const t = rayon.intersectObjects(zones.map((z) => z.groupe), true)[0];
  return zones.find((z) => z.id === t?.object.userData.zone) ?? null;
}

// ---------- sélection : halo, fiche, vol ----------
const halo = new THREE.Mesh(new THREE.RingGeometry(6.2, 6.6, 64), new THREE.MeshBasicMaterial({ color: P().accent, transparent: true, opacity: 0.9 }));
halo.rotation.x = -Math.PI / 2;
halo.visible = false;
scene.add(halo);
let choisie: Zone | null = null;
const fiche = document.getElementById("fiche")!;
function choisir(z: Zone | null): void {
  choisie = z;
  halo.visible = !!z;
  if (!z) {
    fiche.hidden = true;
    return;
  }
  halo.position.set(z.x, 0.3, z.z);
  voler(z.x, z.z, 46);
  (document.getElementById("zone-nom") as HTMLElement).textContent = `${z.emoji} ${z.nom}`;
  fiche.innerHTML = `<h3>${z.emoji} ${z.nom}</h3><span class="chip ${z.etat[1]}">● ${z.etat[0]}</span>${
    z.avancement !== undefined ? `<div class="barre"><i style="width:${z.avancement}%"></i></div>` : ""
  }<div class="lignes">${z.infos.map(([a, b]) => `<div class="ligne"><span>${a}</span><b>${b}</b></div>`).join("")}</div><button class="bouton">Ouvrir ${z.nom} →</button>`;
  fiche.hidden = false;
}
zones.find((z) => z.id === "chantiers")!.avancement = 40;

// sélecteur de zones (vue du réseau)
const reseau = document.getElementById("reseau")!;
reseau.innerHTML = zones.map((z) => `<button data-z="${z.id}"><span>${z.emoji}</span><span><b>${z.nom}</b><small>${z.etat[0]}</small></span><span class="chip ${z.etat[1]}">●</span></button>`).join("");
document.getElementById("zone")!.onclick = () => (reseau.hidden = !reseau.hidden);
reseau.onclick = (e) => {
  const id = (e.target as HTMLElement).closest("button")?.dataset.z;
  reseau.hidden = true;
  choisir(zones.find((z) => z.id === id) ?? null);
};

// tableau du bas
const LISTES: Record<string, [string, string, string, string][]> = {
  agents: [["🪨 Max", "Assistant · habitant", "Endormi", "dort"], ["✴️ Claude", "Visiteur · Claude Code", "Au travail", "ok"]],
  taches: [["Trier les mails", "Routine · 8 h", "En cours", "info"], ["Étude chaudronnerie", "Expédition · 10 jours", "40 %", "att"], ["Bilan du téléphone", "Routine · 20 h", "Prévue", "dort"]],
  courrier: [["Tri des mails · terminé", "Rapport de tâche · Max", "1 question", "att"], ["Rapport du soir décalé", "Décision · Max", "À lire", "info"]],
};
const liste = document.getElementById("liste") ?? document.createElement("div");
const remplir = (o: string) => (liste.innerHTML = LISTES[o]!.map(([a, b, c, d]) => `<div class="rangee"><span><b>${a}</b><small>${b}</small></span><span class="chip ${d}">${c}</span><span>›</span></div>`).join(""));
(document.getElementById("onglets") ?? document.createElement("div")).onclick = (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  document.querySelectorAll("#onglets button").forEach((x) => x.classList.toggle("on", x === b));
  remplir(b.dataset.o!);
};
remplir("agents");

document.getElementById("theme")!.onclick = () => {
  theme = theme === "sombre" ? "clair" : "sombre";
  appliquerTheme();
};
appliquerTheme();
if (new URLSearchParams(location.search).get("theme") === "clair") document.getElementById("theme")!.click();
const zoneDemandee = new URLSearchParams(location.search).get("zone");
if (zoneDemandee) choisir(zones.find((z) => z.id === zoneDemandee) ?? null);

// ---------- étiquettes flottantes ----------
const tags = document.getElementById("tags")!;
let survol: { zone?: Zone; agent?: Personnage } | null = null;
canvas.addEventListener("mousemove", (e) => {
  if (glisse) return;
  rayon.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const agent = [max, claude].find((a) => rayon.intersectObject(a.groupe, true).length > 0);
  const zone = agent ? undefined : viser(e.clientX, e.clientY) ?? undefined;
  survol = agent ? { agent } : zone ? { zone } : null;
  canvas.style.cursor = survol ? "pointer" : "grab";
});
function etiquettes(): void {
  const ecran = (v: THREE.Vector3) => {
    const p = v.clone().project(camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight, devant: p.z < 1 };
  };
  const couleurs: Record<string, string> = { ok: "var(--ok)", att: "var(--attente)", info: "var(--info)", dort: "var(--doux)" };
  let html = "";
  for (const z of zones) {
    if (survol?.zone !== z && choisie !== z) continue;
    const p = ecran(new THREE.Vector3(z.x, 7.2, z.z));
    html += `<div class="tag" style="left:${p.x}px;top:${p.y}px"><span class="pt" style="background:${couleurs[z.etat[1]]}"></span>${z.emoji} ${z.nom}</div>`;
  }
  for (const a of [max, claude]) {
    if (survol?.agent !== a) continue;
    const p = ecran(a.tete().add(new THREE.Vector3(0, 1.4, 0)));
    html += `<div class="tag agent" style="left:${p.x}px;top:${p.y}px">${a.qui.nom} · ${a.etat === "marche" ? "en route" : a.texte}</div>`;
  }
  tags.innerHTML = html;
}

function taille(): void {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", taille);
taille();

let image = 0;
function boucle(t: number): void {
  cible.lerp(cibleVoulue, 0.06);
  distance += (distanceVoulue - distance) * 0.06;
  placerCamera();
  max.animer(t);
  claude.animer(t);
  for (const f of flux) f.paquets.forEach((p, i) => p.position.copy(f.courbe.getPointAt(((t / 5200 + i / f.paquets.length) % 1))).setY(p.position.y + Math.sin(t / 300 + i) * 0.05));
  for (const z of zones) z.groupe.traverse((o) => o.userData.anneau !== undefined && (o.position.y = 1.2 + o.userData.anneau * 0.7 + Math.sin(t / 700 + o.userData.anneau) * 0.06));
  halo.scale.setScalar(1 + Math.sin(t / 400) * 0.015);
  renderer.render(scene, camera);
  if (image++ % 2 === 0) etiquettes();
  document.getElementById("heure")!.textContent = `En direct ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);

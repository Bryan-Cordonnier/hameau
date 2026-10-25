// Les zones de l'open space et leur mobilier (coordonnées locales à chaque zone, depuis son coin nord-ouest ; z vers nous).
// Au fond : le bureau vitré du boss (Max), les archives du cerveau, la salle de réunion vitrée, la petite salle serveur.
// Au milieu : l'accueil-courrier, le plateau de développement, l'atelier de test. Devant : le mur des tâches, le coin pause.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Bureau, Piece } from "./bureau";

const PI = Math.PI;

export const PIECES: Piece[] = [
  { id: "boss", nom: "Bureau du boss", emoji: "🟣", teinte: "#b65cf0", x0: -13, x1: -7.5, z0: -8, z1: -3.6, sol: "parquet", murs: "vitre", porte: { cote: "est", a: 3.3 }, postes: [{ x: 2.75, z: 0.5, cap: 0 }, { x: 0.75, z: 2.9, cap: PI / 2 }] },
  { id: "archives", nom: "Archives (cerveau)", emoji: "🧠", teinte: "#9a8cff", x0: -6.6, x1: 1.4, z0: -8, z1: -4.2, sol: "beton", postes: [{ x: 6.6, z: 2.35, cap: 0 }, { x: 4, z: 2.6, cap: PI }] },
  { id: "reunion", nom: "Salle de réunion", emoji: "🏗️", teinte: "#5fd18a", x0: 2.4, x1: 8.4, z0: -8, z1: -3.8, sol: "moquette", murs: "vitre", porte: { cote: "sud", a: 1.2 }, postes: [{ x: 2.1, z: 1.25, cap: 0 }, { x: 5.2, z: 2.1, cap: -PI / 2 }] },
  { id: "serveur", nom: "Salle serveur", emoji: "⚡", teinte: "#46c8b4", x0: 8.6, x1: 13, z0: -8, z1: -4.4, sol: "beton", murs: "plein", porte: { cote: "sud", a: 2.2 }, postes: [{ x: 1.15, z: 1.6, cap: PI }] },
  { id: "secretariat", nom: "Accueil et courrier", emoji: "✉️", teinte: "#f2c14e", x0: -13, x1: -8, z0: -2.4, z1: 8, sol: "moquette", postes: [{ x: 2.6, z: 1.65, cap: 0 }, { x: 1.05, z: 5, cap: -PI / 2 }] },
  { id: "dev", nom: "Plateau de développement", emoji: "💻", teinte: "#5b9dff", x0: -6.4, x1: 3.2, z0: -2.6, z1: 2.8, sol: "parquet", postes: [{ x: 3, z: 1.95, cap: 0 }, { x: 4.2, z: 1.95, cap: 0 }, { x: 5.4, z: 3.85, cap: PI }, { x: 3, z: 3.85, cap: PI }] },
  { id: "atelier", nom: "Atelier de test", emoji: "🧪", teinte: "#ffb347", x0: 4.6, x1: 13, z0: -2.6, z1: 2.4, sol: "beton", postes: [{ x: 4.2, z: 1.45, cap: PI }, { x: 7.2, z: 3, cap: PI / 2 }] },
  { id: "taches", nom: "Mur des tâches", emoji: "📌", teinte: "#ff8a66", x0: -6.4, x1: 3.6, z0: 4.2, z1: 8, sol: "moquette", postes: [{ x: 4.6, z: 1.3, cap: PI }, { x: 7.6, z: 2.6, cap: PI }] },
  { id: "pause", nom: "Coin pause", emoji: "☕", teinte: "#ff7fa8", x0: 5.6, x1: 13, z0: 3.8, z1: 8, sol: "parquet", postes: [{ x: 6.3, z: 1.5, cap: PI / 2 }, { x: 0.75, z: 2.1, cap: PI / 2 }] },
];

const box = (l: number, h: number, p: number, m: THREE.Material, x: number, y: number, z: number, r = 0.04) => {
  const b = new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 2, Math.min(r, l / 2, h / 2, p / 2)), m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = b.receiveShadow = true;
  return b;
};
const tourne = (o: THREE.Object3D, x: number, z: number, cap: number) => {
  o.position.set(x, 0, z);
  o.rotation.y = cap;
  return o;
};

/** Un canapé dont l'assise regarde vers +z (local). */
function canape(m: THREE.Material, l = 2): THREE.Group {
  const g = new THREE.Group();
  g.add(box(l, 0.36, 0.8, m, 0, 0, 0, 0.14), box(l, 0.46, 0.22, m, 0, 0.3, -0.31, 0.09));
  for (const s of [-1, 1]) g.add(box(0.2, 0.52, 0.8, m, s * (l / 2 - 0.1), 0, 0, 0.09));
  return g;
}

const LIVRES = ["#c9a27c", "#8a8f99", "#5b7fa8", "#b5655a", "#6f9a7a", "#d8c9a8"];

type Meubler = (g: THREE.Group, b: Bureau, p: Piece, t: THREE.MeshStandardMaterial) => void;

export const MEUBLER: Record<string, Meubler> = {
  boss(g, b, _p, t) {
    // grand bureau, fauteuil, écran, trophée violet (la seule touche de Max), canapé, table basse, bibliothèque
    g.add(box(2, 0.08, 0.9, b.M.bois, 2.75, 0.62, 1.1, 0.03));
    for (const dx of [-0.9, 0.9]) g.add(box(0.12, 0.62, 0.8, b.M.bois, 2.75 + dx, 0, 1.1, 0.02));
    g.add(box(0.5, 0.32, 0.04, b.M.meuble, 2.35, 0.7, 1.3, 0.01), box(0.46, 0.28, 0.01, b.M.ecran, 2.35, 0.72, 1.27, 0.005));
    const fauteuil = new THREE.Group();
    fauteuil.add(box(0.6, 0.1, 0.55, b.M.meuble, 0, 0.34, 0, 0.05), box(0.6, 0.66, 0.14, b.M.meuble, 0, 0.4, -0.27, 0.06));
    g.add(tourne(fauteuil, 2.75, 0.4, 0));
    g.add(box(0.12, 0.24, 0.12, t, 3.45, 0.7, 1.05, 0.04));
    g.add(tourne(canape(b.M.tissu), 0.55, 2.9, PI / 2), box(0.5, 0.3, 0.9, b.M.bois, 1.5, 0, 2.9, 0.04));
    b.etagere(g, 4.6, 0.25, 1.4, 0, LIVRES);
    b.plante(g, 0.4, 0.4, 1);
    b.plante(g, 5.05, 3.95, 0.9);
  },
  archives(g, b, _p, t) {
    // rayonnages contre le mur du fond, le terminal du cerveau (colonne aux anneaux lumineux), table de lecture
    b.etagere(g, 1.9, 0.25, 3, 0, LIVRES);
    b.etagere(g, 6, 0.25, 3, 0, LIVRES.slice(2).concat(LIVRES.slice(0, 2)));
    b.etagere(g, 0.25, 2.4, 2.4, PI / 2, LIVRES.slice(4).concat(LIVRES.slice(0, 4)));
    const colonne = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 1.3, 32), b.M.meuble);
    colonne.position.set(4, 0.65, 1.8);
    colonne.castShadow = true;
    g.add(colonne);
    for (let i = 0; i < 3; i++) {
      const a = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.03, 8, 40), i === 1 ? b.M.lampe : b.M.ecran);
      a.rotation.x = PI / 2;
      a.position.set(4, 0.35 + i * 0.4, 1.8);
      g.add(a);
      b.animer((s) => (a.position.y = 0.35 + i * 0.4 + Math.sin(s / 600 + i) * 0.04));
    }
    g.add(box(1.3, 0.06, 0.7, b.M.bois, 6.6, 0.55, 2.9, 0.02));
    for (const dx of [-0.55, 0.55]) g.add(box(0.06, 0.55, 0.6, b.M.meuble, 6.6 + dx, 0, 2.9, 0.01));
    g.add(box(0.3, 0.05, 0.22, t, 6.35, 0.61, 2.8, 0.01));
    b.plante(g, 7.6, 3.4, 0.9);
  },
  reunion(g, b) {
    // table de réunion, six chaises, grand écran au fond
    g.add(box(3.2, 0.08, 1.2, b.M.bois, 3.1, 0.62, 2.1, 0.05));
    for (const dx of [-1.3, 1.3]) g.add(box(0.12, 0.62, 0.9, b.M.meuble, 3.1 + dx, 0, 2.1, 0.02));
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) g.add(tourne(b.chaise(0, 0), 2.1 + i, 2.1 + s * 0.85, s > 0 ? 0 : PI));
    g.add(box(2.4, 1.3, 0.1, b.M.meuble, 3.1, 0.1, 0.2, 0.04), box(2.2, 1.1, 0.02, b.M.ecran, 3.1, 0.2, 0.26, 0.01));
    b.plante(g, 5.6, 0.4, 0.9);
  },
  serveur(g, b) {
    // baies de serveurs, voyants qui clignotent (éteints quand le modèle dort), onduleur
    const leds: THREE.Mesh[] = [];
    for (const x of [0.6, 1.5, 2.9, 3.8]) {
      const baie = new THREE.Group();
      baie.add(box(0.8, 1.6, 0.9, b.M.meuble, 0, 0, 0, 0.03));
      for (let k = 0; k < 9; k++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: "#5bc2ff", emissive: "#5bc2ff", roughness: 0.3 }));
        led.position.set(0, 0.2 + k * 0.15, 0.46);
        baie.add(led);
        leds.push(led);
      }
      g.add(tourne(baie, x, 0.6, 0));
    }
    b.animer((s) => {
      leds.forEach((l, i) => {
        const m = l.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = b.serveurAllume ? (b.theme === "sombre" ? 1 : 0.4) * (Math.sin(s / 120 + i * 2.3) > 0.2 ? 1 : 0.25) : 0.02;
      });
    });
    g.add(box(0.9, 0.6, 0.5, b.M.meubleClair, 3.7, 0, 2.9, 0.05));
  },
  secretariat(g, b, _p, t) {
    // accueil avec bannettes, casiers à courrier contre le mur, sacs postaux, un second poste, armoires
    b.bureauEcran(g, 2.6, 2.2, 0, 1);
    for (let i = 0; i < 3; i++) g.add(box(0.36, 0.06, 0.26, i === 0 ? t : b.M.meubleClair, 3.05, 0.56 + i * 0.1, 2.25, 0.02));
    const casiers = new THREE.Group();
    casiers.add(box(2, 1.3, 0.35, b.M.bois, 0, 0, 0, 0.02));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) casiers.add(box(0.32, 0.3, 0.05, (i + j) % 4 === 0 ? t : b.M.meubleClair, -0.76 + i * 0.38, 0.12 + j * 0.4, 0.17, 0.02));
    g.add(tourne(casiers, 0.25, 5, PI / 2));
    const toile = new THREE.MeshStandardMaterial({ color: "#c9a27c", roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const sac = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), toile);
      sac.scale.set(1, 0.85, 1);
      sac.position.set(0.5 + (i % 2) * 0.5, 0.24, 8.4 + Math.floor(i / 2) * 0.5);
      sac.castShadow = true;
      g.add(sac);
    }
    b.bureauEcran(g, 3.4, 6.6, 0, 1);
    for (const z of [9.3, 9.9]) g.add(box(0.6, 1.1, 0.5, b.M.meuble, 4.5, 0, z, 0.03));
    b.plante(g, 4.6, 0.4, 1);
  },
  dev(g, b) {
    // un îlot de six postes face à face, un tableau blanc, une tour de calcul
    for (const x of [3, 4.2, 5.4]) {
      b.bureauEcran(g, x, 2.5, 0, 2);
      b.bureauEcran(g, x, 3.3, PI, 2);
    }
    const tableau = new THREE.Group();
    tableau.add(box(2, 1.1, 0.06, b.M.meubleClair, 0, 0.35, 0, 0.02));
    for (let i = 0; i < 6; i++) tableau.add(box(0.25 + (i % 3) * 0.15, 0.03, 0.01, b.M.meuble, -0.6 + (i % 3) * 0.6, 0.65 + Math.floor(i / 3) * 0.4, 0.035, 0.005));
    for (const dx of [-0.9, 0.9]) tableau.add(box(0.05, 0.35, 0.4, b.M.meuble, dx, 0, 0, 0.01));
    g.add(tourne(tableau, 8.4, 2.9, -PI / 2));
    g.add(box(0.5, 0.9, 0.5, b.M.meuble, 8.8, 0, 0.5, 0.03));
    b.plante(g, 0.5, 0.5, 1);
    b.plante(g, 9, 4.9, 0.9);
  },
  atelier(g, b, _p, t) {
    // établi avec oscilloscope, deux bancs d'essai à voyants, étagère métal, caisses
    g.add(box(3, 0.08, 0.8, b.M.bois, 4.6, 0.7, 0.8, 0.02));
    for (const dx of [-1.4, 1.4]) g.add(box(0.1, 0.7, 0.7, b.M.meuble, 4.6 + dx, 0, 0.8, 0.01));
    g.add(box(0.6, 0.4, 0.4, b.M.meuble, 4, 0.78, 0.65, 0.03), box(0.5, 0.3, 0.02, b.M.ecranVert, 4, 0.82, 0.86, 0.01));
    g.add(box(0.3, 0.12, 0.2, t, 5.3, 0.78, 0.8, 0.03));
    for (let i = 0; i < 2; i++) {
      const banc = new THREE.Group();
      banc.add(box(0.7, 1.3, 0.6, b.M.meuble, 0, 0, 0, 0.04));
      for (let k = 0; k < 6; k++) banc.add(box(0.08, 0.08, 0.02, k % 3 === 2 ? b.M.voyantRouge : b.M.ecranVert, -0.2 + (k % 3) * 0.2, 0.4 + Math.floor(k / 3) * 0.45, 0.31, 0.02));
      g.add(tourne(banc, 8.05, 2.4 + i * 1.3, -PI / 2));
    }
    b.etagere(g, 0.25, 2.4, 2.2, PI / 2, ["#8a8f99", "#6b6f78", "#a7abb3"]);
    for (let i = 0; i < 3; i++) g.add(box(0.5, 0.35, 0.45, i === 1 ? t : b.M.bois, 1.6 + (i % 2) * 0.55, i === 2 ? 0.35 : 0, 4.4, 0.04));
  },
  taches(g, b) {
    // le grand tableau de liège avec ses post-it, une table haute pour les points debout
    const mur = new THREE.Group();
    mur.add(box(4.4, 1.3, 0.08, new THREE.MeshStandardMaterial({ color: "#b8956a", roughness: 0.9 }), 0, 0.15, 0, 0.02));
    for (const dx of [-2, 2]) mur.add(box(0.06, 0.15, 0.5, b.M.meuble, dx, 0, 0, 0.01));
    const couleurs = ["#f2c14e", "#ff8fb1", "#7fb7ff", "#7fdca0", "#ffb347", "#f2c14e", "#7fb7ff", "#ff8fb1", "#7fdca0", "#ffb347", "#f2c14e", "#7fb7ff"];
    couleurs.forEach((c, i) => mur.add(box(0.36, 0.36, 0.02, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), -1.6 + (i % 4) * 1.05, 0.32 + Math.floor(i / 4) * 0.4, 0.05, 0.01)));
    g.add(tourne(mur, 4.6, 0.35, 0));
    g.add(box(0.9, 0.04, 0.9, b.M.bois, 7.6, 1, 1.9, 0.03), box(0.1, 1, 0.1, b.M.meuble, 7.6, 0, 1.9, 0.02));
    b.plante(g, 0.5, 3.3, 1.1);
    b.plante(g, 9.5, 0.5, 0.9);
  },
  pause(g, b) {
    // comptoir avec machine à café et tasses, canapé, table basse, table ronde et tabourets
    const comptoir = new THREE.Group();
    comptoir.add(box(2.6, 0.9, 0.6, b.M.meubleClair, 0, 0, 0, 0.03));
    comptoir.add(box(0.5, 0.6, 0.45, b.M.meuble, -0.7, 0.9, -0.05, 0.05), box(0.2, 0.08, 0.02, b.M.lampe, -0.7, 1.25, 0.18, 0.01));
    ["#ffffff", "#ff8fb1", "#f2c14e"].forEach((c, i) => comptoir.add(box(0.1, 0.12, 0.1, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), 0.1 + i * 0.25, 0.9, 0, 0.02)));
    g.add(tourne(comptoir, 6.95, 1.8, -PI / 2));
    g.add(tourne(canape(b.M.tissu), 0.55, 2.1, PI / 2), box(0.5, 0.3, 0.9, b.M.bois, 1.5, 0, 2.1, 0.04));
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32), b.M.bois);
    table.position.set(4, 0.72, 2.2);
    table.castShadow = true;
    g.add(table, box(0.08, 0.72, 0.08, b.M.meuble, 4, 0, 2.2, 0.02));
    for (const [dx, dz] of [[-0.75, 0], [0.75, 0], [0, 0.75]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.48, 20), b.M.tissu);
      t.position.set(4 + dx!, 0.24, 2.2 + dz!);
      t.castShadow = true;
      g.add(t);
    }
    b.plante(g, 7, 3.7, 1);
  },
};

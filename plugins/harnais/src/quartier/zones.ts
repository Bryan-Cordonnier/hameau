// Les zones du quartier (place, taille, orientation, couleur secondaire), le tracé des routes, et les bâtiments.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Quartier, ZoneDef } from "./quartier";
import { decouper, germe, interieur, placer, type Besoin } from "./disposition";
import type { Pt } from "./reseau";

/** Le terrain découpé au hasard (germe fixe : le quartier est toujours le même). */
const DECOUPE = decouper({ x0: -42, z0: -30, x1: 42, z1: 30, rues: { n: false, s: false, o: false, e: false } }, germe(2026), 14);

/** Ce que chaque zone demande (largeur, profondeur minimales de sa parcelle). */
const BESOINS: (Besoin & { nom: string; emoji: string; teinte: string })[] = [
  { id: "centrale", nom: "Centrale", emoji: "⚡", teinte: "#46c8b4", l: 11, p: 6 },
  { id: "cerveau", nom: "Cerveau", emoji: "🧠", teinte: "#6fa8ff", l: 10, p: 8.5 },
  { id: "courrier", nom: "Courrier", emoji: "✉️", teinte: "#f2c14e", l: 8.5, p: 6.5 },
  { id: "chantiers", nom: "Chantiers", emoji: "🏗️", teinte: "#ffb347", l: 9, p: 6 },
  { id: "atelier", nom: "Atelier", emoji: "🛠️", teinte: "#a98bff", l: 7.5, p: 5.5 },
  { id: "maison", nom: "Ta maison", emoji: "🏠", teinte: "#ff7fa8", l: 7, p: 6 },
  { id: "tableau", nom: "Tableau", emoji: "📌", teinte: "#ff8a66", l: 6, p: 4 },
  { id: "cabane", nom: "Cabane de Max", emoji: "🪨", teinte: "#ff8a66", l: 6, p: 4.5 },
];
const POSE = placer(DECOUPE.ilots, BESOINS);

export const ZONES: ZoneDef[] = POSE.places.map((p) => {
  const b = BESOINS.find((x) => x.id === p.id)!;
  return { id: p.id, nom: b.nom, emoji: b.emoji, teinte: b.teinte, x: p.x, z: p.z, l: p.l, p: p.p, r: p.r };
});

export const SEGMENTS = DECOUPE.segments;

/** Les îlots sans zone : parcs, places, jardins, terrains de sport, parkings. */
export const PARCS = POSE.restes.map((r, n) => {
  const c = interieur(r);
  const genres = ["parc", "place", "jardin", "parking", "parc", "terrain", "place", "jardin"] as const;
  return { genre: genres[n % genres.length]!, x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, l: c.x1 - c.x0, p: c.z1 - c.z0 };
});

/** Les rues, pour le graphe des déplacements. */
export const ROUTES: Pt[][] = SEGMENTS.map((s) => [
  [s.x1, s.z1],
  [s.x2, s.z2],
]);

const box = (l: number, h: number, p: number, m: THREE.Material, x: number, y: number, z: number, r = 0.12) => {
  const b = new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 3, Math.min(r, l / 2, h / 2, p / 2)), m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = b.receiveShadow = true;
  return b;
};

type Batir = (g: THREE.Group, q: Quartier, t: THREE.MeshStandardMaterial) => void;

export const BATIR: Record<string, Batir> = {
  courrier(g, q, t) {
    const M = q.M;
    g.add(box(7.4, 2.4, 4.2, M.corps, 0, 0.2, -0.9, 0.25));
    g.add(box(7.6, 0.25, 4.4, M.toit, 0, 2.6, -0.9, 0.12));
    for (let i = 0; i < 4; i++) {
      g.add(box(1.15, 1.5, 0.1, i === 1 ? M.lueur : t, -2.6 + i * 1.75, 0.2, 1.22, 0.05));
      g.add(box(1.35, 0.12, 0.6, M.toit, -2.6 + i * 1.75, 1.85, 1.45, 0.04));
    }
    // enseigne : une grande enveloppe sur la façade
    g.add(box(1.4, 0.9, 0.1, M.toit, 2.4, 1.55, -3.05, 0.05));
    for (let i = 0; i < 6; i++) g.add(box(0.5, 0.34, 0.38, i % 2 ? t : M.corps, 2.7 + (i % 3) * 0.55, 0.2 + Math.floor(i / 3) * 0.36, 2.7, 0.06));
    q.arbre(g, -4.9, 3, 0.9);
    q.banc(g, -2.6, 3.2, 0);
  },
  cerveau(g, q, t) {
    const M = q.M;
    g.add(box(4.8, 0.7, 4.8, M.corps, 0, 0.2, 0, 0.35));
    const tour = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 4.6, 40), M.corps);
    tour.position.set(0, 0.9 + 2.3, 0);
    tour.castShadow = tour.receiveShadow = true;
    g.add(tour);
    for (let i = 0; i < 6; i++) {
      const anneau = new THREE.Mesh(new THREE.TorusGeometry(1.6 - i * 0.02, 0.06, 10, 64), i === 3 ? M.lueur : t);
      anneau.rotation.x = Math.PI / 2;
      anneau.position.set(0, 1.35 + i * 0.72, 0);
      g.add(anneau);
      q.animer(anneau, (o, s) => (o.position.y = 1.35 + i * 0.72 + Math.sin(s / 700 + i) * 0.06));
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.45, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.toit);
    dome.position.y = 5.5;
    dome.castShadow = true;
    g.add(dome);
    for (const [sx, sz] of [[-3.7, 2.6], [3.7, 2.8], [3.5, -3]] as [number, number][]) {
      g.add(box(1.5, 1.1, 1.5, M.corps, sx, 0.2, sz, 0.35));
      g.add(box(1.52, 0.12, 1.52, t, sx, 1.0, sz, 0.05));
      const l = Math.hypot(sx, sz) - 1.9;
      const lien = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, l, 8), t);
      lien.position.set(sx / 2, 0.65, sz / 2);
      lien.rotation.z = Math.PI / 2;
      lien.rotation.y = -Math.atan2(sz, sx);
      g.add(lien);
    }
  },
  tableau(g, q, t) {
    const M = q.M;
    for (const x of [-2.3, 2.3]) g.add(box(0.22, 3.3, 0.22, M.toit, x, 0.2, 0, 0.05));
    g.add(box(5.2, 2.4, 0.25, M.corps, 0, 1.25, 0, 0.12));
    const couleurs = [t, M.froid, M.lueur, t, M.froid];
    couleurs.forEach((m, i) => {
      g.add(box(0.82, 0.9, 0.06, M.parcelle, -1.84 + i * 0.92, 1.6 + (i % 2) * 0.12, 0.16, 0.03));
      g.add(box(0.14, 0.14, 0.08, m, -1.84 + i * 0.92, 2.42 + (i % 2) * 0.12, 0.2, 0.06));
    });
    q.banc(g, -1.5, 1.8, Math.PI);
    q.banc(g, 1.5, 1.8, Math.PI);
    q.arbre(g, 3.3, -1.8, 1.1);
  },
  chantiers(g, q, t) {
    const M = q.M;
    for (let i = 0; i < 2; i++) g.add(box(4.2, 0.14, 3.6, M.toit, 0, 0.2 + i * 1.1, -0.4, 0.05));
    for (const [x, z] of [[-1.9, -2], [1.9, -2], [-1.9, 1.2], [1.9, 1.2]] as [number, number][]) g.add(box(0.18, 2.3, 0.18, M.corps, x, 0.2, z, 0.04));
    g.add(box(4.2, 0.9, 3.6, M.corps, 0, 0.34, -0.4, 0.1));
    g.add(box(0.26, 6.4, 0.26, t, -3.4, 0.2, -2.8, 0.06));
    const fleche = new THREE.Group();
    fleche.add(box(5.6, 0.22, 0.22, t, 2.2, 0, 0, 0.05));
    fleche.add(box(0.9, 0.5, 0.5, M.toit, -1, -0.15, 0, 0.08));
    fleche.add(box(0.7, 0.4, 0.5, M.lueur, 3.6, -1.6, 0, 0.06));
    fleche.position.set(-3.4, 6.4, -2.8);
    g.add(fleche);
    q.animer(fleche, (o, s) => (o.rotation.y = Math.sin(s / 4000) * 0.6));
    q.arbre(g, 4.1, 3, 0.9);
  },
  centrale(g, q, t) {
    const M = q.M;
    g.add(box(6.2, 2.7, 4.4, M.corps, -0.9, 0.2, 0, 0.25));
    for (let i = 0; i < 6; i++) g.add(box(0.18, 0.5, 3.6, M.toit, -3.1 + i * 0.85, 2.9, 0, 0.04));
    for (const [x, h] of [[3, 5.8], [4, 4.8]] as [number, number][]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, h, 24), M.corps);
      c.position.set(x, 0.2 + h / 2, -0.8);
      c.castShadow = true;
      g.add(c);
      const bande = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 24), t);
      bande.position.set(x, h - 0.3, -0.8);
      g.add(bande);
    }
    for (let i = 0; i < 6; i++) g.add(box(0.2, 0.2, 0.06, i < 2 ? t : M.toit, -3 + i * 0.5, 1.7, 2.22, 0.05));
    const parabole = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), M.toit);
    parabole.position.set(-2.8, 3.4, -1);
    parabole.rotation.x = -0.6;
    g.add(parabole);
    q.animer(parabole, (o, s) => (o.rotation.z = Math.sin(s / 3000) * 0.8));
  },
  atelier(g, q, t) {
    const M = q.M;
    g.add(box(6.4, 1.9, 4.2, M.corps, 0, 0.2, -0.4, 0.25));
    for (let i = 0; i < 3; i++) {
      const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(2.1, 0), new THREE.Vector2(2.1, 0.8)]);
      const toit = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 4.2, bevelEnabled: false }), M.toit);
      toit.position.set(-3.2 + i * 2.1, 2.1, -2.5);
      toit.castShadow = true;
      g.add(toit);
      g.add(box(0.06, 0.7, 4, t, -1.12 + i * 2.1, 2.12, -0.4, 0.02));
    }
    for (let i = 0; i < 3; i++) g.add(box(1, 0.62, 0.06, M.froid, -1.7 + i * 1.3, 0.95, 1.72, 0.04));
    q.arbre(g, 4.2, 2.7, 1.1);
  },
  maison(g, q, t) {
    const M = q.M;
    g.add(box(4, 2.1, 3.4, M.corps, 0, 0.2, 0, 0.2));
    const shape = new THREE.Shape([new THREE.Vector2(-2.1, 0), new THREE.Vector2(2.1, 0), new THREE.Vector2(0, 1.6)]);
    const toit = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3.7, bevelEnabled: false }), t);
    toit.position.set(0, 2.3, -1.85);
    toit.castShadow = true;
    g.add(toit);
    g.add(box(1.4, 1, 0.08, M.vitre, -0.6, 0.85, 1.72, 0.04));
    g.add(box(0.7, 1.25, 0.08, M.toit, 1.2, 0.2, 1.72, 0.04));
    for (let x = -3.4; x <= 3.4; x += 0.5) g.add(box(0.08, 0.5, 0.08, M.toit, x, 0.2, 3.1, 0.02));
    q.arbre(g, 2.9, -2.4, 1.2);
  },
  cabane(g, q, t) {
    const M = q.M;
    g.add(box(4.2, 1.7, 2.2, t, 0, 0.2, -0.4, 0.12));
    for (let i = 0; i < 12; i++) g.add(box(0.08, 1.62, 2.26, M.toit, -1.9 + i * 0.35, 0.24, -0.4, 0.02));
    g.add(box(1.6, 0.06, 1.2, M.froid, 0, 2.22, -0.4, 0.02));
    g.add(box(2.6, 0.12, 1.3, M.toit, 0.4, 0.2, 1.4, 0.04));
    q.arbre(g, -2.6, 1.8, 0.9);
  },
};

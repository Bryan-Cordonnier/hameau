// Les bâtiments de l'île, en low poly façon jouet (échelle volontairement fausse) : architecture classique pour ce qui est
// « institution » (bibliothèque, mairie, poste, ta maison), industrielle pour ce qui « fabrique » (atelier, centrale,
// port). Chacun a un vrai intérieur : au survol, le toit s'enlève et les murs deviennent transparents.
import * as THREE from "three";

export const mat = (couleur: string | number, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: couleur, flatShading: true, roughness: 0.8, metalness: 0.04, ...o });

const ACIER = mat("#5d6873", { metalness: 0.35, roughness: 0.55 });
const ACIER_CLAIR = mat("#b5bec8", { metalness: 0.3, roughness: 0.5 });
const PIERRE = mat("#e9e1d2");
const PIERRE_SOMBRE = mat("#cfc4b0");
const BOIS = mat("#9a744b");
const BOIS_SOMBRE = mat("#6e4f33");
const PARQUET = mat("#d8b98a");

export interface Construction {
  murs: THREE.MeshStandardMaterial[];
  /** Le toit : caché au survol pour voir dedans. */
  toit: THREE.Group;
  vitres: THREE.MeshStandardMaterial[];
  /** Petites lumières qui clignotent (serveurs, écrans). */
  voyants: THREE.MeshStandardMaterial[];
  fumees: THREE.Mesh[];
  hauteur: number;
  /** Où se tient un visiteur, dans le repère du bâtiment. */
  porte: [number, number];
}

const nouvelle = (): Construction => ({ murs: [], toit: new THREE.Group(), vitres: [], voyants: [], fumees: [], hauteur: 2, porte: [0, 2] });

const boite = (g: THREE.Object3D, l: number, h: number, p: number, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(l, h, p), m);
  b.position.set(x, y + h / 2, z);
  b.rotation.y = ry;
  g.add(b);
  return b;
};
const cylindre = (g: THREE.Object3D, r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, cotes = 12, r2 = r) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, cotes), m);
  c.position.set(x, y + h / 2, z);
  g.add(c);
  return c;
};
const vitre = (c: Construction) => {
  const v = mat("#a9d4e8", { emissive: "#ffcf73", emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.85 });
  c.vitres.push(v);
  return v;
};
const ecran = (c: Construction, teinte = "#7fd3ff") => {
  const v = mat("#1d2a36", { emissive: teinte, emissiveIntensity: 0.9 });
  c.voyants.push(v);
  return v;
};

/** Quatre murs fins (on voit l'intérieur quand ils s'effacent), avec un plancher. */
function murs(g: THREE.Group, c: Construction, l: number, p: number, h: number, couleur: string, sol: THREE.Material = PARQUET): THREE.MeshStandardMaterial {
  const m = mat(couleur, { transparent: true, opacity: 1 });
  c.murs.push(m);
  const e = 0.12;
  boite(g, l, h, e, m, 0, 0, -p / 2 + e / 2);
  boite(g, l, h, e, m, 0, 0, p / 2 - e / 2);
  boite(g, e, h, p - 2 * e, m, -l / 2 + e / 2, 0, 0);
  boite(g, e, h, p - 2 * e, m, l / 2 - e / 2, 0, 0);
  boite(g, l - 0.1, 0.06, p - 0.1, sol, 0, 0.01, 0);
  return m;
}

/** Toit à deux pans (classique), dans le groupe `toit`. */
function toitDeuxPans(c: Construction, l: number, p: number, y: number, couleur: string, haut = 1): void {
  const forme = new THREE.Shape([new THREE.Vector2(-p / 2 - 0.25, 0), new THREE.Vector2(p / 2 + 0.25, 0), new THREE.Vector2(0, haut)]);
  const t = new THREE.Mesh(new THREE.ExtrudeGeometry(forme, { depth: l + 0.3, bevelEnabled: false }), mat(couleur));
  t.rotation.y = Math.PI / 2;
  t.position.set(-(l + 0.3) / 2, y, 0);
  c.toit.add(t);
}

/** Fenêtre à petits carreaux sur une façade (z = face). */
function fenetre(g: THREE.Object3D, c: Construction, x: number, y: number, z: number, l = 0.5, h = 0.6, cadre = "#ffffff", ry = 0): void {
  const f = new THREE.Group();
  boite(f, l, h, 0.05, vitre(c), 0, 0, 0);
  const m = mat(cadre);
  boite(f, l + 0.08, 0.06, 0.08, m, 0, -0.04, 0);
  boite(f, l + 0.08, 0.06, 0.08, m, 0, h - 0.02, 0);
  boite(f, 0.05, h, 0.07, m, 0, 0, 0);
  boite(f, l, 0.04, 0.07, m, 0, h / 2, 0);
  f.position.set(x, y, z);
  f.rotation.y = ry;
  g.add(f);
}

function porte(g: THREE.Object3D, x: number, z: number, couleur = "#6e4f33", l = 0.55, h = 0.95): void {
  boite(g, l, h, 0.08, mat(couleur), x, 0.04, z);
  boite(g, 0.06, 0.06, 0.06, mat("#e8c46a", { metalness: 0.6 }), x + l / 3, 0.5, z + 0.05);
}

/** Étagère de livres colorés. */
function bibliotheque(g: THREE.Object3D, x: number, z: number, l: number, ry = 0): void {
  const e = new THREE.Group();
  boite(e, l, 1.2, 0.3, BOIS_SOMBRE, 0, 0.05, 0);
  const couleurs = ["#d9533f", "#3f7fbf", "#f2c14e", "#3f9d6a", "#9a7bd1", "#e0795f", "#2f4858"];
  for (let rang = 0; rang < 3; rang++) {
    let px = -l / 2 + 0.08;
    let k = rang * 3;
    while (px < l / 2 - 0.1) {
      const w = 0.05 + ((k * 37) % 5) * 0.012;
      boite(e, w, 0.26 + ((k * 13) % 3) * 0.03, 0.22, mat(couleurs[k % couleurs.length]!), px + w / 2, 0.12 + rang * 0.38, 0.05);
      px += w + 0.01;
      k++;
    }
  }
  e.position.set(x, 0, z);
  e.rotation.y = ry;
  g.add(e);
}

function table(g: THREE.Object3D, x: number, z: number, l = 0.9, p = 0.5): void {
  boite(g, l, 0.06, p, BOIS, x, 0.5, z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) boite(g, 0.05, 0.5, 0.05, BOIS_SOMBRE, x + (dx * (l - 0.1)) / 2, 0, z + (dz * (p - 0.1)) / 2);
}

function lampe(g: THREE.Object3D, c: Construction, x: number, y: number, z: number): void {
  const v = mat("#fff2c8", { emissive: "#ffcf73", emissiveIntensity: 0.6 });
  c.voyants.push(v);
  const l = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 8, 1, true), v);
  l.position.set(x, y, z);
  g.add(l);
}

function plante(g: THREE.Object3D, x: number, z: number, s = 1): void {
  cylindre(g, 0.12 * s, 0.2 * s, mat("#c1673f"), x, 0.05, z, 8, 0.09 * s);
  const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 * s, 0), mat("#5ea94f"));
  f.position.set(x, 0.38 * s, z);
  g.add(f);
}

function lampadaire(g: THREE.Object3D, c: Construction, x: number, z: number): void {
  cylindre(g, 0.04, 1.5, mat("#2f3438"), x, 0, z, 6);
  const v = mat("#fff3c4", { emissive: "#ffd27a", emissiveIntensity: 0 });
  c.vitres.push(v);
  const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), v);
  l.position.set(x, 1.6, z);
  g.add(l);
}

function cheminee(g: THREE.Object3D, c: Construction, x: number, z: number, h: number, r = 0.26): void {
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r * (1 - i * 0.05), r * (1 - (i - 1) * 0.05), h / 5, 10), mat(i % 2 ? "#f4efe6" : "#d9533f"));
    t.position.set(x, (h / 5) * (i + 0.5), z);
    c.toit.add(t);
  }
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + i * 0.1, 0), mat("#f1f3f5", { transparent: true, opacity: 0.85 }));
    s.position.set(x, h + 0.3 + i * 0.5, z);
    s.userData = { phase: i / 4, x, base: h + 0.3 };
    g.add(s);
    c.fumees.push(s);
  }
}

// ------------------------------------------------------------------ classiques

/** La bibliothèque (le cerveau) : temple de pierre, colonnes, fronton, marches ; dedans des rayonnages et une table de lecture. */
export function archives(g: THREE.Group): Construction {
  const c = nouvelle();
  const l = 4.6;
  const p = 2.6;
  boite(g, l + 0.8, 0.25, p + 0.9, PIERRE_SOMBRE, 0, 0, 0.1);
  boite(g, l + 0.4, 0.2, 0.5, PIERRE, 0, 0.25, p / 2 + 0.45);
  const g2 = new THREE.Group();
  g2.position.y = 0.45;
  g.add(g2);
  murs(g2, c, l, p, 2.1, "#f1e8d6");
  for (let i = 0; i < 6; i++) cylindre(g2, 0.15, 2.1, PIERRE, -l / 2 + 0.35 + i * ((l - 0.7) / 5), 0, p / 2 + 0.35, 10);
  bibliotheque(g2, -1.2, -p / 2 + 0.3, 1.8);
  bibliotheque(g2, 1.2, -p / 2 + 0.3, 1.8);
  bibliotheque(g2, -l / 2 + 0.3, 0.1, 1.6, Math.PI / 2);
  table(g2, 0.2, 0.4, 1.2, 0.6);
  lampe(g2, c, 0.2, 0.65, 0.4);
  const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), mat("#5aa0d0"));
  globe.position.set(1.6, 0.72, 0.6);
  g2.add(globe);
  cylindre(g2, 0.03, 0.55, BOIS_SOMBRE, 1.6, 0, 0.6, 6);
  porte(g2, 0, p / 2 - 0.02, "#5b3f28", 0.7, 1.3);
  fenetre(g2, c, -1.5, 0.9, p / 2, 0.55, 0.8);
  fenetre(g2, c, 1.5, 0.9, p / 2, 0.55, 0.8);
  // entablement et fronton
  const t = new THREE.Group();
  boite(t, l + 0.5, 0.25, p + 0.9, PIERRE, 0, 2.55, 0.1);
  const forme = new THREE.Shape([new THREE.Vector2(-(l + 0.5) / 2, 0), new THREE.Vector2((l + 0.5) / 2, 0), new THREE.Vector2(0, 0.9)]);
  const fronton = new THREE.Mesh(new THREE.ExtrudeGeometry(forme, { depth: p + 0.9, bevelEnabled: false }), mat("#f6efe0"));
  fronton.position.set(0, 2.8, -(p + 0.9) / 2 + 0.1);
  t.add(fronton);
  const tympan = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), mat("#6f8fd8", { emissive: "#6f8fd8", emissiveIntensity: 0.15 }));
  tympan.position.set(0, 3.15, p / 2 + 0.56);
  t.add(tympan);
  c.toit.add(t);
  g.add(c.toit);
  c.hauteur = 4.2;
  c.porte = [0, p / 2 + 1.1];
  return c;
}

/** La poste : façade de briques jaunes, toit de tuiles, grande boîte aux lettres ; dedans des casiers et des colis. */
export function poste(g: THREE.Group): Construction {
  const c = nouvelle();
  const l = 2.6;
  const p = 2.2;
  murs(g, c, l, p, 1.7, "#e8b660");
  for (let y = 0.25; y < 1.7; y += 0.25) boite(g, l + 0.02, 0.03, p + 0.02, mat("#d7a24f", { transparent: true }), 0, y, 0);
  // casiers
  const casiers = new THREE.Group();
  boite(casiers, 1.6, 1.1, 0.3, BOIS, 0, 0, 0);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) boite(casiers, 0.24, 0.26, 0.05, mat(["#fff3d6", "#f4e1c0", "#ffffff"][(i + j) % 3]!), -0.62 + i * 0.31, 0.1 + j * 0.34, 0.16);
  casiers.position.set(0, 0.06, -p / 2 + 0.3);
  g.add(casiers);
  boite(g, 1.6, 0.8, 0.45, BOIS, 0.1, 0.06, 0.15);
  for (let i = 0; i < 4; i++) boite(g, 0.3, 0.24, 0.3, mat("#c8935a"), -0.9 + (i % 2) * 0.32, 0.06 + Math.floor(i / 2) * 0.25, 0.75);
  porte(g, 0.6, p / 2, "#3f6fb0");
  fenetre(g, c, -0.6, 0.6, p / 2, 0.8, 0.7);
  toitDeuxPans(c, l, p, 1.7, "#c9553e", 0.95);
  g.add(c.toit);
  // boîte aux lettres
  const boiteLettres = new THREE.Group();
  boite(boiteLettres, 0.1, 0.6, 0.1, mat("#2f3438"), 0, 0, 0);
  boite(boiteLettres, 0.36, 0.42, 0.3, mat("#f2c14e"), 0, 0.6, 0);
  boiteLettres.position.set(l / 2 + 0.5, 0, p / 2 + 0.2);
  g.add(boiteLettres);
  c.hauteur = 2.9;
  c.porte = [0.6, p / 2 + 0.9];
  return c;
}

/** La mairie : pierre blanche, tour d'horloge, perron ; dedans un bureau et un grand calendrier. */
export function mairie(g: THREE.Group): Construction {
  const c = nouvelle();
  const l = 2.8;
  const p = 2.2;
  boite(g, l + 0.4, 0.2, p + 0.4, PIERRE_SOMBRE, 0, 0, 0);
  const g2 = new THREE.Group();
  g2.position.y = 0.2;
  g.add(g2);
  murs(g2, c, l, p, 1.8, "#f4efe6");
  table(g2, 0, -0.2, 1.2, 0.6);
  cylindre(g2, 0.18, 0.5, mat("#c9553e"), 0, 0, 0.35, 8);
  const cal = new THREE.Group();
  boite(cal, 1.2, 0.9, 0.05, mat("#fffaf0"), 0, 0, 0);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) boite(cal, 0.18, 0.15, 0.06, mat((i + j) % 5 === 0 ? "#f2785a" : "#e6ddcf"), -0.42 + i * 0.21, 0.08 + j * 0.2, 0.02);
  cal.position.set(0, 0.6, -p / 2 + 0.15);
  g2.add(cal);
  plante(g2, l / 2 - 0.35, -p / 2 + 0.35);
  porte(g2, 0, p / 2, "#5b3f28", 0.65, 1.1);
  fenetre(g2, c, -0.95, 0.75, p / 2, 0.5, 0.7);
  fenetre(g2, c, 0.95, 0.75, p / 2, 0.5, 0.7);
  toitDeuxPans(c, l, p, 2, "#5f6f86", 0.7);
  // tour d'horloge
  const tour = new THREE.Group();
  boite(tour, 0.8, 1.1, 0.8, mat("#f4efe6"), 0, 2.2, 0);
  const cadran = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16), mat("#fffaf0"));
  cadran.rotation.x = Math.PI / 2;
  cadran.position.set(0, 2.8, 0.42);
  tour.add(cadran);
  boite(tour, 0.04, 0.2, 0.02, mat("#2f3438"), 0, 2.8, 0.46);
  boite(tour, 0.15, 0.04, 0.02, mat("#2f3438"), 0.05, 2.8, 0.46);
  const fleche = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.8, 4), mat("#5f6f86"));
  fleche.rotation.y = Math.PI / 4;
  fleche.position.y = 3.7;
  tour.add(fleche);
  cylindre(tour, 0.02, 0.6, ACIER, 0, 4.1, 0, 4);
  boite(tour, 0.4, 0.24, 0.02, mat("#f2785a"), 0.2, 4.45, 0);
  tour.position.y = 0.2;
  c.toit.add(tour);
  g.add(c.toit);
  c.hauteur = 4.9;
  c.porte = [0, p / 2 + 1];
  return c;
}

/** Ta maison : un cottage, toit pentu, cheminée, petite clôture ; dedans ton bureau avec l'ordinateur, un canapé, un lit. */
export function maison(g: THREE.Group, c0?: Construction): Construction {
  const c = c0 ?? nouvelle();
  const l = 2.5;
  const p = 2.2;
  murs(g, c, l, p, 1.5, "#f2d2bf");
  table(g, -0.6, -0.55, 1, 0.5);
  boite(g, 0.6, 0.38, 0.04, ecran(c, "#8fd0ff"), -0.6, 0.6, -0.68);
  boite(g, 0.08, 0.12, 0.08, mat("#2f3438"), -0.6, 0.52, -0.66);
  boite(g, 0.8, 0.3, 0.45, mat("#6f8fd8"), 0.65, 0.06, 0.45);
  boite(g, 0.8, 0.35, 0.12, mat("#5d7bc4"), 0.65, 0.2, 0.68);
  boite(g, 0.75, 0.22, 1.1, mat("#f6efe6"), 0.75, 0.06, -0.45);
  boite(g, 0.75, 0.08, 0.3, mat("#f2785a"), 0.75, 0.28, -0.85);
  const tapis = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.02, 12), mat("#e0795f"));
  tapis.position.set(-0.3, 0.08, 0.45);
  g.add(tapis);
  plante(g, -l / 2 + 0.3, p / 2 - 0.35);
  porte(g, 0.55, p / 2, "#c9553e");
  fenetre(g, c, -0.55, 0.55, p / 2, 0.6, 0.55);
  toitDeuxPans(c, l, p, 1.5, "#5b4a42", 1.2);
  cylindre(c.toit, 0.16, 0.9, mat("#a8644a"), 0.7, 1.9, -0.5, 6);
  g.add(c.toit);
  for (let x = -1.3; x <= 1.31; x += 0.32) boite(g, 0.06, 0.38, 0.06, mat("#fffaf0"), x, 0, p / 2 + 0.9);
  boite(g, 2.7, 0.05, 0.04, mat("#fffaf0"), 0, 0.28, p / 2 + 0.9);
  c.hauteur = 3.2;
  c.porte = [0.55, p / 2 + 0.6];
  return c;
}

/** Le tableau des tâches : grand panneau de bois sur poteaux, petit toit, éclairé le soir. */
export function tableau(g: THREE.Group): Construction {
  const c = nouvelle();
  for (const x of [-1.2, 1.2]) boite(g, 0.14, 2.4, 0.14, BOIS_SOMBRE, x, 0, 0);
  boite(g, 2.4, 1.35, 0.12, mat("#caa477"), 0, 0.85, 0);
  boite(g, 2.55, 0.1, 0.18, BOIS_SOMBRE, 0, 0.8, 0.02);
  boite(g, 2.55, 0.1, 0.18, BOIS_SOMBRE, 0, 2.2, 0.02);
  const forme = new THREE.Shape([new THREE.Vector2(-0.35, 0), new THREE.Vector2(0.35, 0), new THREE.Vector2(0, 0.3)]);
  const t = new THREE.Mesh(new THREE.ExtrudeGeometry(forme, { depth: 2.8, bevelEnabled: false }), mat("#c9553e"));
  t.rotation.y = Math.PI / 2;
  t.position.set(-1.4, 2.4, 0);
  c.toit.add(t);
  g.add(c.toit);
  lampadaire(g, c, 1.6, 0.4);
  c.hauteur = 3;
  c.porte = [0, 1.3];
  return c;
}

// ------------------------------------------------------------------ industriels

/** La cabane de Max : un conteneur orange aménagé, hublot, panneau solaire, terrasse ; dedans son lit, sa lampe, une plante. */
export function cabane(g: THREE.Group): Construction {
  const c = nouvelle();
  const l = 2.6;
  const p = 1.5;
  murs(g, c, l, p, 1.3, "#f58c63");
  const m = mat("#d9704b", { transparent: true });
  for (let x = -1.2; x <= 1.21; x += 0.2) boite(g, 0.04, 1.28, p + 0.04, m, x, 0.01, 0);
  boite(g, 0.9, 0.22, 0.6, mat("#fff3e8"), -0.75, 0.06, -0.2);
  boite(g, 0.3, 0.1, 0.5, mat("#8fb3e8"), -1.05, 0.28, -0.2);
  lampe(g, c, 0.3, 0.7, -0.4);
  boite(g, 0.5, 0.5, 0.35, BOIS, 0.3, 0.06, -0.4);
  plante(g, 0.95, -0.35, 1.2);
  boite(g, 0.5, 0.35, 0.03, mat("#6f8fd8"), 0.3, 0.75, -p / 2 + 0.15);
  const hublot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14), vitre(c));
  hublot.rotation.x = Math.PI / 2;
  hublot.position.set(-0.5, 0.75, p / 2);
  g.add(hublot);
  porte(g, 0.6, p / 2, "#4a2e22", 0.5, 0.9);
  const toit = new THREE.Group();
  boite(toit, l + 0.1, 0.08, p + 0.1, mat("#d9704b"), 0, 1.3, 0);
  const solaire = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), mat("#253a5e", { metalness: 0.4, roughness: 0.3 }));
  solaire.position.set(0, 1.55, 0);
  solaire.rotation.x = -0.35;
  toit.add(solaire);
  c.toit.add(toit);
  g.add(c.toit);
  boite(g, 1.6, 0.1, 0.8, BOIS, 0.2, 0, p / 2 + 0.5);
  c.hauteur = 2.2;
  c.porte = [0.6, p / 2 + 0.9];
  return c;
}

/** L'atelier (le code) : briques, toit en dents de scie ; dedans un établi, trois écrans, une baie de serveurs. */
export function atelier(g: THREE.Group): Construction {
  const c = nouvelle();
  const l = 2.8;
  const p = 2.2;
  murs(g, c, l, p, 1.6, "#9c5a46", mat("#8c939b"));
  table(g, -0.4, -0.5, 1.6, 0.6);
  for (let i = 0; i < 3; i++) boite(g, 0.42, 0.3, 0.04, ecran(c, ["#8fffb0", "#7fd3ff", "#ffd27a"][i]), -0.9 + i * 0.48, 0.6, -0.72);
  const baie = new THREE.Group();
  boite(baie, 0.5, 1.3, 0.5, mat("#2f3438"), 0, 0.06, 0);
  for (let i = 0; i < 6; i++) boite(baie, 0.06, 0.04, 0.02, ecran(c, i % 2 ? "#8fffb0" : "#ff8f86"), -0.15 + (i % 3) * 0.12, 0.3 + Math.floor(i / 3) * 0.4, 0.26);
  baie.position.set(l / 2 - 0.45, 0, 0.4);
  g.add(baie);
  porte(g, -0.5, p / 2, "#3f454c", 1, 1.1);
  fenetre(g, c, 0.8, 0.7, p / 2, 0.6, 0.6, "#3f454c");
  // dents de scie
  const dents = 3;
  const largeur = l / dents;
  for (let i = 0; i < dents; i++) {
    const forme = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(largeur, 0), new THREE.Vector2(largeur, 0.7)]);
    const t = new THREE.Mesh(new THREE.ExtrudeGeometry(forme, { depth: p + 0.1, bevelEnabled: false }), mat("#4a4f5e"));
    t.position.set(-l / 2 + i * largeur, 1.6, -(p + 0.1) / 2);
    c.toit.add(t);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, p), vitre(c));
    v.position.set(-l / 2 + (i + 1) * largeur - 0.02, 1.95, 0);
    c.toit.add(v);
  }
  g.add(c.toit);
  c.hauteur = 2.6;
  c.porte = [-0.5, p / 2 + 0.8];
  return c;
}

/** La centrale (le modèle) : grand hall, cheminées rayées, tour de refroidissement ; dedans des baies de cartes graphiques. */
export function centrale(g: THREE.Group): Construction {
  const c = nouvelle();
  const l = 3.4;
  const p = 2.4;
  murs(g, c, l, p, 1.9, "#a3adb7", mat("#8c939b"));
  for (let i = 0; i < 3; i++) {
    const baie = new THREE.Group();
    boite(baie, 0.55, 1.4, 0.5, mat("#26303a"), 0, 0.06, 0);
    for (let k = 0; k < 8; k++) boite(baie, 0.42, 0.06, 0.02, ecran(c, k % 3 === 0 ? "#8fffb0" : "#5bc2ff"), 0, 0.2 + k * 0.15, 0.26);
    baie.position.set(-1.1 + i * 0.75, 0, -p / 2 + 0.45);
    g.add(baie);
  }
  const turbine = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12), ACIER_CLAIR);
  turbine.rotation.z = Math.PI / 2;
  turbine.position.set(0.6, 0.5, 0.45);
  g.add(turbine);
  porte(g, -0.9, p / 2, "#3f454c", 0.9, 1.2);
  fenetre(g, c, 0.7, 0.9, p / 2, 1, 0.6, "#3f454c");
  boite(c.toit, l + 0.2, 0.15, p + 0.2, ACIER, 0, 1.9, 0);
  cheminee(g, c, 0.9, -0.5, 3.8);
  cheminee(g, c, 0.1, -0.6, 3.2, 0.2);
  g.add(c.toit);
  const profil = [new THREE.Vector2(0.95, 0), new THREE.Vector2(0.7, 0.9), new THREE.Vector2(0.64, 1.5), new THREE.Vector2(0.78, 2.2)];
  const tour = new THREE.Mesh(new THREE.LatheGeometry(profil, 14), mat("#e3ddd2", { side: THREE.DoubleSide }));
  tour.position.set(-l / 2 - 1.2, 0, 0);
  g.add(tour);
  const tuyau = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8), ACIER_CLAIR);
  tuyau.rotation.z = Math.PI / 2;
  tuyau.position.set(-l / 2 - 0.35, 1.1, 0);
  g.add(tuyau);
  c.hauteur = 4.6;
  c.porte = [-0.9, p / 2 + 0.8];
  return c;
}

/** Le port (les visiteurs arrivent par la mer) : capitainerie de bois, ponton vers le large, grue, bateau. */
export function port(g: THREE.Group): Construction {
  const c = nouvelle();
  murs(g, c, 1.8, 1.6, 1.3, "#7fa7c9");
  table(g, 0, -0.2, 0.8, 0.45);
  boite(g, 0.3, 0.25, 0.04, ecran(c, "#8fd0ff"), 0, 0.56, -0.35);
  fenetre(g, c, -0.4, 0.55, 0.8, 0.5, 0.45);
  porte(g, 0.45, 0.8, "#fffaf0", 0.45, 0.85);
  toitDeuxPans(c, 1.8, 1.6, 1.3, "#2f5f8f", 0.6);
  g.add(c.toit);
  // le ponton part vers +x (vers le large), la grue et le bateau au bout
  boite(g, 4.2, 0.12, 0.9, BOIS, 3.2, 0.05, 0.3);
  for (let x = 1.6; x <= 5.2; x += 0.9) for (const z of [-0.1, 0.7]) cylindre(g, 0.07, 1.4, BOIS_SOMBRE, x, -1.3, z, 6);
  const jaune = mat("#f2c14e");
  boite(g, 0.6, 0.15, 0.6, PIERRE_SOMBRE, 4.6, 0.15, -0.6);
  boite(g, 0.16, 2.6, 0.16, jaune, 4.6, 0.3, -0.6);
  boite(g, 2.4, 0.12, 0.12, jaune, 5.2, 2.8, -0.6);
  cylindre(g, 0.012, 1, ACIER, 6, 1.8, -0.6, 4);
  const conteneur = new THREE.Group();
  boite(conteneur, 0.9, 0.42, 0.42, mat("#3f7fbf"), 0, 0, 0);
  conteneur.position.set(6, 1.4, -0.6);
  g.add(conteneur);
  const bateau = new THREE.Group();
  const coque = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.32, 2, 6, 1), mat("#fffaf0"));
  coque.rotation.x = Math.PI / 2;
  coque.scale.set(1, 1, 0.55);
  bateau.add(coque);
  boite(bateau, 0.6, 0.45, 0.6, mat("#d9533f"), 0, 0.12, -0.2);
  bateau.position.set(4.3, -0.05, 1.5);
  bateau.rotation.y = Math.PI / 2;
  bateau.userData.bateau = true;
  g.add(bateau);
  lampadaire(g, c, 1.4, 1);
  c.hauteur = 3.2;
  c.porte = [0.45, 1.6];
  return c;
}

/** Un chantier : dalles de béton qui montent avec l'avancement, échafaudage, grue à tour. */
export function chantier(g: THREE.Group, avancement: number): Construction {
  const c = nouvelle();
  const etages = 4;
  const faits = Math.max(1, Math.round((etages * avancement) / 100));
  const beton = mat("#c9c4bb");
  for (let i = 0; i < faits; i++) {
    boite(g, 2.2, 0.1, 1.8, beton, 0, i * 0.6, 0);
    for (const [x, z] of [[-1, -0.8], [1, -0.8], [-1, 0.8], [1, 0.8]] as [number, number][]) boite(g, 0.12, 0.6, 0.12, beton, x, i * 0.6, z);
  }
  if (avancement >= 100) {
    murs(g, c, 2.2, 1.8, etages * 0.6, "#e8c9a6");
    toitDeuxPans(c, 2.2, 1.8, etages * 0.6, "#c9553e", 0.8);
    g.add(c.toit);
  } else {
    for (const x of [-1.25, 1.25]) boite(g, 0.05, etages * 0.6 + 0.3, 0.05, BOIS, x, 0, 1.05);
    for (let y = 0.6; y < etages * 0.6; y += 0.6) boite(g, 2.6, 0.05, 0.3, BOIS, 0, y, 1.05);
    const jaune = mat("#f2c14e");
    boite(g, 0.18, 4.2, 0.18, jaune, -1.4, 0, -1.1);
    boite(g, 3.4, 0.14, 0.14, jaune, -0.1, 4.1, -1.1);
    boite(g, 0.6, 0.35, 0.35, mat("#9a9389"), -2.2, 3.9, -1.1);
    cylindre(g, 0.012, 1.5, ACIER, 1.2, 2.6, -1.1, 4);
    boite(g, 0.5, 0.2, 0.3, mat("#c8935a"), 1.2, 2.4, -1.1);
  }
  c.hauteur = 4.6;
  c.porte = [0, 1.9];
  return c;
}

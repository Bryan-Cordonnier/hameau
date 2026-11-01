// La carte du cerveau (cahier/01), en carte mentale classique : le cerveau au centre, les pôles à droite et à gauche, puis
// sujets et sections en colonnes (sans limite de profondeur), et pour chaque dossier la grille de ses neurones (ses fiches,
// et un bloc « Souvenirs »). Les blocs se
// distinguent par leur taille ; les couleurs passent du parent aux enfants. Calculs purs, sans affichage.
import type { NoeudCarte } from "@hameau/commun";

export type Etage = "cerveau" | "pole" | "sujet" | "section";

export interface Bloc {
  rel: string;
  nom: string;
  etage: Etage;
  parent: string | null;
  emoji: string;
  couleur: string;
  description: string;
  total: number;
  x: number;
  y: number;
  l: number;
  h: number;
  /** bloc pas encore relié (dossier « Pas organisés ») */
  libre: boolean;
}

export interface Neurone {
  rel: string;
  titre: string;
  resume: string;
  x: number;
  y: number;
  couleur: string;
  souvenirs?: { rel: string; titre: string }[];
}

/** Une grappe : les neurones d'un dossier, en grille dans la colonne de ses enfants. */
export interface Grappe {
  dossier: string;
  x: number;
  y: number;
  l: number;
  h: number;
  neurones: Neurone[];
}

export const TAILLES: Record<Etage, [number, number]> = { cerveau: [260, 88], pole: [240, 64], sujet: [210, 52], section: [180, 42] };
export const NEURONE: [number, number] = [170, 30];
/** Taille du texte de chaque étage (les neurones : NEURONE_TEXTE). */
export const TEXTE: Record<Etage, number> = { cerveau: 28, pole: 20, sujet: 16, section: 14 };
export const NEURONE_TEXTE = 12;

/** Le nom tient dans son bloc : coupé avec « … » au-delà de ce que la largeur permet (≈ 0,58 em par lettre). */
export function couper(nom: string, largeur: number, taille: number): string {
  const max = Math.max(4, Math.floor((largeur - 24) / (taille * 0.58)) - 2);
  return nom.length > max ? `${nom.slice(0, max - 1)}…` : nom;
}
export const PAS_ORGANISES = "pas-organises/";
export const SUPPRIMES = "supprimes/";
const PALETTE = ["#6f8fd8", "#e0795f", "#5aa58a", "#c9963b", "#9a7bd1", "#d76c9a", "#6aa7b8", "#8a9a5b", "#b07a4f", "#5f8f9f"];

/** Joli nom d'un dossier : « vie-pratique » → « Vie pratique ». */
export const joliNom = (n: string): string => (n ? n.charAt(0).toUpperCase() + n.slice(1).replace(/-/g, " ") : "Cerveau");

const etageParDefaut = (profondeur: number): Etage => (profondeur === 0 ? "cerveau" : profondeur === 1 ? "pole" : profondeur === 2 ? "sujet" : "section");

export interface Disposition {
  blocs: Bloc[];
  grappes: Grappe[];
}

const ECART_X = 110;
const ECART_Y = 22;

/** Un dossier et ce qu'il porte, mesuré avant d'être placé. */
interface Mesure {
  n: NoeudCarte;
  prof: number;
  etage: Etage;
  l: number;
  h: number;
  /** grille de ses neurones (une ou deux colonnes), posée dans la colonne de ses enfants */
  grille: { cols: number; l: number; h: number } | null;
  enfants: Mesure[];
  /** hauteur de tout ce qu'il porte (lui, sa grille, ses enfants) */
  hauteur: number;
  /** hauteur de sa grille et de ses enfants, empilés */
  contenu: number;
}

/**
 * Dispose toute la carte, comme une carte mentale classique : le cerveau au centre, les pôles répartis à droite et à gauche,
 * chaque étage dans sa colonne, les neurones d'un dossier en grille dans la colonne de ses enfants. Rien ne se chevauche
 * et les fils restent courts. `meta` : étage, émoji, couleur posés à la main ; `positions` : blocs placés à la main (gardés).
 * « Ranger la carte » = positions vides.
 */
export function disposer(
  arbre: NoeudCarte,
  meta: Record<string, { etage: string; emoji: string; couleur: string }> = {},
  positions: Record<string, [number, number]> = {},
): Disposition {
  const blocs: Bloc[] = [];
  const grappes: Grappe[] = [];
  const [nl, nh] = NEURONE;

  const mesurer = (n: NoeudCarte, prof: number): Mesure => {
    const m = meta[n.rel];
    const etage: Etage = prof === 0 ? "cerveau" : ((m?.etage as Etage) || etageParDefaut(prof));
    const [l, h] = TAILLES[etage === "cerveau" && prof > 0 ? "pole" : etage];
    const items = n.fiches.length + (n.souvenirs.length ? 1 : 0);
    const cols = items > 6 ? 2 : 1;
    const grille = items ? { cols, l: cols * (nl + 8) - 8, h: Math.ceil(items / cols) * (nh + 6) - 6 } : null;
    const enfants = (prof === 0 ? [] : n.enfants).map((e) => mesurer(e, prof + 1));
    const parts = [...(grille ? [grille.h] : []), ...enfants.map((e) => e.hauteur)];
    const contenu = parts.reduce((s, x) => s + x, 0) + ECART_Y * Math.max(0, parts.length - 1);
    return { n, prof, etage, l, h, grille, enfants, contenu, hauteur: Math.max(h, contenu) };
  };

  const racine = mesurer(arbre, 0);
  const visibles = arbre.enfants.filter((e) => e.rel !== SUPPRIMES && e.rel !== PAS_ORGANISES).map((e) => mesurer(e, 1));
  // les pôles vont du côté le moins haut, les plus gros d'abord ; les neurones du cerveau lui-même partent à droite
  const cotes: Mesure[][] = [[], []];
  const haut = [racine.grille ? racine.grille.h + ECART_Y : 0, 0];
  for (const p of [...visibles].sort((a, b) => b.hauteur - a.hauteur)) {
    const c = haut[0]! <= haut[1]! ? 0 : 1;
    cotes[c]!.push(p);
    haut[c]! += p.hauteur + ECART_Y;
  }
  // dans chaque côté, l'ordre d'origine
  for (const c of cotes) c.sort((a, b) => visibles.indexOf(a) - visibles.indexOf(b));

  // largeur de chaque colonne (par côté) : le plus large de ce qu'elle contient, blocs et grilles
  const largeurs: number[][] = [[], []];
  const relever = (m: Mesure, c: number) => {
    largeurs[c]![m.prof] = Math.max(largeurs[c]![m.prof] ?? 0, m.l);
    if (m.grille) largeurs[c]![m.prof + 1] = Math.max(largeurs[c]![m.prof + 1] ?? 0, m.grille.l);
    m.enfants.forEach((e) => relever(e, c));
  };
  cotes.forEach((liste, c) => liste.forEach((m) => relever(m, c)));
  if (racine.grille) largeurs[0]![1] = Math.max(largeurs[0]![1] ?? 0, racine.grille.l);
  /** Bord intérieur de la colonne `prof` (distance au centre). */
  const debut = (c: number, prof: number): number => {
    let x = racine.l / 2 + ECART_X;
    for (let p = 1; p < prof; p++) x += (largeurs[c]![p] ?? 0) + ECART_X;
    return x;
  };

  const ajouter = (m: Mesure, parent: Bloc | null, x: number, y: number, libre = false): Bloc => {
    const n = m.n;
    const reglage = meta[n.rel];
    const p = positions[n.rel];
    const couleur = reglage?.couleur || parent?.couleur || (m.prof === 1 ? PALETTE[blocs.filter((b) => b.etage === "pole").length % PALETTE.length]! : "#8a9099");
    const b: Bloc = {
      rel: n.rel,
      nom: m.prof === 0 ? "Cerveau" : n.titre || joliNom(n.nom),
      etage: m.etage,
      parent: parent?.rel ?? null,
      emoji: m.prof === 0 ? "" : reglage?.emoji || "📁",
      couleur,
      description: n.resume,
      total: n.total,
      x: p?.[0] ?? x,
      y: p?.[1] ?? y,
      l: m.l,
      h: m.h,
      libre,
    };
    blocs.push(b);
    return b;
  };
  /** La grille des neurones d'un dossier : son bord intérieur en `x0` (elle s'étend selon `sens`), son haut en `y0`. */
  const grappe = (m: Mesure, b: Bloc, x0: number, y0: number, sens: number) => {
    const g = m.grille;
    if (!g) return;
    const n = m.n;
    const items: Neurone[] = n.fiches.map((f) => ({ rel: f.rel, titre: f.titre, resume: f.resume, x: 0, y: 0, couleur: b.couleur }));
    if (n.souvenirs.length) items.unshift({ rel: `${n.rel}souvenirs`, titre: "Souvenirs", resume: `${n.souvenirs.length} fichier(s)`, x: 0, y: 0, couleur: b.couleur, souvenirs: n.souvenirs });
    const p = positions[`${n.rel}#neurones`];
    const cx = p?.[0] ?? x0 + (sens * g.l) / 2;
    const cy = p?.[1] ?? y0 + g.h / 2;
    items.forEach((it, i) => {
      it.x = cx - g.l / 2 + (i % g.cols) * (nl + 8) + nl / 2;
      it.y = cy - g.h / 2 + Math.floor(i / g.cols) * (nh + 6) + nh / 2;
    });
    grappes.push({ dossier: n.rel, x: cx, y: cy, l: g.l, h: g.h, neurones: items });
  };
  /** Place un dossier dont tout l'ensemble commence en `y0`, du côté `c` (0 : droite, 1 : gauche). */
  const placer = (m: Mesure, parent: Bloc, c: number, y0: number) => {
    const sens = c === 0 ? 1 : -1;
    const b = ajouter(m, parent, sens * (debut(c, m.prof) + m.l / 2), y0 + m.hauteur / 2);
    const xEnfants = sens * debut(c, m.prof + 1);
    let y = y0 + (m.hauteur - m.contenu) / 2;
    if (m.grille) {
      grappe(m, b, xEnfants, y, sens);
      y += m.grille.h + ECART_Y;
    }
    for (const e of m.enfants) {
      placer(e, b, c, y);
      y += e.hauteur + ECART_Y;
    }
  };

  const cerveau = ajouter(racine, null, 0, 0);
  cotes.forEach((liste, c) => {
    let y = -haut[c]! / 2;
    if (c === 0 && racine.grille) {
      grappe(racine, cerveau, debut(0, 1), y, 1);
      y += racine.grille.h + ECART_Y;
    }
    for (const p of liste) {
      placer(p, cerveau, c, y);
      y += p.hauteur + ECART_Y;
    }
  });
  // les blocs pas encore reliés attendent en bas, en pointillés
  const bas = Math.max(...haut) / 2 + 220;
  const libres = arbre.enfants.find((e) => e.rel === PAS_ORGANISES)?.enfants ?? [];
  libres.forEach((e, i) => ajouter(mesurer(e, 1), null, -((libres.length - 1) * 280) / 2 + i * 280, bas, true));
  return { blocs, grappes };
}

export interface Fil {
  de: string;
  vers: string;
  d: string;
  couleur: string;
}

type Rect = { x: number; y: number; l: number; h: number };

/** Un fil de carte mentale : des bords qui se font face, du parent à l'enfant, en douce courbe horizontale. */
export function tracer(a: Rect, b: Rect): string {
  const sens = b.x >= a.x ? 1 : -1;
  const x0 = a.x + (sens * a.l) / 2;
  const x1 = b.x - (sens * b.l) / 2;
  const mx = (x0 + x1) / 2;
  return `M${x0},${a.y} C${mx},${a.y} ${mx},${b.y} ${x1},${b.y}`;
}

/** Les fils de la carte : un par lien hiérarchique (parent → dossier, dossier → sa grille de neurones). */
export function fils(d: Disposition): Fil[] {
  const par = new Map(d.blocs.map((b) => [b.rel, b]));
  const sortie: Fil[] = [];
  for (const b of d.blocs) {
    const p = b.parent !== null ? par.get(b.parent) : undefined;
    if (p) sortie.push({ de: p.rel, vers: b.rel, d: tracer(p, b), couleur: b.couleur });
  }
  for (const g of d.grappes) {
    const b = par.get(g.dossier);
    if (b) sortie.push({ de: b.rel, vers: `${g.dossier}#neurones`, d: tracer(b, g), couleur: b.couleur });
  }
  return sortie;
}

/** Un nom de dossier ou de fichier sûr : « Projet maison » → « projet-maison ». */
export function slug(nom: string): string {
  return (
    nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "bloc"
  );
}

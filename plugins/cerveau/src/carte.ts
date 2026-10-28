// La carte du cerveau (cahier/01) : le cerveau au centre, les pôles autour, puis sujets et sections (sans limite de
// profondeur), et pour chaque dossier une grappe de neurones (ses fiches) et un bloc « Souvenirs ». Les blocs se
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

/** Une grappe : les neurones d'un dossier, rangés en petite grille au-delà du dossier. */
export interface Grappe {
  dossier: string;
  x: number;
  y: number;
  l: number;
  h: number;
  neurones: Neurone[];
}

export interface Point {
  x: number;
  y: number;
}

export const TAILLES: Record<Etage, [number, number]> = { cerveau: [240, 84], pole: [196, 64], sujet: [164, 50], section: [136, 40] };
export const NEURONE: [number, number] = [128, 26];
export const PAS_ORGANISES = "pas-organises/";
export const SUPPRIMES = "supprimes/";
const PALETTE = ["#6f8fd8", "#e0795f", "#5aa58a", "#c9963b", "#9a7bd1", "#d76c9a", "#6aa7b8", "#8a9a5b", "#b07a4f", "#5f8f9f"];

/** Joli nom d'un dossier : « vie-pratique » → « Vie pratique ». */
export const joliNom = (n: string): string => (n ? n.charAt(0).toUpperCase() + n.slice(1).replace(/-/g, " ") : "Cerveau");

const etageParDefaut = (profondeur: number): Etage => (profondeur === 0 ? "cerveau" : profondeur === 1 ? "pole" : profondeur === 2 ? "sujet" : "section");

function poids(n: NoeudCarte): number {
  return 1 + n.fiches.length * 0.35 + (n.souvenirs.length ? 0.3 : 0) + n.enfants.reduce((s, e) => s + poids(e), 0);
}

export interface Disposition {
  blocs: Bloc[];
  grappes: Grappe[];
}

/**
 * Dispose toute la carte. `meta` : étage, émoji, couleur posés à la main ; `positions` : blocs placés à la main (gardés).
 * Un nouveau bloc se place tout seul autour de son parent ; « Ranger la carte » = positions vides.
 */
export function disposer(
  arbre: NoeudCarte,
  meta: Record<string, { etage: string; emoji: string; couleur: string }> = {},
  positions: Record<string, [number, number]> = {},
): Disposition {
  const blocs: Bloc[] = [];
  const grappes: Grappe[] = [];
  const ajouter = (n: NoeudCarte, profondeur: number, parent: Bloc | null, x: number, y: number, libre = false): Bloc => {
    const m = meta[n.rel];
    const etage: Etage = profondeur === 0 ? "cerveau" : ((m?.etage as Etage) || etageParDefaut(profondeur));
    const [l, h] = TAILLES[etage === "cerveau" && profondeur > 0 ? "pole" : etage];
    const p = positions[n.rel];
    const couleur = m?.couleur || parent?.couleur || (profondeur === 1 ? PALETTE[blocs.filter((b) => b.etage === "pole").length % PALETTE.length]! : "#8a9099");
    const b: Bloc = {
      rel: n.rel,
      nom: profondeur === 0 ? "Cerveau" : n.titre || joliNom(n.nom),
      etage,
      parent: parent?.rel ?? null,
      emoji: profondeur === 0 ? "" : m?.emoji || "📁",
      couleur,
      description: n.resume,
      total: n.total,
      x: p?.[0] ?? x,
      y: p?.[1] ?? y,
      l,
      h,
      libre,
    };
    blocs.push(b);
    return b;
  };
  const grappe = (n: NoeudCarte, b: Bloc, dir: Point) => {
    const items: Neurone[] = n.fiches.map((f) => ({ rel: f.rel, titre: f.titre, resume: f.resume, x: 0, y: 0, couleur: b.couleur }));
    if (n.souvenirs.length) items.unshift({ rel: `${n.rel}souvenirs`, titre: "Souvenirs", resume: `${n.souvenirs.length} fichier(s)`, x: 0, y: 0, couleur: b.couleur, souvenirs: n.souvenirs });
    if (!items.length) return;
    const cols = Math.max(1, Math.ceil(Math.sqrt(items.length * 0.6)));
    const rows = Math.ceil(items.length / cols);
    const [nl, nh] = NEURONE;
    const l = cols * (nl + 8);
    const h = rows * (nh + 6);
    const d = Math.hypot(dir.x, dir.y) || 1;
    const ecart = (b.h + h) / 2 + 40 + ((Math.abs(dir.x / d) * (b.l + l)) / 2) * 0.6;
    const p = positions[`${n.rel}#neurones`];
    const cx = p?.[0] ?? b.x + (dir.x / d) * ecart;
    const cy = p?.[1] ?? b.y + (dir.y / d) * ecart;
    items.forEach((it, i) => {
      it.x = cx - l / 2 + (i % cols) * (nl + 8) + nl / 2 + 4;
      it.y = cy - h / 2 + Math.floor(i / cols) * (nh + 6) + nh / 2 + 3;
    });
    grappes.push({ dossier: n.rel, x: cx, y: cy, l, h, neurones: items });
  };

  const racine = ajouter(arbre, 0, null, 0, 0);
  const visibles = arbre.enfants.filter((e) => e.rel !== SUPPRIMES && e.rel !== PAS_ORGANISES);
  grappe(arbre, racine, { x: 0, y: 1 });
  // chaque branche reçoit une part du tour proportionnelle à sa taille, et ses enfants s'éventaillent vers l'extérieur
  const placer = (n: NoeudCarte, b: Bloc, profondeur: number, debut: number, fin: number) => {
    const total = n.enfants.reduce((s, e) => s + Math.sqrt(poids(e)), 0) || 1;
    let a = debut;
    for (const e of n.enfants) {
      const part = ((fin - debut) * Math.sqrt(poids(e))) / total;
      const milieu = a + part / 2;
      // plus une branche est grosse, plus elle part loin : ses enfants ont la place de s'éventailler
      const r = (profondeur === 0 ? 700 : 280) + Math.min(900, 70 * Math.sqrt(poids(e)));
      const cb = ajouter(e, profondeur + 1, b, b.x + Math.cos(milieu) * r, b.y + Math.sin(milieu) * r * 0.78);
      grappe(e, cb, { x: Math.cos(milieu), y: Math.sin(milieu) });
      const ouverture = Math.min(part, Math.PI * 0.8) / 2;
      placer(e, cb, profondeur + 1, milieu - ouverture, milieu + ouverture);
      a += part;
    }
  };
  placer({ ...arbre, enfants: visibles }, racine, 0, -Math.PI / 2, Math.PI * 1.5);
  // les blocs pas encore reliés flottent en bas à gauche, en pointillés
  const libres = arbre.enfants.find((e) => e.rel === PAS_ORGANISES)?.enfants ?? [];
  libres.forEach((e, i) => ajouter(e, 1, null, -900 + i * 220, 1100, true));
  ecarter(blocs, grappes, positions);
  return { blocs, grappes };
}

interface Boite {
  x: number;
  y: number;
  l: number;
  h: number;
  fixe: boolean;
  b?: Bloc;
  g?: Grappe;
}
const chevauche = (a: Boite, b: Boite, marge: number) => Math.abs(a.x - b.x) < (a.l + b.l) / 2 + marge && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + marge;

/** Écarte ce qui se touche (blocs et grappes) ; le cerveau et ce que Bryan a placé à la main ne bougent pas. */
export function ecarter(blocs: Bloc[], grappes: Grappe[], fixes: Record<string, unknown> = {}, marge = 26): void {
  const boites: Boite[] = [
    ...blocs.map((b) => ({ x: b.x, y: b.y, l: b.l, h: b.h, fixe: b.parent === null && !b.libre ? true : b.rel in fixes, b })),
    ...grappes.map((g) => ({ x: g.x, y: g.y, l: g.l, h: g.h, fixe: `${g.dossier}#neurones` in fixes, g })),
  ];
  for (let tour = 0; tour < 120; tour++) {
    let bouge = false;
    for (let i = 0; i < boites.length; i++) {
      for (let j = i + 1; j < boites.length; j++) {
        const a = boites[i]!;
        const c = boites[j]!;
        if (!chevauche(a, c, marge)) continue;
        bouge = true;
        const dx = c.x - a.x || 1;
        const dy = c.y - a.y || 1;
        const d = Math.hypot(dx, dy);
        const pas = 18;
        const fa = a.fixe ? 0 : c.fixe ? 2 : 1;
        const fc = 2 - fa;
        a.x -= (dx / d) * pas * (fa / 2);
        a.y -= (dy / d) * pas * (fa / 2);
        c.x += (dx / d) * pas * (fc / 2);
        c.y += (dy / d) * pas * (fc / 2);
      }
    }
    if (!bouge) break;
  }
  for (const x of boites) {
    if (x.b) {
      x.b.x = x.x;
      x.b.y = x.y;
    }
    if (x.g) {
      const dx = x.x - x.g.x;
      const dy = x.y - x.g.y;
      x.g.x = x.x;
      x.g.y = x.y;
      for (const n of x.g.neurones) {
        n.x += dx;
        n.y += dy;
      }
    }
  }
}

/** Points d'une courbe de Bézier cubique. */
export function echantillons(p0: Point, c1: Point, c2: Point, p1: Point, n = 24): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
    };
  });
}

type Rect = { x: number; y: number; l: number; h: number };
const dans = (p: Point, b: Rect, marge = 8) => Math.abs(p.x - b.x) < b.l / 2 + marge && Math.abs(p.y - b.y) < b.h / 2 + marge;

/** Bord d'un rectangle dans la direction d'un point : un fil part du bord, pas du centre. */
export function bord(b: Rect, vers: Point): Point {
  const dx = vers.x - b.x;
  const dy = vers.y - b.y;
  const k = Math.min(Math.abs(dx) > 0 ? b.l / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 0 ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: b.x + dx * k, y: b.y + dy * k };
}

export interface Fil {
  de: string;
  vers: string;
  d: string;
  couleur: string;
}

/** Un fil entre deux rectangles : droit si possible, sinon une courbe qui contourne ; jamais par-dessus un autre bloc. */
export function tracer(a: Rect, b: Rect, obstacles: Rect[]): string {
  const p0 = bord(a, b);
  const p1 = bord(b, a);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const long = Math.hypot(dx, dy) || 1;
  const nx = -dy / long;
  const ny = dx / long;
  const proches = obstacles.filter((o) => o !== a && o !== b && Math.abs(o.x - (p0.x + p1.x) / 2) < long / 2 + o.l + 600 && Math.abs(o.y - (p0.y + p1.y) / 2) < long / 2 + o.h + 600);
  const libre = (pts: Point[]) => !pts.some((p) => proches.some((o) => dans(p, o)));
  for (const pli of [0, 30, -30, 80, -80, 160, -160, 280, -280]) {
    const c1 = { x: p0.x + dx * 0.33 + nx * pli, y: p0.y + dy * 0.33 + ny * pli };
    const c2 = { x: p0.x + dx * 0.66 + nx * pli, y: p0.y + dy * 0.66 + ny * pli };
    if (libre(echantillons(p0, c1, c2, p1))) {
      return pli === 0 ? `M${p0.x},${p0.y} L${p1.x},${p1.y}` : `M${p0.x},${p0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p1.x},${p1.y}`;
    }
  }
  // détour par un point écarté du milieu, en deux courbes
  for (const loin of [200, -200, 360, -360, 520, -520]) {
    const m = { x: p0.x + dx / 2 + nx * loin, y: p0.y + dy / 2 + ny * loin };
    const a1 = { x: p0.x + nx * loin * 0.6, y: p0.y + ny * loin * 0.6 };
    const a2 = { x: m.x - dx * 0.2, y: m.y - dy * 0.2 };
    const b1 = { x: m.x + dx * 0.2, y: m.y + dy * 0.2 };
    const b2 = { x: p1.x + nx * loin * 0.6, y: p1.y + ny * loin * 0.6 };
    if (libre([...echantillons(p0, a1, a2, m, 14), ...echantillons(m, b1, b2, p1, 14)])) {
      return `M${p0.x},${p0.y} C${a1.x},${a1.y} ${a2.x},${a2.y} ${m.x},${m.y} C${b1.x},${b1.y} ${b2.x},${b2.y} ${p1.x},${p1.y}`;
    }
  }
  return `M${p0.x},${p0.y} L${p1.x},${p1.y}`;
}

/** Les fils de la carte : un par lien hiérarchique (parent → dossier, dossier → sa grappe de neurones). */
export function fils(d: Disposition): Fil[] {
  const par = new Map(d.blocs.map((b) => [b.rel, b]));
  const obstacles: Rect[] = [...d.blocs, ...d.grappes];
  const sortie: Fil[] = [];
  for (const b of d.blocs) {
    const p = b.parent !== null ? par.get(b.parent) : undefined;
    if (p) sortie.push({ de: p.rel, vers: b.rel, d: tracer(p, b, obstacles), couleur: b.couleur });
  }
  for (const g of d.grappes) {
    const b = par.get(g.dossier);
    if (b) sortie.push({ de: b.rel, vers: `${g.dossier}#neurones`, d: tracer(b, g, obstacles), couleur: b.couleur });
  }
  return sortie;
}

/** Ce qui est affiché selon le zoom : de loin, les neurones sont des points et seuls pôles et sujets ont leur nom. */
export function niveauDeDetail(k: number): { nomsSections: boolean; nomsNeurones: boolean } {
  return { nomsSections: k >= 0.45, nomsNeurones: k >= 0.8 };
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

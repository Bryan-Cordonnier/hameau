// La carte du cerveau : disposition des blocs (lobes, aires, noyaux) en grappes autour du cerveau, liens courbes qui
// contournent les blocs, et repérage des croisements pour y dessiner un petit pont. Calculs purs, sans affichage.
import type { NoeudArbre } from "@hameau/commun";

export type Niveau = 0 | 1 | 2 | 3;
export const NOMS_NIVEAUX = ["Cerveau", "Lobe", "Aire", "Noyau"] as const;

export interface Bloc {
  rel: string;
  nom: string;
  niveau: Niveau;
  parent: string | null;
  total: number;
  x: number;
  y: number;
  l: number;
  h: number;
  lobe: string;
}

export interface Point {
  x: number;
  y: number;
}

const TAILLES: Record<Niveau, [number, number]> = { 0: [190, 64], 1: [170, 54], 2: [150, 46], 3: [136, 40] };

/** Joli nom d'un dossier : « vie-pratique » → « Vie pratique ». */
export const joliNom = (n: string): string => (n ? n.charAt(0).toUpperCase() + n.slice(1).replace(/-/g, " ") : "Cerveau");

/** Les blocs de la carte : le cerveau, ses lobes, leurs aires et noyaux (au-delà, on les voit dans l'aperçu). */
export function blocs(arbre: NoeudArbre, positions: Record<string, [number, number]> = {}): Bloc[] {
  const sortie: Bloc[] = [];
  const lobes = arbre.enfants;
  const totalLobes = lobes.reduce((s, l) => s + Math.sqrt(l.total + 1), 0) || 1;
  const ajouter = (n: NoeudArbre, niveau: Niveau, parent: string | null, lobe: string, x: number, y: number) => {
    const [l, h] = TAILLES[niveau];
    const p = positions[n.rel];
    sortie.push({ rel: n.rel, nom: niveau === 0 ? "Cerveau" : joliNom(n.nom), niveau, parent, total: n.total, x: p?.[0] ?? x, y: p?.[1] ?? y, l, h, lobe });
  };
  ajouter(arbre, 0, null, "", 0, 0);
  // les lobes se partagent le tour du cerveau selon leur taille ; leurs descendants partent vers l'extérieur, en grappe
  let angle = -Math.PI / 2;
  for (const lobe of lobes) {
    const part = (Math.sqrt(lobe.total + 1) / totalLobes) * Math.PI * 2;
    const a = angle + part / 2;
    angle += part;
    const rayon = 380;
    const lx = Math.cos(a) * rayon;
    const ly = Math.sin(a) * rayon * 0.72;
    ajouter(lobe, 1, arbre.rel, lobe.rel, lx, ly);
    const aires = lobe.enfants;
    aires.forEach((aire, i) => {
      // éventail vers l'extérieur, plus ouvert quand il y a beaucoup d'aires
      const ouverture = Math.min(Math.PI * 0.9, 0.35 * aires.length);
      const b = a + (aires.length === 1 ? 0 : -ouverture / 2 + (ouverture * i) / (aires.length - 1));
      const r2 = 250 + (i % 2) * 70;
      const ax = lx + Math.cos(b) * r2;
      const ay = ly + Math.sin(b) * r2 * 0.8;
      ajouter(aire, 2, lobe.rel, lobe.rel, ax, ay);
      aire.enfants.forEach((noyau, k) => {
        const c = b + (k - (aire.enfants.length - 1) / 2) * 0.5;
        ajouter(noyau, 3, aire.rel, lobe.rel, ax + Math.cos(c) * 200, ay + Math.sin(c) * 150);
      });
    });
  }
  ecarter(sortie, positions);
  return sortie;
}

const chevauche = (a: Bloc, b: Bloc, marge: number) => Math.abs(a.x - b.x) < (a.l + b.l) / 2 + marge && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + marge;

/** Écarte les blocs qui se touchent (les blocs posés à la main par Bryan ne bougent pas). */
export function ecarter(liste: Bloc[], fixes: Record<string, unknown> = {}, marge = 34): void {
  for (let tour = 0; tour < 200; tour++) {
    let bouge = false;
    for (let i = 0; i < liste.length; i++) {
      for (let j = i + 1; j < liste.length; j++) {
        const a = liste[i]!;
        const b = liste[j]!;
        if (!chevauche(a, b, marge)) continue;
        bouge = true;
        const dx = b.x - a.x || 1;
        const dy = b.y - a.y || 1;
        const d = Math.hypot(dx, dy);
        const pas = 12;
        const fa = a.niveau === 0 || a.rel in fixes ? 0 : b.niveau === 0 || b.rel in fixes ? 2 : 1;
        const fb = 2 - fa;
        a.x -= (dx / d) * pas * (fa / 2);
        a.y -= (dy / d) * pas * (fa / 2);
        b.x += (dx / d) * pas * (fb / 2);
        b.y += (dy / d) * pas * (fb / 2);
      }
    }
    if (!bouge) return;
  }
}

/** Points d'une courbe de Bézier cubique. */
export function echantillons(p0: Point, c1: Point, c2: Point, p1: Point, n = 32): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
    };
  });
}

const dansBloc = (p: Point, b: Bloc, marge = 10) => Math.abs(p.x - b.x) < b.l / 2 + marge && Math.abs(p.y - b.y) < b.h / 2 + marge;

/** Bord du bloc dans la direction d'un point : un lien part du bord, pas du centre. */
export function bord(b: Bloc, vers: Point): Point {
  const dx = vers.x - b.x;
  const dy = vers.y - b.y;
  const k = Math.min(Math.abs(dx) > 0 ? b.l / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 0 ? b.h / 2 / Math.abs(dy) : Infinity);
  return { x: b.x + dx * k, y: b.y + dy * k };
}

export interface Lien {
  de: string;
  vers: string;
  genre: "axone" | "synapse";
  d: string;
  points: Point[];
}

/**
 * Trace un lien entre deux blocs : une courbe, qu'on plie jusqu'à ce qu'elle ne passe plus sur aucun autre bloc
 * (plusieurs virages si besoin : la courbe passe alors par un point de détour).
 */
export function tracer(a: Bloc, b: Bloc, tous: Bloc[], genre: Lien["genre"]): Lien {
  const autres = tous.filter((x) => x !== a && x !== b);
  const p0 = bord(a, b);
  const p1 = bord(b, a);
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const long = Math.hypot(dx, dy) || 1;
  const nx = -dy / long;
  const ny = dx / long;
  const essai = (pli: number) => {
    const c1 = { x: p0.x + dx * 0.33 + nx * pli, y: p0.y + dy * 0.33 + ny * pli };
    const c2 = { x: p0.x + dx * 0.66 + nx * pli, y: p0.y + dy * 0.66 + ny * pli };
    return { c1, c2, pts: echantillons(p0, c1, c2, p1) };
  };
  const base = genre === "synapse" ? 40 : 18;
  for (const pli of [base, -base, base * 3, -base * 3, base * 6, -base * 6, base * 10, -base * 10]) {
    const { c1, c2, pts } = essai(pli);
    if (!pts.some((p) => autres.some((o) => dansBloc(p, o)))) {
      return { de: a.rel, vers: b.rel, genre, d: `M${p0.x},${p0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p1.x},${p1.y}`, points: pts };
    }
  }
  // détour : par un point écarté du milieu, en deux courbes
  for (const loin of [160, -160, 260, -260, 380, -380]) {
    const m = { x: p0.x + dx / 2 + nx * loin, y: p0.y + dy / 2 + ny * loin };
    const premier = echantillons(p0, { x: p0.x + nx * loin * 0.6, y: p0.y + ny * loin * 0.6 }, { x: m.x - dx * 0.2, y: m.y - dy * 0.2 }, m, 16);
    const second = echantillons(m, { x: m.x + dx * 0.2, y: m.y + dy * 0.2 }, { x: p1.x + nx * loin * 0.6, y: p1.y + ny * loin * 0.6 }, p1, 16);
    const pts = [...premier, ...second.slice(1)];
    if (!pts.some((p) => autres.some((o) => dansBloc(p, o)))) {
      const d =
        `M${p0.x},${p0.y} C${p0.x + nx * loin * 0.6},${p0.y + ny * loin * 0.6} ${m.x - dx * 0.2},${m.y - dy * 0.2} ${m.x},${m.y} ` +
        `C${m.x + dx * 0.2},${m.y + dy * 0.2} ${p1.x + nx * loin * 0.6},${p1.y + ny * loin * 0.6} ${p1.x},${p1.y}`;
      return { de: a.rel, vers: b.rel, genre, d, points: pts };
    }
  }
  const { c1, c2, pts } = essai(base);
  return { de: a.rel, vers: b.rel, genre, d: `M${p0.x},${p0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p1.x},${p1.y}`, points: pts };
}

/** Intersection de deux segments, ou null. */
function croise(a: Point, b: Point, c: Point, d: Point): Point | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}

/** Les croisements entre liens (pour y poser un pont), avec la direction du lien qui passe par-dessus. */
export function croisements(liens: Lien[]): (Point & { angle: number })[] {
  const sortie: (Point & { angle: number })[] = [];
  for (let i = 0; i < liens.length; i++) {
    for (let j = i + 1; j < liens.length; j++) {
      const A = liens[i]!.points;
      const B = liens[j]!.points;
      for (let k = 0; k < A.length - 1; k++) {
        for (let m = 0; m < B.length - 1; m++) {
          const p = croise(A[k]!, A[k + 1]!, B[m]!, B[m + 1]!);
          if (p) sortie.push({ ...p, angle: Math.atan2(B[m + 1]!.y - B[m]!.y, B[m + 1]!.x - B[m]!.x) });
        }
      }
    }
  }
  return sortie;
}

/** Les liens de la carte : un axone par parent → enfant, une synapse par paire de dossiers qui se citent (les blocs affichés). */
export function liens(liste: Bloc[], synapses: { a: string; b: string; n: number }[]): Lien[] {
  const par = new Map(liste.map((b) => [b.rel, b]));
  const sortie: Lien[] = [];
  for (const b of liste) {
    const p = b.parent !== null ? par.get(b.parent) : undefined;
    if (p) sortie.push(tracer(p, b, liste, "axone"));
  }
  for (const s of synapses) {
    const a = par.get(s.a);
    const b = par.get(s.b);
    if (a && b) sortie.push(tracer(a, b, liste, "synapse"));
  }
  return sortie;
}

/** Icône par défaut d'un dossier, d'après son nom. */
export function iconeParDefaut(rel: string): string {
  const n = rel.toLowerCase();
  const table: [RegExp, string][] = [
    [/^$/, "🧠"],
    [/^moi\/$/, "🙂"],
    [/entourage|famille/, "💞"],
    [/infra|serveur/, "⚙️"],
    [/savoir/, "📚"],
    [/travail|retux/, "🛠️"],
    [/vie-pratique/, "🏠"],
    [/^projets\/$/, "🚀"],
    [/etablink/, "🔩"],
    [/etable/, "🧱"],
    [/quotidien/, "☀️"],
    [/max/, "🪨"],
    [/cerveau/, "🧠"],
    [/site/, "🌐"],
    [/erp/, "📦"],
    [/courrier|mail/, "✉️"],
    [/absence/, "🧳"],
    [/chaudronnerie/, "🔥"],
    [/prospect/, "🎯"],
    [/abandonn/, "🪦"],
  ];
  return table.find(([r]) => r.test(n))?.[1] ?? "📁";
}

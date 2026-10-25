// L'île pousse sur une grille de cases invisibles. Chaque module (bâtiment) demande un rectangle de cases ; on le pose
// en spirale autour du centre, sur la première place libre, avec une bande vide autour (chemins, arbres, de l'air).
// Les modules déjà posés ne bougent jamais : un nouveau module fait pousser un nouveau morceau d'île. Sans limite.

/** Taille d'une case, en unités du monde. */
export const CASE = 3.2;

export interface Module {
  id: string;
  /** Largeur et profondeur en cases. */
  cases: [number, number];
}

export interface Place {
  id: string;
  /** Case du coin (grille). */
  i: number;
  j: number;
  cases: [number, number];
  /** Centre dans le monde. */
  x: number;
  z: number;
}

/** Les cases en spirale autour de l'origine, de la plus proche à la plus lointaine (ordre stable). */
function* spirale(): Generator<[number, number]> {
  yield [0, 0];
  for (let r = 1; ; r++) {
    const anneau: [number, number][] = [];
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) anneau.push([i, j]);
    anneau.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    yield* anneau;
  }
}

/** Pose les modules dans l'ordre donné. Le même début de liste donne toujours les mêmes places. */
export function placer(modules: Module[], marge = 1): Place[] {
  const occupees = new Set<string>();
  const cle = (i: number, j: number) => `${i},${j}`;
  const places: Place[] = [];
  for (const m of modules) {
    const [l, p] = m.cases;
    for (const [ci, cj] of spirale()) {
      const i0 = ci - Math.floor(l / 2);
      const j0 = cj - Math.floor(p / 2);
      let libre = true;
      for (let i = i0 - marge; i < i0 + l + marge && libre; i++) for (let j = j0 - marge; j < j0 + p + marge && libre; j++) if (occupees.has(cle(i, j))) libre = false;
      if (!libre) continue;
      for (let i = i0; i < i0 + l; i++) for (let j = j0; j < j0 + p; j++) occupees.add(cle(i, j));
      places.push({ id: m.id, i: i0, j: j0, cases: [l, p], x: (i0 + l / 2) * CASE, z: (j0 + p / 2) * CASE });
      break;
    }
  }
  return places;
}

/** Bruit de valeur 2D lisse, déterministe, dans [0, 1]. */
export function bruit2(x: number, z: number): number {
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = h(xi, zi);
  const b = h(xi + 1, zi);
  const c = h(xi, zi + 1);
  const d = h(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Bruit fractal (plusieurs échelles) dans [0, 1]. */
export const fbm = (x: number, z: number): number => (bruit2(x, z) * 0.55 + bruit2(x * 2.1 + 5, z * 2.1 + 3) * 0.3 + bruit2(x * 4.3 + 9, z * 4.3 + 1) * 0.15);

/**
 * Distance signée à la côte (négative sur la terre) : chaque place gonfle d'un peu plus d'une case autour d'elle,
 * les places voisines se fondent en douceur, et un bruit rend le rivage irrégulier (criques, pointes).
 */
export function cote(places: Place[], x: number, z: number): number {
  let d = Infinity;
  for (const p of places) {
    const dx = Math.max(Math.abs(x - p.x) - (p.cases[0] * CASE) / 2, 0);
    const dz = Math.max(Math.abs(z - p.z) - (p.cases[1] * CASE) / 2, 0);
    const di = Math.hypot(dx, dz) - CASE * 1.15;
    // union douce : les morceaux de terre se soudent sans angle
    const k = 3;
    const hh = Math.max(k - Math.abs(d - di), 0) / k;
    d = Math.min(d, di) - hh * hh * k * 0.25;
  }
  return d + (fbm(x * 0.16, z * 0.16) - 0.5) * 4.2 + (fbm(x * 0.5 + 20, z * 0.5) - 0.5) * 1.1;
}

/** Hauteur du sol : plateau doux sur la terre, pente vers une plage irrégulière, puis le fond qui descend. */
export function hauteur(places: Place[], x: number, z: number): number {
  const d = cote(places, x, z);
  const plateau = 0.55 + (fbm(x * 0.22 + 40, z * 0.22) - 0.5) * 0.3;
  if (d < -2.2) return plateau;
  if (d < -0.3) {
    const t = (d + 2.2) / 1.9;
    return plateau + (0.12 - plateau) * t * t;
  }
  if (d < 0.5) return 0.12 - (d + 0.3) * 0.35;
  return Math.max(-1.6, -0.16 - (d - 0.5) * 0.45);
}

/** Les modules de base de Hameau, dans l'ordre de pose (ne jamais réordonner : on ajoute à la fin). */
export const MODULES_DE_BASE: Module[] = [
  { id: "panneau", cases: [1, 1] },
  { id: "bibliotheque", cases: [2, 1] },
  { id: "poste", cases: [1, 1] },
  { id: "mairie", cases: [1, 1] },
  { id: "maison", cases: [1, 1] },
  { id: "cabane", cases: [1, 1] },
  { id: "atelier", cases: [1, 1] },
  { id: "centrale", cases: [2, 1] },
  { id: "gare", cases: [1, 1] },
];

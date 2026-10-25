// Le réseau routier du quartier : des routes courbes (suites de points lissées) et le graphe qui sert aux personnages à
// marcher par les routes plutôt qu'à travers les bâtiments. Calculs purs (sans three.js), testés.

export type Pt = [number, number];

/** Point d'une courbe de Catmull-Rom centripète passant par `p` (t de 0 à 1 sur le segment i → i+1). */
function catmull(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** Échantillonne une route lissée tous les `pas` environ (le premier et le dernier point sont exacts). */
export function echantillonner(points: Pt[], pas = 1.2): Pt[] {
  const sortie: Pt[] = [points[0]!];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / pas));
    for (let k = 1; k <= n; k++) sortie.push(k === n ? p2 : catmull(p0, p1, p2, p3, k / n));
  }
  return sortie;
}

export interface Graphe {
  noeuds: Pt[];
  voisins: number[][];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Graphe des routes : chaque échantillon est un nœud ; deux nœuds très proches (carrefours) sont reliés. */
export function graphe(routes: Pt[][], pas = 1.2): Graphe {
  const noeuds: Pt[] = [];
  const voisins: number[][] = [];
  const lier = (a: number, b: number) => {
    if (a === b || voisins[a]!.includes(b)) return;
    voisins[a]!.push(b);
    voisins[b]!.push(a);
  };
  for (const r of routes) {
    let precedent = -1;
    for (const p of echantillonner(r, pas)) {
      // un point déjà connu (départ d'une route sur une autre) : on réutilise le nœud
      let i = noeuds.findIndex((q) => dist(q, p) < 0.05);
      if (i < 0) {
        i = noeuds.length;
        noeuds.push(p);
        voisins.push([]);
      }
      if (precedent >= 0) lier(precedent, i);
      precedent = i;
    }
  }
  for (let a = 0; a < noeuds.length; a++) for (let b = a + 1; b < noeuds.length; b++) if (dist(noeuds[a]!, noeuds[b]!) < pas * 0.8) lier(a, b);
  return { noeuds, voisins };
}

export const plusProche = (g: Graphe, p: Pt): number => g.noeuds.reduce((m, q, i) => (dist(q, p) < dist(g.noeuds[m]!, p) ? i : m), 0);

/** Chemin le plus court (Dijkstra) entre deux points du monde : on rejoint la route, on la suit, on la quitte. */
export function chemin(g: Graphe, de: Pt, vers: Pt): Pt[] {
  const a = plusProche(g, de);
  const b = plusProche(g, vers);
  const d = new Array<number>(g.noeuds.length).fill(Infinity);
  const prec = new Array<number>(g.noeuds.length).fill(-1);
  const vu = new Array<boolean>(g.noeuds.length).fill(false);
  d[a] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < d.length; i++) if (!vu[i] && d[i]! < Infinity && (u < 0 || d[i]! < d[u]!)) u = i;
    if (u < 0 || u === b) break;
    vu[u] = true;
    for (const v of g.voisins[u]!) {
      const nd = d[u]! + dist(g.noeuds[u]!, g.noeuds[v]!);
      if (nd < d[v]!) {
        d[v] = nd;
        prec[v] = u;
      }
    }
  }
  const pts: Pt[] = [];
  for (let u = b; u >= 0; u = prec[u]!) pts.unshift(g.noeuds[u]!);
  if (pts[0] !== g.noeuds[a]) return [de, vers];
  return [de, ...pts, vers];
}

/** Longueur d'un trajet. */
export const longueur = (pts: Pt[]): number => pts.slice(1).reduce((s, p, i) => s + dist(pts[i]!, p), 0);

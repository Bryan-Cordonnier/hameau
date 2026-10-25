// Disposition aléatoire mais orthogonale du quartier : on découpe le terrain en rectangles, récursivement ; chaque coupe
// est une rue droite qui s'arrête sur une rue existante (carrefours en T, rues décalées, impasses, jamais de grille). Les
// îlots obtenus ont toutes les tailles ; chaque zone prend celui qui lui va, tournée d'un quart de tour si besoin pour
// que sa porte donne sur une rue. Le même germe donne toujours le même quartier.

export interface Segment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Côtés bordés par une rue : nord (z0), sud (z1), ouest (x0), est (x1). */
  rues: { n: boolean; s: boolean; o: boolean; e: boolean };
}

export interface Besoin {
  id: string;
  /** Taille minimale de la parcelle dans le repère du bâtiment (largeur, profondeur). */
  l: number;
  p: number;
}

export interface Placement {
  id: string;
  x: number;
  z: number;
  l: number;
  p: number;
  /** Quart de tour : 0, π/2, π, -π/2 ; la porte (côté +z local) donne sur une rue. */
  r: number;
}

/** Hasard déterministe. */
export function germe(n: number): () => number {
  let s = n >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Marge entre l'axe d'une rue et une parcelle (demi-route + trottoir + de l'air). */
export const MARGE = 3.2;

export function decouper(region: Rect, hasard: () => number, taille = 17): { segments: Segment[]; ilots: Rect[] } {
  const segments: Segment[] = [];
  const ilots: Rect[] = [];
  const couper = (r: Rect, profondeur: number) => {
    const l = r.x1 - r.x0;
    const h = r.z1 - r.z0;
    const peutV = l > taille * 1.4;
    const peutH = h > taille * 1.4;
    // on s'arrête parfois plus tôt : des îlots plus grands, pour la variété
    if ((!peutV && !peutH) || (profondeur > 2 && l < taille * 2.2 && h < taille * 2.2 && hasard() < 0.25)) {
      ilots.push(r);
      return;
    }
    const vertical = peutV && (!peutH || l / h > 1.25 || (h / l <= 1.25 && hasard() < 0.5));
    const t = 0.3 + hasard() * 0.4;
    if (vertical) {
      const x = Math.round(r.x0 + l * t);
      segments.push({ x1: x, z1: r.z0, x2: x, z2: r.z1 });
      couper({ x0: r.x0, z0: r.z0, x1: x, z1: r.z1, rues: { ...r.rues, e: true } }, profondeur + 1);
      couper({ x0: x, z0: r.z0, x1: r.x1, z1: r.z1, rues: { ...r.rues, o: true } }, profondeur + 1);
    } else {
      const z = Math.round(r.z0 + h * t);
      segments.push({ x1: r.x0, z1: z, x2: r.x1, z2: z });
      couper({ x0: r.x0, z0: r.z0, x1: r.x1, z1: z, rues: { ...r.rues, s: true } }, profondeur + 1);
      couper({ x0: r.x0, z0: z, x1: r.x1, z1: r.z1, rues: { ...r.rues, n: true } }, profondeur + 1);
    }
  };
  couper(region, 0);
  return { segments, ilots };
}

/** Le rectangle constructible d'un îlot (en retrait des rues). */
export function interieur(r: Rect): { x0: number; z0: number; x1: number; z1: number } {
  return { x0: r.x0 + (r.rues.o ? MARGE : 1), z0: r.z0 + (r.rues.n ? MARGE : 1), x1: r.x1 - (r.rues.e ? MARGE : 1), z1: r.z1 - (r.rues.s ? MARGE : 1) };
}

/** Pose chaque zone sur le plus petit îlot qui lui suffit, la porte tournée vers une rue. Rend aussi les îlots restants. */
export function placer(ilots: Rect[], besoins: Besoin[]): { places: Placement[]; restes: Rect[] } {
  const libres = [...ilots];
  const places: Placement[] = [];
  for (const b of besoins) {
    let meilleur: { i: number; aire: number; pl: Placement } | null = null;
    libres.forEach((r, i) => {
      const c = interieur(r);
      const w = c.x1 - c.x0;
      const h = c.z1 - c.z0;
      const x = (c.x0 + c.x1) / 2;
      const z = (c.z0 + c.z1) / 2;
      // orientations possibles : la porte (+z local) vers le sud, le nord, l'est ou l'ouest, s'il y a une rue
      const options: Placement[] = [];
      if (r.rues.s && w >= b.l && h >= b.p) options.push({ id: b.id, x, z, l: w, p: h, r: 0 });
      if (r.rues.e && h >= b.l && w >= b.p) options.push({ id: b.id, x, z, l: h, p: w, r: Math.PI / 2 });
      if (r.rues.n && w >= b.l && h >= b.p) options.push({ id: b.id, x, z, l: w, p: h, r: Math.PI });
      if (r.rues.o && h >= b.l && w >= b.p) options.push({ id: b.id, x, z, l: h, p: w, r: -Math.PI / 2 });
      const pl = options[0];
      if (pl && (!meilleur || w * h < meilleur.aire)) meilleur = { i, aire: w * h, pl };
    });
    if (!meilleur) continue;
    const m = meilleur as { i: number; aire: number; pl: Placement };
    places.push(m.pl);
    libres.splice(m.i, 1);
  }
  return { places, restes: libres };
}

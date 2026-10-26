// Le plan du bureau fixe de l'accueil : une pièce en perspective isométrique (cases de 1 × 1), des meubles en blocs et
// les postes où les agents s'arrêtent. Les agents marchent en « L » (d'abord en x, puis en y) pour suivre la grille.

export const CASE = 52; // demi-largeur d'une case à l'écran (px)
export const LARGEUR = 12;
export const PROFONDEUR = 8;

export interface Point {
  x: number;
  y: number;
}

/** Projection isométrique d'un point (x, y au sol, z en hauteur) vers l'écran. */
export function iso(x: number, y: number, z = 0): { X: number; Y: number } {
  return { X: (x - y) * CASE, Y: ((x + y) * CASE) / 2 - z * CASE * 0.95 };
}

export type Teinte = "meuble" | "clair" | "bois" | "ecran" | "plante" | "voyant" | "liege";

export interface Bloc {
  x: number;
  y: number;
  l: number;
  p: number;
  h: number;
  z?: number;
  teinte: Teinte;
  /** Couleur propre (post-it…), à la place de la teinte. */
  couleur?: string;
}

export interface Poste extends Point {
  nom: string;
  emoji: string;
}

/** Les postes : où l'agent se tient pour chaque zone (deux places par zone, pour ne pas s'empiler). */
export const POSTES: Record<string, { nom: string; emoji: string; places: Point[] }> = {
  boss: { nom: "Bureau de Max", emoji: "🟣", places: [{ x: 2.7, y: 1.55 }, { x: 3.6, y: 2.0 }] },
  dev: { nom: "Poste de développement", emoji: "💻", places: [{ x: 6.22, y: 1.62 }, { x: 7.62, y: 1.62 }] },
  secretariat: { nom: "Courrier", emoji: "📮", places: [{ x: 1.7, y: 4.7 }, { x: 2.6, y: 5.6 }] },
  archives: { nom: "Archives du cerveau", emoji: "🧠", places: [{ x: 10.2, y: 2.2 }, { x: 10.2, y: 3.2 }] },
  taches: { nom: "Mur des tâches", emoji: "📋", places: [{ x: 4.6, y: 1.3 }, { x: 4.1, y: 1.9 }] },
  reunion: { nom: "Table des chantiers", emoji: "🏗️", places: [{ x: 5.2, y: 4.87 }, { x: 7.6, y: 4.87 }] },
  serveur: { nom: "Serveur du modèle", emoji: "⚡", places: [{ x: 10.0, y: 5.6 }, { x: 10.0, y: 6.4 }] },
  pause: { nom: "Coin café", emoji: "☕", places: [{ x: 1.4, y: 7.0 }, { x: 2.4, y: 7.0 }] },
};

/** Les meubles, en blocs (coordonnées au sol, largeur l sur x, profondeur p sur y, hauteur h). */
export const BLOCS: Bloc[] = [
  // bureau de Max : grand plateau, écran, fauteuil, plante
  { x: 1.4, y: 0.4, l: 2.2, p: 0.8, h: 0.55, teinte: "bois" },
  { x: 2.1, y: 0.5, l: 0.7, p: 0.12, h: 0.35, z: 0.55, teinte: "ecran" },
  { x: 0.3, y: 0.3, l: 0.5, p: 0.5, h: 0.75, teinte: "plante" },
  { x: 2.45, y: 1.3, l: 0.5, p: 0.5, h: 0.3, teinte: "meuble" },
  // mur des tâches : panneau de liège contre le mur du fond
  { x: 4.0, y: 0.1, l: 1.6, p: 0.15, h: 1.1, z: 0.25, teinte: "liege" },
  ...["#f2c14e", "#ff8fb1", "#7fb7ff", "#7fdca0", "#ffb347", "#f2c14e"].map((couleur, i) => ({
    x: 4.15 + (i % 3) * 0.48, y: 0.26, l: 0.3, p: 0.02, h: 0.3, z: 0.4 + Math.floor(i / 3) * 0.45, teinte: "liege" as Teinte, couleur,
  })),
  // postes de développement : deux bureaux à double écran
  { x: 5.6, y: 0.5, l: 1.2, p: 0.7, h: 0.5, teinte: "meuble" },
  { x: 5.75, y: 0.55, l: 0.4, p: 0.1, h: 0.3, z: 0.5, teinte: "ecran" },
  { x: 6.25, y: 0.55, l: 0.4, p: 0.1, h: 0.3, z: 0.5, teinte: "ecran" },
  { x: 7.0, y: 0.5, l: 1.2, p: 0.7, h: 0.5, teinte: "meuble" },
  { x: 6.0, y: 1.4, l: 0.45, p: 0.45, h: 0.28, teinte: "clair" },
  { x: 7.4, y: 1.4, l: 0.45, p: 0.45, h: 0.28, teinte: "clair" },
  { x: 7.15, y: 0.55, l: 0.4, p: 0.1, h: 0.3, z: 0.5, teinte: "ecran" },
  { x: 7.65, y: 0.55, l: 0.4, p: 0.1, h: 0.3, z: 0.5, teinte: "ecran" },
  // archives : rayonnages le long du mur de droite
  { x: 11.2, y: 0.6, l: 0.5, p: 1.4, h: 1.3, teinte: "meuble" },
  { x: 11.2, y: 2.4, l: 0.5, p: 1.4, h: 1.3, teinte: "meuble" },
  // courrier : comptoir et casiers
  { x: 0.2, y: 3.8, l: 0.6, p: 2.2, h: 0.55, teinte: "clair" },
  { x: 0.2, y: 4.0, l: 0.3, p: 1.8, h: 0.5, z: 0.55, teinte: "bois" },
  // table des chantiers
  { x: 5.6, y: 4.4, l: 1.6, p: 1.0, h: 0.5, teinte: "bois" },
  { x: 5.0, y: 4.65, l: 0.4, p: 0.45, h: 0.28, teinte: "clair" },
  { x: 7.4, y: 4.65, l: 0.4, p: 0.45, h: 0.28, teinte: "clair" },
  // serveur : deux baies et leurs voyants
  { x: 10.9, y: 5.0, l: 0.8, p: 0.7, h: 1.3, teinte: "meuble" },
  { x: 10.9, y: 5.9, l: 0.8, p: 0.7, h: 1.3, teinte: "meuble" },
  { x: 10.85, y: 5.1, l: 0.06, p: 0.5, h: 0.6, z: 0.4, teinte: "voyant" },
  { x: 10.85, y: 6.0, l: 0.06, p: 0.5, h: 0.6, z: 0.4, teinte: "voyant" },
  // coin café : comptoir, machine, canapé, plante
  { x: 0.2, y: 6.9, l: 0.6, p: 0.9, h: 0.6, teinte: "clair" },
  { x: 0.3, y: 7.0, l: 0.35, p: 0.35, h: 0.35, z: 0.6, teinte: "meuble" },
  { x: 3.2, y: 6.5, l: 0.5, p: 1.3, h: 0.35, teinte: "meuble" },
  { x: 11.0, y: 7.2, l: 0.5, p: 0.5, h: 0.75, teinte: "plante" },
  { x: 8.6, y: 0.3, l: 0.5, p: 0.5, h: 0.75, teinte: "plante" },
];

/** Profondeur de dessin : ce qui est plus près de nous (x + y grand) passe devant. */
export const profondeur = (x: number, y: number) => x + y;

/** Trajet en L d'un point à un autre. */
export function trajet(de: Point, vers: Point): Point[] {
  const coude = { x: vers.x, y: de.y };
  return Math.abs(de.x - vers.x) < 0.01 || Math.abs(de.y - vers.y) < 0.01 ? [vers] : [coude, vers];
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

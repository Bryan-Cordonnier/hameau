// Du journal du cerveau au bureau : chaque action (déjà traduite en « lieu + geste » pour l'ancienne île) devient « aller à
// telle zone de l'open space et y faire tel geste ». Pur, sans three.js, pour être testé.
import type { Action, Geste as GesteIle, Lieu } from "../ile/actions";

/** La zone du bureau qui correspond à chaque lieu de l'île. */
export const ZONE: Record<Lieu, string> = {
  poste: "secretariat",
  maison: "secretariat",
  mairie: "reunion",
  chantier: "reunion",
  panneau: "taches",
  bibliotheque: "archives",
  gare: "archives",
  atelier: "dev",
  centrale: "serveur",
  cabane: "boss",
};

/** Ce que fait un agent à son poste. */
export type Geste = "attend" | "tape" | "lit" | "porte" | "telephone" | "cafe" | "dort" | "teste";

const GESTE: Record<GesteIle, Geste> = { lit: "lit", ecrit: "tape", trie: "porte", tablette: "telephone", regarde: "lit", travaille: "tape" };

export interface Consigne {
  agent: string;
  zone: string;
  geste: Geste;
  texte: string;
}

export function consigne(a: Action): Consigne {
  return { agent: a.agent, zone: ZONE[a.lieu], geste: GESTE[a.geste], texte: a.texte };
}

/** Le poste d'attache d'un agent : Max à son bureau, les autres sur le plateau de développement. */
export const attache = (agent: string): string => (agent === "max" ? "boss" : "dev");

/** Le premier poste libre d'une zone (sinon le moins occupé), pour ne pas empiler deux agents au même endroit. */
export function posteLibre(nbPostes: number, occupes: number[]): number {
  const compte = Array.from({ length: nbPostes }, (_, i) => occupes.filter((o) => o === i).length);
  return compte.indexOf(Math.min(...compte));
}

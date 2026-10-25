// Qui est qui dans le hameau : les agents locaux habitent l'île, ceux de l'extérieur (Claude, une API) la visitent.
// Les autres clients du cerveau (l'appli Hameau elle-même, le téléphone) ne sont pas des personnages.

export type Genre = "habitant" | "visiteur";

export interface Habitant {
  /** Nom du client dans le cerveau (« max », « claude-code-pc »). */
  id: string;
  nom: string;
  genre: Genre;
  role: string;
  /** Couleurs du personnage (dégradé du corps). */
  couleurs: [string, string];
  forme: "galet" | "etoile";
}

const CONNUS: Record<string, Omit<Habitant, "id">> = {
  max: { nom: "Max", genre: "habitant", role: "Assistant personnel", couleurs: ["#ffb37a", "#f2785a"], forme: "galet" },
};

/** Les clients du cerveau qui ne sont pas des agents. */
const PAS_DES_AGENTS = /^(hameau|bryan|telephone.*|panneau|cerveau)$/;

export function habitant(id: string): Habitant | null {
  if (PAS_DES_AGENTS.test(id)) return null;
  const connu = CONNUS[id];
  if (connu) return { id, ...connu };
  if (id.startsWith("claude")) return { id, nom: "Claude", genre: "visiteur", role: "Développeur (Claude Code)", couleurs: ["#e9925f", "#c9643a"], forme: "etoile" };
  return { id, nom: id.charAt(0).toUpperCase() + id.slice(1), genre: "visiteur", role: "Agent", couleurs: ["#9fc6f0", "#5d7fc4"], forme: "galet" };
}

/** Nom affiché d'un client ; ce que l'appli Hameau écrit (auteur « hameau »), c'est Bryan qui l'a écrit. */
export const nomDe = (id: string): string => habitant(id)?.nom ?? (id === "bryan" || id === "hameau" ? "Toi" : id);

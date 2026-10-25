// Ce que font les personnages de l'île : chaque action du journal du cerveau devient « aller à tel bâtiment et y faire telle
// chose ». Le temps est ralenti et équilibré : une lecture de 0,3 s dure au moins quelques secondes à l'écran ; si le retard
// s'accumule, les personnages passent en avance rapide.
import type { Evenement } from "@hameau/commun";

export type Lieu = "poste" | "bibliotheque" | "panneau" | "mairie" | "maison" | "cabane" | "gare" | "atelier" | "centrale" | "chantier";
export type Geste = "lit" | "ecrit" | "trie" | "tablette" | "regarde" | "travaille";

export interface Action {
  id: number;
  agent: string;
  lieu: Lieu;
  /** Pour un chantier : son numéro (bâtiment propre). */
  chantier?: number;
  geste: Geste;
  texte: string;
  quand: number;
}

/** Où va un agent pour une action du journal, et ce qu'il y fait. null : rien à montrer (lecture technique). */
export function actionDe(e: Evenement): Omit<Action, "id" | "agent" | "quand"> | null {
  const a = e.action;
  const c = e.cible;
  const texte = e.resume || a;
  if (a === "presence.read" || a === "presence.write" || a === "harness.use" || a === "confirmation.decision") return null;
  if (a === "session.briefing") return { lieu: "panneau", geste: "regarde", texte: "lit le briefing" };
  if (a.startsWith("mail.")) return { lieu: "poste", geste: a === "mail.state" ? "trie" : a === "mail.draft" ? "ecrit" : "lit", texte };
  if (a === "report.write") return { lieu: "poste", geste: "ecrit", texte: `rapport : ${texte}` };
  if (a.startsWith("library.")) return { lieu: "bibliotheque", geste: a === "library.write" ? "ecrit" : "lit", texte: c ? `${a === "library.write" ? "écrit" : "lit"} ${c}` : texte };
  if (a === "task.create" || c.startsWith("tache/")) return { lieu: "panneau", geste: "ecrit", texte };
  if (c.startsWith("chantier/")) {
    const n = Number(c.slice(9));
    return { lieu: "chantier", ...(n > 0 ? { chantier: n } : {}), geste: "travaille", texte };
  }
  if (c.startsWith("courrier")) return { lieu: "poste", geste: "lit", texte };
  if (a.startsWith("quotidien.")) {
    if (c.includes("agenda") || c.includes("travail")) return { lieu: "mairie", geste: a.endsWith("write") ? "ecrit" : "lit", texte };
    return { lieu: "maison", geste: a.endsWith("write") ? "ecrit" : "regarde", texte };
  }
  if (a === "web.search") return { lieu: "gare", geste: "regarde", texte: `cherche : ${texte}` };
  if (a === "ia.use") return { lieu: "centrale", geste: "regarde", texte };
  if (a.startsWith("hameau.")) return { lieu: "panneau", geste: "regarde", texte };
  return { lieu: "atelier", geste: "travaille", texte };
}

/** Les actions à jouer, dans l'ordre, pour une liste d'événements (les lectures techniques sont ignorées). */
export function actions(evs: Evenement[]): Action[] {
  const sortie: Action[] = [];
  for (const e of evs) {
    const a = actionDe(e);
    if (!a) continue;
    const derniere = sortie[sortie.length - 1];
    // la même chose au même endroit, d'affilée : une seule action (trier 40 mails = rester à la poste)
    if (derniere && derniere.agent === e.agent && derniere.lieu === a.lieu && derniere.geste === a.geste && derniere.chantier === a.chantier) {
      derniere.texte = a.texte;
      derniere.quand = e.quand;
      continue;
    }
    sortie.push({ id: e.id, agent: e.agent, quand: e.quand, ...a });
  }
  return sortie;
}

/** Durées à l'écran (ms) : marcher, puis faire. Avec du retard (beaucoup d'actions en attente), tout va plus vite. */
export function durees(enAttente: number, distance: number): { marche: number; geste: number; vitesse: number } {
  const vitesse = enAttente > 12 ? 4 : enAttente > 5 ? 2 : 1;
  return { marche: Math.max(900, distance * 420) / vitesse, geste: 2600 / vitesse, vitesse };
}

/** Lieu où un agent va dormir après un moment sans rien faire : sa cabane pour un habitant, la gare (il repart) pour un visiteur. */
export const repos = (visiteur: boolean): Lieu => (visiteur ? "gare" : "cabane");

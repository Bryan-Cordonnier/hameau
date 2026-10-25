// Le tableau des tâches : présentation des trois types et de la règle « qui d'autre a le droit », et la récurrence à envoyer au cerveau.
import type { Tache, TypeTache } from "@hameau/commun";

export const TYPES: Record<TypeTache, { nom: string; emoji: string; couleur: string; aide: string }> = {
  mission: { nom: "Mission", emoji: "🎯", couleur: "#e86a4f", aide: "à faire une fois" },
  routine: { nom: "Routine", emoji: "🔁", couleur: "#3f9d6a", aide: "revient sans fin" },
  expedition: { nom: "Expédition", emoji: "🎒", couleur: "#5d7fc4", aide: "revient pendant une durée limitée" },
};

/** « tous », « personne », « liste:max,claude-code-pc » → phrase. */
export function autresTexte(autres: string, nomDe: (id: string) => string): string {
  if (autres === "personne") return "personne d'autre";
  if (autres.startsWith("liste:")) return `aussi : ${autres.slice(6).split(",").map(nomDe).join(", ")}`;
  return "n'importe qui";
}

/** Récurrence du cerveau à partir du formulaire : « daily:08:00 », « every:60 » ou rien. */
export function recurrence(type: TypeTache, heure: string, toutesLesMinutes: number | null): string {
  if (type === "mission") return "";
  if (toutesLesMinutes && toutesLesMinutes >= 5) return `every:${Math.round(toutesLesMinutes)}`;
  return /^\d{2}:\d{2}$/.test(heure) ? `daily:${heure}` : "daily:08:00";
}

/** Rythme lisible d'une tâche (« tous les jours à 08:00 », « toutes les 60 min »). */
export function rythme(t: Pick<Tache, "recurrence" | "fin" | "type">): string {
  const r = t.recurrence;
  let s = "une fois";
  if (r.startsWith("daily:")) s = `tous les jours à ${r.slice(6).split(",").join(", ")}`;
  else if (r.startsWith("every:")) s = `toutes les ${r.slice(6)} min`;
  return t.type === "expedition" && t.fin ? `${s}, jusqu'au ${t.fin}` : s;
}

/** Avancement d'une expédition : celui donné par l'agent, sinon le temps écoulé entre la création et la fin. */
export function avancement(t: Pick<Tache, "avancement" | "debut" | "fin_s" | "type">, maintenant = Date.now() / 1000): number | null {
  if (t.avancement !== null) return t.avancement;
  if (t.type !== "expedition" || !t.fin_s || t.fin_s <= t.debut) return null;
  return Math.max(0, Math.min(100, Math.round(((maintenant - t.debut) / (t.fin_s - t.debut)) * 100)));
}

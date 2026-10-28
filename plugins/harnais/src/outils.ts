// Calculs purs des pages de l'AGL (tâches, projets, automatisations), testés à part.
import type { Carte, Declencheur, Objectif, Projet, Statut } from "@hameau/commun";

export const COLONNES: Statut[] = ["a_faire", "en_cours", "termine", "bloque"];

/** Les cartes d'un tableau, par colonne, dans l'ordre (la plus urgente en haut). */
export function colonnes(cartes: Carte[], tableau: number): Record<Statut, Carte[]> {
  const r: Record<Statut, Carte[]> = { a_faire: [], en_cours: [], termine: [], bloque: [] };
  for (const c of cartes) if (c.tableau === tableau && !c.archive) r[c.statut].push(c);
  for (const s of COLONNES) r[s].sort((a, b) => a.ordre - b.ordre || a.id - b.id);
  return r;
}

/** Déplace une carte dans sa colonne : nouvel ordre des ids (Bryan ne change pas une carte de colonne). */
export function deplacer(ids: number[], id: number, vers: number): number[] {
  const sans = ids.filter((x) => x !== id);
  sans.splice(Math.max(0, Math.min(vers, sans.length)), 0, id);
  return sans;
}

/** L'objectif sur lequel la road map est centrée : le premier qui n'est ni atteint ni abandonné. */
export function prochainObjectif(objectifs: Objectif[]): number {
  const i = objectifs.findIndex((o) => o.etat !== "atteint" && o.etat !== "abandonne");
  return i === -1 ? Math.max(0, objectifs.length - 1) : i;
}

/** Avancement d'un projet : les objectifs atteints (sinon rien). */
export function avancementProjet(p: Projet): number | null {
  const utiles = p.objectifs.filter((o) => o.etat !== "abandonne");
  if (!utiles.length) return null;
  return Math.round((100 * utiles.filter((o) => o.etat === "atteint").length) / utiles.length);
}

const JOURS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export const NOMS_EVENEMENTS: Record<string, string> = {
  mail_recu: "Mail reçu",
  disque_malade: "Disque malade",
  disque_plein: "Disque presque plein",
  chauffe: "Le serveur chauffe",
  memoire_saturee: "Mémoire saturée",
  redemarrage: "Redémarrage imprévu",
  service_arrete: "Service ou VM arrêté",
  sauvegarde_ratee: "Sauvegarde ratée",
  connexion_suspecte: "Connexion suspecte",
  commande: "Nouvelle commande",
};

/** Les événements que chaque connecteur propose, avec les champs qu'on peut filtrer. */
export const CATALOGUE: Record<string, { nom: string; evenements: Record<string, { champ: string; nom: string; genre: "texte" | "nombre" | "oui" }[]> }> = {
  mail: {
    nom: "Boîte mail",
    evenements: {
      mail_recu: [
        { champ: "boite", nom: "Boîte", genre: "texte" },
        { champ: "expediteur", nom: "Expéditeur", genre: "texte" },
        { champ: "domaine", nom: "Domaine de l'expéditeur", genre: "texte" },
        { champ: "objet", nom: "Objet", genre: "texte" },
        { champ: "texte", nom: "Texte", genre: "texte" },
        { champ: "piece_jointe", nom: "Pièce jointe", genre: "oui" },
        { champ: "nouvel_expediteur", nom: "Expéditeur jamais vu", genre: "oui" },
        { champ: "reponse", nom: "Réponse à un mail envoyé", genre: "oui" },
        { champ: "heure", nom: "Heure (HH:MM)", genre: "texte" },
        { champ: "week_end", nom: "Le week-end", genre: "oui" },
      ],
    },
  },
  serveur: {
    nom: "Serveur",
    evenements: {
      disque_malade: [{ champ: "disque", nom: "Disque", genre: "texte" }, { champ: "secteurs", nom: "Secteurs défectueux", genre: "nombre" }],
      disque_plein: [{ champ: "volume", nom: "Volume", genre: "texte" }, { champ: "pourcent", nom: "Remplissage (%)", genre: "nombre" }],
      chauffe: [{ champ: "composant", nom: "Composant", genre: "texte" }, { champ: "temperature", nom: "Température (°C)", genre: "nombre" }],
      memoire_saturee: [{ champ: "pourcent", nom: "Mémoire utilisée (%)", genre: "nombre" }],
      redemarrage: [],
      service_arrete: [{ champ: "service", nom: "Service ou VM", genre: "texte" }],
      sauvegarde_ratee: [],
      connexion_suspecte: [{ champ: "echecs_ssh_5min", nom: "Échecs SSH en 5 min", genre: "nombre" }],
    },
  },
  site: { nom: "Site Retux (plus tard)", evenements: { commande: [{ champ: "montant", nom: "Montant", genre: "nombre" }] } },
};

/** Le déclencheur en mots : « Tous les jours à 17:00 », « Mail reçu (2 filtres) ». */
export function enMots(d: Declencheur): string {
  if (d.type === "temps") {
    if (d.every_minutes) return d.every_minutes % 60 === 0 ? `Toutes les ${d.every_minutes / 60} h` : `Toutes les ${d.every_minutes} min`;
    const jours = d.days?.length && d.days.length < 7 ? ` (${d.days.map((j) => JOURS[j - 1]).join(", ")})` : "";
    return `${d.days?.length && d.days.length < 7 ? "Certains jours" : "Tous les jours"} à ${(d.times ?? []).join(", ")}${jours}`;
  }
  const n = d.filters?.conditions?.length ?? (d.filters?.field ? 1 : 0);
  return `${NOMS_EVENEMENTS[d.event ?? ""] ?? d.event}${n ? ` (${n} filtre${n > 1 ? "s" : ""})` : ""}`;
}

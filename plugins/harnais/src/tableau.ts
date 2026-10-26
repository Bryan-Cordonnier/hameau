// Le tableau d'AGL : des lignes (groupes en arbre, puis « Sans groupe »), des colonnes (statuts), et dans chaque case
// les cartes de premier niveau ; les sous-tâches sont rangées sous leur parent. Seules les tâches « une fois » y vont :
// les tâches qui reviennent sont des Réflexes. Pur, sans Svelte, pour être testé.
import type { ChantierResume, Groupe, Statut, Tache } from "@hameau/commun";

export const COLONNES: { id: Statut; nom: string; emoji: string }[] = [
  { id: "a_faire", nom: "À faire", emoji: "📥" },
  { id: "en_cours", nom: "En cours", emoji: "⚙️" },
  { id: "bloque", nom: "Bloqué", emoji: "⛔" },
  { id: "termine", nom: "Terminé", emoji: "✅" },
];

export interface Carte {
  genre: "tache" | "chantier";
  id: number;
  titre: string;
  agent: string;
  statut: Statut;
  avancement: number | null;
  echeance: number | null;
  blocage: string;
  rapport: boolean;
  enfants: Tache[];
}

export interface Ligne {
  groupe: Groupe | null;
  profondeur: number;
  agentImpose: string;
  cases: Record<Statut, Carte[]>;
}

const vide = (): Record<Statut, Carte[]> => ({ a_faire: [], en_cours: [], bloque: [], termine: [] });

/** Les groupes dans l'ordre de l'arbre (parent puis ses enfants), avec leur profondeur. */
export function arbre(groupes: Groupe[]): { g: Groupe; profondeur: number }[] {
  const actifs = groupes.filter((g) => !g.archive);
  const ids = new Set(actifs.map((g) => g.id));
  const sortie: { g: Groupe; profondeur: number }[] = [];
  const visiter = (parent: number | null, profondeur: number) => {
    for (const g of actifs.filter((x) => (x.parent !== null && ids.has(x.parent) ? x.parent : null) === parent)) {
      if (sortie.some((s) => s.g.id === g.id)) continue;
      sortie.push({ g, profondeur });
      visiter(g.id, profondeur + 1);
    }
  };
  visiter(null, 0);
  return sortie;
}

/** L'agent imposé par un groupe ou un de ses ancêtres. */
export function agentImpose(groupes: Groupe[], id: number | null): string {
  let g = groupes.find((x) => x.id === id);
  for (let i = 0; g && i < 20; i++) {
    if (g.agent_seul) return g.agent_seul;
    g = groupes.find((x) => x.id === g!.parent);
  }
  return "";
}

export function lignes(groupes: Groupe[], taches: Tache[], chantiers: ChantierResume[]): Ligne[] {
  const unique = taches.filter((t) => t.type === "mission");
  const ids = new Set(unique.map((t) => t.id));
  const enfants = (id: number) => unique.filter((t) => t.parent === id);
  const carteTache = (t: Tache): Carte => {
    const e = enfants(t.id);
    // l'avancement d'une tâche découpée : celui de l'agent, sinon la part des sous-tâches finies
    const auto = e.length ? Math.round((e.filter((x) => x.statut === "termine").length / e.length) * 100) : null;
    return { genre: "tache", id: t.id, titre: t.titre, agent: t.poste, statut: t.statut, avancement: t.avancement ?? auto, echeance: t.echeance, blocage: t.blocage, rapport: t.rapport_agl, enfants: e };
  };
  const carteChantier = (c: ChantierResume): Carte => ({ genre: "chantier", id: c.id, titre: c.titre, agent: c.agent, statut: c.statut, avancement: c.avancement, echeance: c.echeance, blocage: "", rapport: false, enfants: [] });
  const groupeConnu = new Set(groupes.filter((g) => !g.archive).map((g) => g.id));
  const dans = (g: number | null) => (g !== null && groupeConnu.has(g) ? g : null);
  const remplir = (g: number | null): Record<Statut, Carte[]> => {
    const cases = vide();
    for (const t of unique.filter((t) => dans(t.groupe) === g && (t.parent === null || !ids.has(t.parent)))) cases[t.statut].push(carteTache(t));
    for (const c of chantiers.filter((c) => dans(c.groupe) === g)) cases[c.statut].push(carteChantier(c));
    return cases;
  };
  const sortie: Ligne[] = arbre(groupes).map(({ g, profondeur }) => ({ groupe: g, profondeur, agentImpose: agentImpose(groupes, g.id), cases: remplir(g.id) }));
  const sans = remplir(null);
  if (Object.values(sans).some((c) => c.length)) sortie.push({ groupe: null, profondeur: 0, agentImpose: "", cases: sans });
  return sortie;
}

/** Échéance lisible et son urgence : dépassée, dans moins de 2 jours, ou plus tard. */
export function echeance(ts: number | null, maintenant = Date.now() / 1000): { texte: string; urgence: "depassee" | "proche" | "loin" } | null {
  if (ts === null) return null;
  const jours = Math.ceil((ts - maintenant) / 86400);
  const texte = new Date(ts * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return { texte, urgence: ts < maintenant ? "depassee" : jours <= 2 ? "proche" : "loin" };
}

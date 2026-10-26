// Accès au cerveau pour tous les plugins de Hameau : chaque appel passe par le moteur (permission « distant »),
// qui seul connaît l'adresse et la clé. Les réponses sont du JSON rendu par les outils du cerveau.
import { connect } from "@etabli/sdk";

export class ErreurCerveau extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Appelle un outil du cerveau et rend sa réponse lue en JSON (ou le texte brut si ce n'est pas du JSON). */
export async function appeler<T = unknown>(outil: string, args: Record<string, unknown> = {}): Promise<T> {
  const etabli = await connect();
  const r = await etabli.distant.appeler(outil, args);
  if (!r.ok) throw new ErreurCerveau(r.message, r.code);
  try {
    return JSON.parse(r.texte) as T;
  } catch {
    return r.texte as unknown as T;
  }
}

export type TypeTache = "mission" | "routine" | "expedition";

export interface Tache {
  id: number;
  poste: string;
  titre: string;
  consigne: string;
  recurrence: string;
  actif: boolean;
  cree_par: string;
  prochaine: string | null;
  derniere: string | null;
  rapport: string;
  en_cours: boolean;
  fin: string | null;
  autres: string;
  avancement: number | null;
  type: TypeTache;
  debut: number;
  fin_s: number | null;
  groupe: number | null;
  parent: number | null;
  statut: Statut;
  blocage: string;
  echeance: number | null;
  notifier: "non" | "quotidien" | "max";
  rapport_agl: boolean;
}

export type Statut = "a_faire" | "en_cours" | "bloque" | "termine";

/** Une ligne du tableau d'AGL : un groupe ou projet, dans un arbre, éventuellement réservé à un agent. */
export interface Groupe {
  id: number;
  nom: string;
  parent: number | null;
  agent_seul: string;
  emoji: string;
  archive: boolean;
}

export interface Question {
  q: string;
  r: string | null;
}

export interface Rapport {
  id: number;
  agent: string;
  genre: "tache" | "decision" | "bilan";
  titre: string;
  tache_id: number | null;
  informations: string[];
  problemes: string[];
  questions: Question[];
  manipulations: string[];
  cree: number;
  classe: number | null;
}

export interface ChantierResume {
  id: number;
  titre: string;
  agent: string;
  avancement: number;
  cree: number;
  maj: number;
  actif: boolean;
  messages: number;
  groupe: number | null;
  statut: Statut;
  echeance: number | null;
}

export interface Message {
  id: number;
  auteur: string;
  texte: string;
  quand: number;
}

export interface Chantier extends Omit<ChantierResume, "messages"> {
  doc: string;
  messages: Message[];
}

export interface Evenement {
  id: number;
  quand: number;
  agent: string;
  action: string;
  cible: string;
  resume: string;
  resultat: string;
}

export interface EtatServeur {
  cartes: { nom: string | null; temperature: number | null; charge: number | null; memoire_mo: number | null; memoire_totale_mo: number | null }[];
  modele: { fichier: string | null; contexte: number | null; temperature: number | null; emplacements: number | null } | null;
  en_ligne: boolean;
}

export interface Droit {
  action: string;
  ressource: string;
  niveau: string;
}

export interface Agent {
  nom: string;
  actif: boolean;
  cree: string;
  derniere_action: string | null;
  droits: Droit[];
}

export interface NoeudArbre {
  rel: string;
  nom: string;
  titre: string | null;
  resume: string;
  fiches: { rel: string; titre: string; resume: string }[];
  total: number;
  enfants: NoeudArbre[];
}

export interface CarteCerveau {
  arbre: NoeudArbre;
  synapses: { a: string; b: string; n: number }[];
  disposition: { positions?: Record<string, [number, number]>; icones?: Record<string, string> };
}

/** Les outils du cerveau dont se sert Hameau, typés. */
export const cerveau = {
  taches: () => appeler<Tache[]>("tasks_all"),
  modifierTache: (id: number, champs: Record<string, unknown>) => appeler<string>("task_update", { id, ...champs }),
  creerTache: (champs: {
    post: string;
    title: string;
    instructions: string;
    recurrence?: string;
    end_days?: number;
    group?: number;
    parent?: number;
    due?: string;
    notify?: "non" | "quotidien" | "max";
    report_in_app?: boolean;
  }) => appeler<string>("task_create", champs),
  groupes: () => appeler<Groupe[]>("groups_list"),
  creerGroupe: (champs: { name: string; parent?: number; only_agent?: string; emoji?: string }) => appeler<string>("group_create", champs),
  modifierGroupe: (id: number, champs: { name?: string; parent?: number; only_agent?: string; emoji?: string; archived?: boolean }) =>
    appeler<string>("group_update", { id, ...champs }),
  rapports: (tous = false) => appeler<Rapport[]>("report_list", { all: tous }),
  repondre: (id: number, index: number, answer: string) => appeler<string>("report_answer", { id, index, answer }),
  classer: (id: number, filed = true) => appeler<string>("report_file", { id, filed }),
  chantiers: () => appeler<ChantierResume[]>("project_list"),
  chantier: (id: number) => appeler<Chantier>("project_get", { id }),
  creerChantier: (title: string, doc = "") => appeler<string>("project_create", { title, doc }),
  modifierChantier: (id: number, champs: { doc?: string; progress?: number; title?: string; active?: boolean; group?: number; status?: string; due?: string }) => appeler<string>("project_update", { id, ...champs }),
  ecrireChantier: (id: number, text: string) => appeler<string>("project_message", { id, text }),
  evenements: (apres: number, limite = 200) => appeler<Evenement[]>("island_events", { after: apres, limit: limite }),
  serveur: () => appeler<EtatServeur>("server_status"),
  reglages: () => appeler<Record<string, string>>("settings_get"),
  regler: (key: string, value: string) => appeler<string>("settings_set", { key, value }),
  agents: () => appeler<Agent[]>("agents_list"),
  carte: () => appeler<CarteCerveau>("library_tree"),
  deplacer: (from: string, to: string) => appeler<string>("library_move", { from, to }),
  disposer: (layout: CarteCerveau["disposition"]) => appeler<string>("map_layout_set", { layout }),
  lire: (note: string) => appeler<string>("read", { note }),
  ecrire: (note: string, content: string, change_summary: string) => appeler<string>("write", { note, content, change_summary }),
};

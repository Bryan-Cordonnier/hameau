// Les données de l'AGL (refonte d'octobre 2026, cahier/) telles que le cerveau les rend, et les commandes `agl_*`.
import { appeler } from "./cerveau";

export type Scene = "dort" | "ordinateur" | "loupe" | "ecrit" | "courrier" | "attend" | "sans_credits";
export type Statut = "a_faire" | "en_cours" | "termine" | "bloque";
export type EtatProjet = "actif" | "pause" | "termine" | "abandonne";
export type Mode = "manuel" | "semi" | "auto";

export interface Droit {
  action: string;
  ressource: string;
  niveau: "autorise" | "confirmation" | "interdit";
}

export interface Moteur {
  type?: "api" | "local" | "externe";
  modele?: string;
  url?: string;
}

export interface Agent {
  nom: string;
  emoji: string;
  couleur: string;
  perso: string;
  consigne: string;
  moteur: Moteur;
  etat: "actif" | "pause" | "sans_credits";
  silence: string;
  principal: boolean;
  cle_expire: number | null;
  acces_actif: boolean;
  version_role: number;
  carnet: string;
  droits: Droit[];
  activite: { carte: { id: number; titre: string } | null; scene: Scene; derniere: { quand: number; action: string; resume: string } | null };
  en_pause: boolean;
  projets: number[];
}

export interface Objectif {
  id: number;
  titre: string;
  date: string;
  etat: "a_venir" | "en_cours" | "atteint" | "abandonne";
  ordre: number;
  cartes: number;
  faites: number;
  avancement: number | null;
}

export interface Projet {
  id: number;
  nom: string;
  emoji: string;
  couleur: string;
  parent: number | null;
  etat: EtatProjet;
  objectif: string;
  regles: string;
  branche: string;
  ordre: number;
  actif_effectif: boolean;
  agents: string[];
  objectifs: Objectif[];
  tableaux: number[];
}

export interface Tableau {
  id: number;
  nom: string;
  emoji: string;
  agents: string[];
  projet: number | null;
  special: string;
  ordre: number;
}

export interface Carte {
  id: number;
  tableau: number;
  titre: string;
  consigne: string;
  statut: Statut;
  agents: string[];
  agent: string;
  ordre: number;
  avancement: number | null;
  etapes: { texte: string; quand: number }[];
  journal: unknown[];
  rapport: string;
  echeance: string;
  objectif: number | null;
  automatisation: number | null;
  suite_de: number | null;
  numero: number;
  cree_par: string;
  cree: number;
  debut: number | null;
  fin: number | null;
  archive: boolean;
}

export interface Condition {
  field?: string;
  op?: string;
  value?: string | number;
  mode?: "et" | "ou";
  conditions?: Condition[];
}

export interface Declencheur {
  type: "temps" | "evenement";
  every_minutes?: number;
  times?: string[];
  days?: number[];
  source?: "mail" | "serveur" | "site";
  event?: string;
  filters?: Condition;
}

export interface Automatisation {
  id: number;
  nom: string;
  agent: string;
  projet: number | null;
  declencheur: Declencheur;
  consigne: string;
  emboite: boolean;
  garde: { calls?: number; period?: string };
  actif: boolean;
  prochaine: number | null;
  derniere: number | null;
  dernier_resultat: string;
  historique: { quand: number; etat: string; carte: number | null }[];
}

export interface ConversationResume {
  id: number;
  titre: string;
  agents: string[];
  ordre: string[];
  tour: string | null;
  mode: Mode;
  projet: number | null;
  element: boolean;
  maj: number;
  dernier: string | null;
}

export interface Message {
  id: number;
  auteur: string;
  genre: "texte" | "questions" | "approbation" | "reponse" | "decision";
  texte: string;
  donnees: { questions?: { q: string; choix?: string[] }[]; outil?: string; resume?: string };
  etat: "" | "attente" | "repondu";
  quand: number;
}

export interface Conversation extends ConversationResume {
  messages: Message[];
  acces: string[];
}

export interface Connecteur {
  nom: string;
  genre: string;
  description: string;
  a_un_secret: boolean;
  etat: string;
  cree: number;
}

export interface EtatAgl {
  agents: Agent[];
  projets: Projet[];
  tableaux: Tableau[];
  cartes: Carte[];
  automatisations: Automatisation[];
  conversations: ConversationResume[];
  connecteurs: Connecteur[];
  tout_arrete: boolean;
  cartes_actives: boolean;
  maintenant: number;
}

export interface NoeudCarte {
  rel: string;
  nom: string;
  titre: string | null;
  resume: string;
  fiches: { rel: string; titre: string; resume: string }[];
  total: number;
  enfants: NoeudCarte[];
  souvenirs: { rel: string; titre: string }[];
}

export interface CarteDuCerveau {
  arbre: NoeudCarte;
  noeuds: Record<string, { etage: string; emoji: string; couleur: string }>;
  disposition: { positions?: Record<string, [number, number]> };
}

export interface Resultats {
  fiches: { rel: string; titre: string; extrait: string }[];
  cartes: { id: number; titre: string; statut: Statut; tableau: number }[];
  messages: { id: number; conv: number; auteur: string; extrait: string }[];
  agents: { nom: string; emoji: string }[];
  projets: { id: number; nom: string; emoji: string }[];
}

type Champs = Record<string, unknown>;

export const agl = {
  etat: () => appeler<EtatAgl>("agl_state"),
  cartesArchivees: () => appeler<Carte[]>("agl_archived_cards"),
  creerCarte: (c: { board: number; title: string; instructions: string; due?: string; agents?: string[]; objective?: number | null }) => appeler<string>("agl_card_create", c),
  modifierCarte: (id: number, c: Champs) => appeler<string>("agl_card_update", { id, ...c }),
  ordonnerCartes: (ids: number[]) => appeler<string>("agl_cards_order", { ids }),
  repondreCarte: (id: number, answer: string) => appeler<string>("agl_card_answer", { id, answer }),
  tableau: (c: Champs) => appeler<{ id: number }>("agl_board_save", c),
  projet: (c: Champs) => appeler<{ id: number }>("agl_project_save", c),
  objectif: (c: Champs) => appeler<{ id: number }>("agl_objective_save", c),
  ordonner: (what: "projets" | "tableaux" | "objectifs", ids: number[]) => appeler<string>("agl_order", { what, ids }),
  agent: (c: Champs) => appeler<{ agent: string; cle: string | null }>("agl_agent_save", c),
  etatAgent: (name: string, state: Agent["etat"]) => appeler<string>("agl_agent_state", { name, state }),
  nouvelleCle: (name: string, expire_days?: number) => appeler<{ cle: string }>("agl_agent_key", { name, expire_days }),
  revoquer: (name: string) => appeler<string>("agl_agent_revoke", { name }),
  versionsRole: (name: string) => appeler<{ version: number; consigne: string; droits: Droit[]; quand: number }[]>("agl_role_history", { name }),
  restaurerRole: (name: string, version: number) => appeler<string>("agl_role_restore", { name, version }),
  toutArreter: (stop: boolean) => appeler<string>("agl_stop_all", { stop }),
  cartesActives: (on: boolean) => appeler<string>("agl_cards_switch", { on }),
  carnet: (agent: string, text?: string) => appeler<string>("agl_notebook", text === undefined ? { agent } : { agent, text }),
  automatisation: (c: Champs) => appeler<{ id: number }>("agl_automation_save", c),
  conversation: (id: number, after = 0) => appeler<Conversation>("agl_conversation", { id, after }),
  nouvelleConversation: (agents: string[], title = "") => appeler<{ id: number }>("agl_conversation_new", { agents, title }),
  reglerConversation: (id: number, c: Champs) => appeler<string>("agl_conversation_set", { id, ...c }),
  dire: (id: number, text: string) => appeler<{ id: number }>("agl_say", { id, text }),
  passer: (id: number) => appeler<string>("agl_pass_turn", { id }),
  repondre: (message: number, c: { answers?: string[]; accept?: boolean }) => appeler<string>("agl_answer", { message, ...c }),
  transcrire: (data: string, ext: string) => appeler<{ job: number }>("agl_transcribe", { data, ext }),
  transcription: (job: number) => appeler<{ fini: boolean; texte?: string; erreur?: string }>("agl_transcribe_result", { job }),
  rapide: (text: string) => appeler<string>("agl_quick", { text }),
  chercher: (query: string) => appeler<Resultats>("agl_search", { query }),
  connecteur: (c: Champs) => appeler<string>("agl_connector_save", c),
  carte: () => appeler<CarteDuCerveau>("agl_map"),
  creerBloc: (c: { parent: string; name: string; level: string; description?: string; emoji?: string; color?: string }) => appeler<{ rel: string }>("agl_map_create", c),
  reglerBloc: (c: { rel: string; level?: string; emoji?: string; color?: string }) => appeler<string>("agl_map_set", c),
  relier: (from: string, to_parent: string) => appeler<{ rel: string }>("agl_map_move", { from, to_parent }),
  supprimer: (rel: string) => appeler<string>("agl_map_delete", { rel }),
  restaurer: (rel: string) => appeler<string>("agl_map_restore", { rel }),
  purger: (rel: string | null) => appeler<string>("agl_map_purge", rel === null ? { all: true } : { rel }),
  ajouterSouvenir: (folder: string, name: string, title: string, data: string) => appeler<string>("agl_memory_add", { folder, name, title, data }),
  souvenir: (rel: string) => appeler<{ rel: string; mime: string; donnees: string }>("agl_memory_get", { rel }),
  lire: (note: string) => appeler<string>("read", { note }),
  ecrire: (note: string, content: string, change_summary: string) => appeler<string>("write", { note, content, change_summary }),
  disposer: (layout: CarteDuCerveau["disposition"]) => appeler<string>("map_layout_set", { layout }),
};

/** Nom affiché : « Toi » pour Bryan (ou son appli), le nom de l'agent sinon. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const nomAffiche = (id: string, _agents: Agent[] = []): string => {
  if (id === "bryan" || id === "hameau") return "Toi";
  if (id === "systeme") return "AGL";
  if (id === "claude-code-pc") return "Claude";
  return id.charAt(0).toUpperCase() + id.slice(1);
};

export const NOMS_STATUT: Record<Statut, string> = { a_faire: "À faire", en_cours: "En cours", termine: "Terminé", bloque: "Bloqué" };
export const NOMS_MODE: Record<Mode, string> = { manuel: "Manuel", semi: "Semi-auto", auto: "Automatique" };

/** Les actions que le rôle d'un agent peut recevoir, avec leur nom lisible. */
export const ACTIONS: { action: string; nom: string; ressource: boolean }[] = [
  { action: "library.read", nom: "Lire le cerveau", ressource: true },
  { action: "library.write", nom: "Écrire dans le cerveau", ressource: true },
  { action: "mail.read", nom: "Lire les mails", ressource: true },
  { action: "mail.state", nom: "Trier les mails (états, corbeille)", ressource: true },
  { action: "mail.draft", nom: "Préparer des brouillons", ressource: true },
  { action: "quotidien.read", nom: "Lire Quotidien", ressource: true },
  { action: "quotidien.write", nom: "Écrire dans Quotidien", ressource: true },
  { action: "web.search", nom: "Chercher sur internet", ressource: false },
  { action: "hameau.read", nom: "Voir l'AGL (tâches, projets)", ressource: false },
  { action: "hameau.write", nom: "Agir dans l'AGL (cartes, road map)", ressource: true },
  { action: "task.create", nom: "Donner du travail (poste/<agent> ou * pour tous)", ressource: true },
  { action: "report.write", nom: "Écrire des rapports", ressource: false },
  { action: "service.use", nom: "Utiliser un service branché (service/<nom>)", ressource: true },
  { action: "presence.read", nom: "Savoir si Bryan est dispo", ressource: false },
];

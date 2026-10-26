// Faux moteur pour les démos : connect() rend un pont « distant » qui répond avec des données d'exemple en mémoire.
const groupes = [
  { id: 1, nom: "Quotidien de Bryan", parent: null, agent_seul: "max", emoji: "🏠", archive: false },
  { id: 2, nom: "Retux", parent: null, agent_seul: "", emoji: "🏭", archive: false },
  { id: 3, nom: "Site de l'entreprise", parent: 2, agent_seul: "", emoji: "🌐", archive: false },
];
const jour = 86400;
const now = Math.floor(Date.now() / 1000);
let n = 20;
const t = (id: number, titre: string, champs: Record<string, unknown> = {}) => ({
  id, poste: "max", titre, consigne: titre, recurrence: "", actif: true, cree_par: "bryan", prochaine: null, derniere: null, rapport: "", en_cours: false, fin: null,
  autres: "tous", avancement: null, type: "mission", debut: now, fin_s: null, groupe: null, parent: null, statut: "a_faire", blocage: "", echeance: null, notifier: "quotidien", rapport_agl: true, ...champs,
});
const taches = [
  t(1, "Trouver des entreprises chez qui postuler", { groupe: 1, statut: "en_cours", avancement: 30, echeance: now + 3 * jour }),
  t(2, "Relancer la mutuelle", { groupe: 1, statut: "bloque", blocage: "J'attends ton numéro d'adhérent", echeance: now - jour }),
  t(3, "Avancer le site de l'entreprise", { groupe: 3, poste: "claude-code-pc", statut: "en_cours" }),
  t(4, "Page catalogue", { groupe: 3, poste: "claude-code-pc", parent: 3, statut: "termine" }),
  t(5, "Paiement par carte", { groupe: 3, poste: "claude-code-pc", parent: 3, statut: "en_cours" }),
  t(6, "Mentions légales", { groupe: 3, poste: "claude-code-pc", parent: 3 }),
  t(7, "Faire le bilan des mails de la semaine", { groupe: 1, statut: "termine", actif: false, rapport: "40 mails triés, 3 importants : la banque, ton agence d'intérim, Leroy Merlin." }),
  t(8, "Tri des mails", { type: "routine", recurrence: "every:60" }),
];
const chantiers = [{ id: 1, titre: "Étude de marché Retux", agent: "max", avancement: 40, cree: now, maj: now, actif: true, messages: 6, groupe: 2, statut: "en_cours", echeance: now + 12 * jour }];
// le faux journal du cerveau : la démo y pousse des actions
const evenements: { id: number; quand: number; agent: string; action: string; cible: string; resume: string; resultat: string }[] = [];
export function pousser(agent: string, action: string, cible: string, resume: string): void {
  evenements.push({ id: evenements.length + 1, quand: Math.floor(Date.now() / 1000), agent, action, cible, resume, resultat: "ok" });
}
const agents = ["max", "claude-code-pc", "hameau"].map((nom) => ({ nom, actif: true, cree: "", derniere_action: null, droits: [] }));

function repondre(outil: string, a: Record<string, unknown>): unknown {
  switch (outil) {
    case "tasks_all": return taches;
    case "groups_list": return groupes;
    case "project_list": return chantiers;
    case "agents_list": return agents;
    case "report_list": return [];
    case "server_status": return { cartes: [], modele: null, en_ligne: false };
    case "settings_get": return { session_minutes: "45", silence: "00:00-07:00", llm_contexte: "65536", llm_emplacements: "1", llm_temperature: "", llm_reflexion: "off", llm_cache: "q4_0" };
    case "island_events": {
      const apres = Number(a.after ?? 0);
      return apres < 0 ? evenements.slice(apres) : evenements.filter((e) => e.id > apres);
    }
    case "group_create": groupes.push({ id: ++n, nom: String(a.name), parent: (a.parent as number) ?? null, agent_seul: String(a.only_agent ?? ""), emoji: String(a.emoji ?? ""), archive: false }); return "ok";
    case "task_create": taches.push(t(++n, String(a.title), { poste: a.post, groupe: a.group ?? null, parent: a.parent ?? null })); return "ok";
    case "task_update": {
      const x = taches.find((y) => y.id === a.id) as Record<string, unknown>;
      if (a.status !== undefined) x.statut = a.status;
      if (a.blocked_reason !== undefined) x.blocage = a.blocked_reason;
      if (a.progress !== undefined) x.avancement = a.progress;
      return "ok";
    }
    default: return "ok";
  }
}

export async function connect() {
  return {
    distant: { appeler: async (outil: string, args: Record<string, unknown>) => ({ ok: true as const, texte: JSON.stringify(repondre(outil, args)) }) },
    onThemeChange: () => () => {},
    send: (kind: string, data: unknown) => console.log("send", kind, JSON.stringify(data)),
  };
}

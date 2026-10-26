import type { ChantierResume, Groupe, Tache } from "@hameau/commun";
import { describe, expect, it } from "vitest";
import { agentImpose, arbre, echeance, lignes } from "./tableau";

const g = (id: number, nom: string, parent: number | null = null, agent_seul = ""): Groupe => ({ id, nom, parent, agent_seul, emoji: "", archive: false });
const t = (id: number, champs: Partial<Tache> = {}): Tache =>
  ({ id, poste: "max", titre: `t${id}`, consigne: "", recurrence: "", actif: true, cree_par: "bryan", prochaine: null, derniere: null, rapport: "", en_cours: false, fin: null, autres: "tous", avancement: null, type: "mission", debut: 0, fin_s: null, groupe: null, parent: null, statut: "a_faire", blocage: "", echeance: null, notifier: "non", rapport_agl: false, ...champs }) as Tache;

describe("tableau d'AGL", () => {
  const groupes = [g(1, "Retux", null, "max"), g(2, "Site", 1), g(3, "Quotidien de Bryan")];

  it("range les groupes en arbre et hérite de l'agent imposé", () => {
    expect(arbre(groupes).map((x) => [x.g.nom, x.profondeur])).toEqual([["Retux", 0], ["Site", 1], ["Quotidien de Bryan", 0]]);
    expect(agentImpose(groupes, 2)).toBe("max");
    expect(agentImpose(groupes, 3)).toBe("");
  });

  it("place les cartes par statut, sous-tâches sous leur parent, routines exclues", () => {
    const taches = [t(10, { groupe: 2, statut: "en_cours" }), t(11, { groupe: 2, parent: 10, statut: "termine" }), t(12, { groupe: 2, parent: 10 }), t(13, { type: "routine", recurrence: "every:60" }), t(14, { statut: "bloque" })];
    const chantiers = [{ id: 5, titre: "Étude", agent: "max", avancement: 40, cree: 0, maj: 0, actif: true, messages: 0, groupe: 3, statut: "en_cours", echeance: null } as ChantierResume];
    const l = lignes(groupes, taches, chantiers);
    const site = l.find((x) => x.groupe?.id === 2)!;
    expect(site.cases.en_cours.map((c) => c.id)).toEqual([10]);
    expect(site.cases.en_cours[0]!.avancement).toBe(50);
    expect(site.cases.a_faire).toEqual([]);
    expect(l.find((x) => x.groupe?.id === 3)!.cases.en_cours[0]!.genre).toBe("chantier");
    const sans = l.at(-1)!;
    expect(sans.groupe).toBeNull();
    expect(sans.cases.bloque.map((c) => c.id)).toEqual([14]);
    expect(l.flatMap((x) => Object.values(x.cases).flat()).some((c) => c.id === 13)).toBe(false);
  });

  it("donne l'urgence d'une échéance", () => {
    expect(echeance(null)).toBeNull();
    expect(echeance(1000, 2000)!.urgence).toBe("depassee");
    expect(echeance(2000 + 86400, 2000)!.urgence).toBe("proche");
    expect(echeance(2000 + 10 * 86400, 2000)!.urgence).toBe("loin");
  });
});

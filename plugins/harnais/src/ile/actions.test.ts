import { describe, expect, it } from "vitest";
import type { Evenement } from "@hameau/commun";
import { actionDe, actions, durees } from "./actions";

const ev = (id: number, action: string, cible = "", agent = "max", resume = ""): Evenement => ({ id, quand: 1000 + id, agent, action, cible, resume, resultat: "ok" });

describe("île : actions des personnages", () => {
  it("envoie chaque action au bon bâtiment", () => {
    expect(actionDe(ev(1, "mail.state", "mail/perso"))).toMatchObject({ lieu: "poste", geste: "trie" });
    expect(actionDe(ev(1, "library.write", "projets/etablink/etat.md"))).toMatchObject({ lieu: "bibliotheque", geste: "ecrit" });
    expect(actionDe(ev(1, "hameau.write", "chantier/4"))).toMatchObject({ lieu: "chantier", chantier: 4 });
    expect(actionDe(ev(1, "quotidien.read", "plugin.agenda"))).toMatchObject({ lieu: "mairie" });
    expect(actionDe(ev(1, "report.write", "courrier"))).toMatchObject({ lieu: "poste", geste: "ecrit" });
    expect(actionDe(ev(1, "presence.read"))).toBeNull();
  });

  it("regroupe la même chose faite d'affilée", () => {
    const a = actions([ev(1, "mail.state", "mail/p"), ev(2, "mail.state", "mail/p"), ev(3, "library.read", "moi/"), ev(4, "mail.state", "mail/p", "claude-code-pc")]);
    expect(a.map((x) => [x.lieu, x.agent])).toEqual([
      ["poste", "max"],
      ["bibliotheque", "max"],
      ["poste", "claude-code-pc"],
    ]);
    expect(a[0]!.quand).toBe(1002);
  });

  it("accélère quand le retard s'accumule", () => {
    expect(durees(0, 3).vitesse).toBe(1);
    expect(durees(8, 3).vitesse).toBe(2);
    expect(durees(20, 3).geste).toBe(650);
    expect(durees(0, 0.1).marche).toBe(900);
  });
});

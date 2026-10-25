import { describe, expect, it } from "vitest";
import { actions } from "../ile/actions";
import { attache, consigne, posteLibre } from "./journal";

const ev = (id: number, agent: string, action: string, cible = "", resume = "") => ({ id, quand: id, agent, action, cible, resume, resultat: "ok" });

describe("journal → bureau", () => {
  it("envoie les mails au secrétariat et l'écriture de fiche aux archives", () => {
    const [m, f] = actions([ev(1, "max", "mail.read", "mail/3", "lit un mail"), ev(2, "max", "library.write", "projets/x")]).map(consigne);
    expect(m).toMatchObject({ agent: "max", zone: "secretariat", geste: "lit" });
    expect(f).toMatchObject({ zone: "archives", geste: "tape" });
  });
  it("donne un poste libre, puis le moins occupé", () => {
    expect(posteLibre(3, [0])).toBe(1);
    expect(posteLibre(2, [0, 1, 0])).toBe(1);
  });
  it("attache Max à son bureau, les autres au plateau", () => {
    expect(attache("max")).toBe("boss");
    expect(attache("claude-code-pc")).toBe("dev");
  });
});

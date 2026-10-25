import { describe, expect, it } from "vitest";
import { autresTexte, avancement, recurrence, rythme } from "./taches";

describe("tableau", () => {
  it("écrit qui d'autre a le droit", () => {
    const nom = (id: string) => (id === "max" ? "Max" : id);
    expect(autresTexte("tous", nom)).toBe("n'importe qui");
    expect(autresTexte("personne", nom)).toBe("personne d'autre");
    expect(autresTexte("liste:max", nom)).toBe("aussi : Max");
  });

  it("fabrique la récurrence", () => {
    expect(recurrence("mission", "08:00", null)).toBe("");
    expect(recurrence("routine", "20:30", null)).toBe("daily:20:30");
    expect(recurrence("expedition", "", 90)).toBe("every:90");
  });

  it("lit le rythme et l'avancement", () => {
    expect(rythme({ recurrence: "daily:08:00", fin: "04/11/2026", type: "expedition" })).toBe("tous les jours à 08:00, jusqu'au 04/11/2026");
    expect(avancement({ avancement: null, debut: 0, fin_s: 100, type: "expedition" }, 25)).toBe(25);
    expect(avancement({ avancement: 70, debut: 0, fin_s: 100, type: "expedition" }, 25)).toBe(70);
    expect(avancement({ avancement: null, debut: 0, fin_s: null, type: "mission" }, 25)).toBeNull();
  });
});

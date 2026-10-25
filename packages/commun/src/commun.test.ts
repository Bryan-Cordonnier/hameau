import { describe, expect, it } from "vitest";
import { habitant, nomDe } from "./habitants";
import { ilYa } from "./temps";

describe("habitants", () => {
  it("reconnaît Max, Claude et les clients qui ne sont pas des agents", () => {
    expect(habitant("max")).toMatchObject({ nom: "Max", genre: "habitant", forme: "galet" });
    expect(habitant("claude-code-pc")).toMatchObject({ nom: "Claude", genre: "visiteur", forme: "etoile" });
    expect(habitant("hameau")).toBeNull();
    expect(habitant("telephone-bryan")).toBeNull();
    expect(nomDe("bryan")).toBe("Toi");
  });
});

describe("temps", () => {
  it("écrit une durée lisible", () => {
    const m = 1_800_000_000;
    expect(ilYa(m - 20, m)).toBe("à l'instant");
    expect(ilYa(m - 600, m)).toBe("il y a 10 min");
  });
});

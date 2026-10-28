import { describe, expect, it } from "vitest";
import { nomAffiche } from "./agl";
import { ilYa } from "./temps";

describe("noms", () => {
  it("Bryan est « Toi », Claude et les agents ont leur nom", () => {
    expect(nomAffiche("hameau")).toBe("Toi");
    expect(nomAffiche("bryan")).toBe("Toi");
    expect(nomAffiche("claude-code-pc")).toBe("Claude");
    expect(nomAffiche("max", [{ nom: "max" } as never])).toBe("Max");
  });
});

describe("temps", () => {
  it("écrit une durée lisible", () => {
    const m = 1_800_000_000;
    expect(ilYa(m - 20, m)).toBe("à l'instant");
    expect(ilYa(m - 600, m)).toBe("il y a 10 min");
  });
});

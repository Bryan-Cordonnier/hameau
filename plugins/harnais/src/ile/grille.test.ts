import { describe, expect, it } from "vitest";
import { cote, hauteur, MODULES_DE_BASE, placer } from "./grille";

describe("grille de l'île", () => {
  it("ne déplace jamais un module déjà posé", () => {
    const avant = placer(MODULES_DE_BASE);
    const apres = placer([...MODULES_DE_BASE, { id: "chantier-1", cases: [1, 1] }, { id: "gros", cases: [3, 2] }]);
    expect(apres.slice(0, avant.length)).toEqual(avant);
    expect(apres).toHaveLength(avant.length + 2);
  });

  it("laisse une bande vide entre les modules", () => {
    const p = placer(MODULES_DE_BASE);
    for (let a = 0; a < p.length; a++) {
      for (let b = a + 1; b < p.length; b++) {
        const A = p[a]!;
        const B = p[b]!;
        const ecartI = Math.max(B.i - (A.i + A.cases[0]), A.i - (B.i + B.cases[0]));
        const ecartJ = Math.max(B.j - (A.j + A.cases[1]), A.j - (B.j + B.cases[1]));
        expect(Math.max(ecartI, ecartJ), `${A.id} / ${B.id}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("pose même un très grand bâtiment, et grandit sans limite", () => {
    const beaucoup = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, cases: [1 + (i % 3), 1] as [number, number] }));
    expect(placer([...beaucoup, { id: "geant", cases: [5, 4] }])).toHaveLength(41);
  });

  it("met de la terre sous les modules et de l'eau loin", () => {
    const p = placer(MODULES_DE_BASE);
    for (const m of p) expect(cote(p, m.x, m.z), m.id).toBeLessThan(-1);
    expect(hauteur(p, 200, 200)).toBeLessThan(0);
    expect(hauteur(p, p[0]!.x, p[0]!.z)).toBeGreaterThan(0.2);
  });
});

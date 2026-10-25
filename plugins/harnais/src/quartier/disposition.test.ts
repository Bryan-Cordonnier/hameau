import { describe, expect, it } from "vitest";
import { decouper, germe, interieur, placer, type Rect } from "./disposition";

const REGION: Rect = { x0: -46, z0: -34, x1: 46, z1: 34, rues: { n: false, s: false, o: false, e: false } };

describe("disposition du quartier", () => {
  it("ne fait que des rues droites, horizontales ou verticales", () => {
    const { segments } = decouper(REGION, germe(7));
    expect(segments.length).toBeGreaterThan(5);
    for (const s of segments) expect(s.x1 === s.x2 || s.z1 === s.z2).toBe(true);
  });

  it("donne des îlots de tailles variées, sans quadrillage", () => {
    const { ilots } = decouper(REGION, germe(7));
    const largeurs = new Set(ilots.map((r) => Math.round(r.x1 - r.x0)));
    const hauteurs = new Set(ilots.map((r) => Math.round(r.z1 - r.z0)));
    expect(largeurs.size).toBeGreaterThan(3);
    expect(hauteurs.size).toBeGreaterThan(3);
  });

  it("pose les zones dans des îlots assez grands, porte sur une rue, sans doublon", () => {
    const { ilots } = decouper(REGION, germe(7));
    const besoins = [
      { id: "cerveau", l: 10, p: 8 },
      { id: "tableau", l: 6, p: 4 },
    ];
    const { places, restes } = placer(ilots, besoins);
    expect(places.map((p) => p.id)).toEqual(["cerveau", "tableau"]);
    expect(restes).toHaveLength(ilots.length - 2);
    for (const p of places) expect(p.l).toBeGreaterThanOrEqual(besoins.find((b) => b.id === p.id)!.l);
    expect(Object.keys(interieur(ilots[0]!))).toHaveLength(4);
  });

  it("est toujours le même pour le même germe", () => {
    expect(decouper(REGION, germe(3))).toEqual(decouper(REGION, germe(3)));
  });
});

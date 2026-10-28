import { describe, expect, it } from "vitest";
import type { NoeudCarte } from "@hameau/commun";
import { disposer, fils, niveauDeDetail, slug, tracer } from "./carte";

const n = (rel: string, enfants: NoeudCarte[] = [], fiches = 0): NoeudCarte => ({
  rel,
  nom: rel.split("/").filter(Boolean).pop() ?? "",
  titre: null,
  resume: "",
  fiches: Array.from({ length: fiches }, (_, i) => ({ rel: `${rel}f${i}.md`, titre: `F${i}`, resume: "" })),
  total: fiches,
  enfants,
  souvenirs: [],
});

const arbre = n("", [n("retux/", [n("retux/site/", [n("retux/site/code/", [n("retux/site/code/vieux/")], 3)], 5)], 2), n("moi/", [], 4), n("supprimes/", [n("supprimes/x/")]), n("pas-organises/", [n("pas-organises/maison/")])]);

describe("carte du cerveau", () => {
  it("tous les étages, sans limite de profondeur, sans Supprimés ; les tailles décroissent puis les sections sont égales", () => {
    const d = disposer(arbre, { "retux/": { etage: "pole", emoji: "🏭", couleur: "#f00" } });
    const par = (rel: string) => d.blocs.find((b) => b.rel === rel)!;
    expect(d.blocs.some((b) => b.rel.startsWith("supprimes/"))).toBe(false);
    expect(par("").etage).toBe("cerveau");
    expect(par("retux/").l).toBeGreaterThan(par("retux/site/").l);
    expect(par("retux/site/").l).toBeGreaterThan(par("retux/site/code/").l);
    expect(par("retux/site/code/").l).toBe(par("retux/site/code/vieux/").l);
    // couleur héritée du parent
    expect(par("retux/site/code/vieux/").couleur).toBe("#f00");
    expect(par("pas-organises/maison/").libre).toBe(true);
    expect(d.grappes.find((g) => g.dossier === "retux/site/")!.neurones).toHaveLength(5);
  });
  it("une position posée à la main est gardée ; les fils relient parent et enfants", () => {
    const d = disposer(arbre, {}, { "moi/": [1234, -567] });
    const moi = d.blocs.find((b) => b.rel === "moi/")!;
    expect([moi.x, moi.y]).toEqual([1234, -567]);
    const f = fils(d);
    expect(f.some((x) => x.de === "" && x.vers === "retux/")).toBe(true);
    expect(f.some((x) => x.vers === "pas-organises/maison/")).toBe(false);
  });
  it("un fil contourne un bloc posé au milieu", () => {
    const a = { x: 0, y: 0, l: 100, h: 40 };
    const b = { x: 600, y: 0, l: 100, h: 40 };
    expect(tracer(a, b, [])).toMatch(/^M.* L/);
    expect(tracer(a, b, [{ x: 300, y: 0, l: 120, h: 60 }])).toContain("C");
  });
  it("niveau de détail et noms sûrs", () => {
    expect(niveauDeDetail(0.3)).toEqual({ nomsSections: false, nomsNeurones: false });
    expect(niveauDeDetail(1)).toEqual({ nomsSections: true, nomsNeurones: true });
    expect(slug("Projet maison — Été")).toBe("projet-maison-ete");
  });
});

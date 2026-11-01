import { describe, expect, it } from "vitest";
import type { NoeudCarte } from "@hameau/commun";
import { couper, disposer, fils, slug, tracer } from "./carte";

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
  it("carte mentale classique : chaque étage dans sa colonne, rien ne se chevauche, fils horizontaux", () => {
    const d = disposer(arbre);
    const par = (rel: string) => d.blocs.find((b) => b.rel === rel)!;
    const retux = par("retux/");
    const site = par("retux/site/");
    expect(Math.sign(site.x - retux.x)).toBe(Math.sign(retux.x));
    expect(Math.abs(site.x)).toBeGreaterThan(Math.abs(retux.x));
    const boites = [...d.blocs, ...d.grappes];
    for (let i = 0; i < boites.length; i++)
      for (let j = i + 1; j < boites.length; j++) {
        const a = boites[i]!;
        const b = boites[j]!;
        expect(Math.abs(a.x - b.x) < (a.l + b.l) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2).toBe(false);
      }
    expect(tracer({ x: 0, y: 0, l: 100, h: 40 }, { x: 400, y: 120, l: 100, h: 40 })).toBe("M50,0 C200,0 200,120 350,120");
  });
  it("noms qui tiennent dans leur bloc, et noms sûrs", () => {
    expect(couper("Court", 240, 20)).toBe("Court");
    expect(couper("Un nom vraiment beaucoup trop long pour un bloc", 180, 14)).toMatch(/…$/);
    expect(slug("Projet maison — Été")).toBe("projet-maison-ete");
  });
});

import { describe, expect, it } from "vitest";
import type { NoeudArbre } from "@hameau/commun";
import { blocs, bord, croisements, iconeParDefaut, joliNom, liens, tracer, type Bloc } from "./carte";

const noeud = (rel: string, total: number, enfants: NoeudArbre[] = []): NoeudArbre => ({ rel, nom: rel.split("/").filter(Boolean).pop() ?? "", titre: null, resume: "", fiches: [], total, enfants });

const arbre = noeud("", 40, [
  noeud("moi/", 5),
  noeud("projets/", 30, [noeud("projets/etable/", 4), noeud("projets/etablink/", 10, [noeud("projets/etablink/pack/", 8)]), noeud("projets/quotidien/", 6), noeud("projets/max/", 5)]),
  noeud("infra/", 5),
]);

const touche = (a: Bloc, b: Bloc) => Math.abs(a.x - b.x) < (a.l + b.l) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe("carte du cerveau", () => {
  it("pose chaque dossier sans chevauchement, aux bons niveaux", () => {
    const b = blocs(arbre);
    expect(b.map((x) => x.niveau)).toEqual([0, 1, 1, 2, 2, 3, 2, 2, 1]);
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) expect(touche(b[i]!, b[j]!), `${b[i]!.rel} / ${b[j]!.rel}`).toBe(false);
  });

  it("garde les positions posées à la main", () => {
    const b = blocs(arbre, { "infra/": [900, 900] });
    expect(b.find((x) => x.rel === "infra/")).toMatchObject({ x: 900, y: 900 });
  });

  it("ne fait passer aucun lien sur un bloc quand c'est possible", () => {
    const a: Bloc = { rel: "a", nom: "A", niveau: 1, parent: null, total: 1, x: 0, y: 0, l: 100, h: 40, lobe: "a" };
    const c: Bloc = { ...a, rel: "c", x: 600 };
    const obstacle: Bloc = { ...a, rel: "o", x: 300, l: 120, h: 60 };
    const l = tracer(a, c, [a, c, obstacle], "axone");
    expect(l.points.some((p) => Math.abs(p.x - 300) < 70 && Math.abs(p.y) < 40)).toBe(false);
  });

  it("part du bord du bloc et repère les croisements", () => {
    const a: Bloc = { rel: "a", nom: "A", niveau: 1, parent: null, total: 1, x: 0, y: 0, l: 100, h: 40, lobe: "a" };
    expect(bord(a, { x: 500, y: 0 })).toEqual({ x: 50, y: 0 });
    const ls = liens(blocs(arbre), [{ a: "moi/", b: "projets/max/", n: 2 }]);
    expect(ls.filter((l) => l.genre === "synapse")).toHaveLength(1);
    expect(Array.isArray(croisements(ls))).toBe(true);
  });

  it("nomme et décore les dossiers", () => {
    expect(joliNom("vie-pratique")).toBe("Vie pratique");
    expect(iconeParDefaut("projets/etablink/")).toBe("🔩");
    expect(iconeParDefaut("inconnu/")).toBe("📁");
  });
});

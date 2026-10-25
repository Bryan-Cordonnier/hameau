import { describe, expect, it } from "vitest";
import { difference } from "./diff";

describe("différences", () => {
  it("garde, retire et ajoute mot à mot", () => {
    expect(difference("le prix est 15", "le prix est 17")).toEqual([
      { genre: "garde", texte: "le prix est " },
      { genre: "retire", texte: "15" },
      { genre: "ajoute", texte: "17" },
    ]);
  });

  it("recolle le texte à l'identique", () => {
    const avant = "# Cible\nAteliers de 4 à 9 personnes.\n";
    const apres = "# Cible\nAteliers de 4 à 9 postes, Pays basque.\n## Prix\n15 €";
    const d = difference(avant, apres);
    expect(d.filter((m) => m.genre !== "ajoute").map((m) => m.texte).join("")).toBe(avant);
    expect(d.filter((m) => m.genre !== "retire").map((m) => m.texte).join("")).toBe(apres);
  });

  it("gère le vide", () => {
    expect(difference("", "nouveau")).toEqual([{ genre: "ajoute", texte: "nouveau" }]);
    expect(difference("ancien", "")).toEqual([{ genre: "retire", texte: "ancien" }]);
  });
});

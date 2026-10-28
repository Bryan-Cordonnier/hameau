import { describe, expect, it } from "vitest";
import type { Carte, Objectif } from "@hameau/commun";
import { colonnes, deplacer, enMots, prochainObjectif } from "./outils";

const carte = (id: number, statut: Carte["statut"], ordre: number, tableau = 1): Carte => ({ id, statut, ordre, tableau, archive: false }) as Carte;
const obj = (etat: Objectif["etat"]): Objectif => ({ etat }) as Objectif;

describe("tableaux", () => {
  it("range les cartes par colonne, la plus urgente en haut", () => {
    const c = colonnes([carte(1, "a_faire", 2), carte(2, "a_faire", -1), carte(3, "bloque", 0), carte(4, "a_faire", 0, 2)], 1);
    expect(c.a_faire.map((x) => x.id)).toEqual([2, 1]);
    expect(c.bloque.map((x) => x.id)).toEqual([3]);
  });
  it("déplace une carte en hauteur", () => {
    expect(deplacer([1, 2, 3], 3, 0)).toEqual([3, 1, 2]);
    expect(deplacer([1, 2, 3], 1, 9)).toEqual([2, 3, 1]);
  });
});

describe("road map et déclencheurs", () => {
  it("centre la road map sur le prochain objectif", () => {
    expect(prochainObjectif([obj("atteint"), obj("en_cours"), obj("a_venir")])).toBe(1);
    expect(prochainObjectif([obj("atteint"), obj("atteint")])).toBe(1);
  });
  it("dit le déclencheur en mots", () => {
    expect(enMots({ type: "temps", times: ["17:00"] })).toBe("Tous les jours à 17:00");
    expect(enMots({ type: "temps", times: ["08:00"], days: [1, 5] })).toBe("Certains jours à 08:00 (lun, ven)");
    expect(enMots({ type: "temps", every_minutes: 120 })).toBe("Toutes les 2 h");
    expect(enMots({ type: "evenement", source: "mail", event: "mail_recu", filters: { mode: "et", conditions: [{}, {}] } })).toBe("Mail reçu (2 filtres)");
  });
});

import { describe, expect, it } from "vitest";
import { chemin, echantillonner, graphe, longueur, type Pt } from "./reseau";

const ROUTES: Pt[][] = [
  [[-20, 0], [0, 0], [20, 0]],
  [[0, 0], [0, 20]],
];

describe("réseau routier", () => {
  it("lisse une route en passant par ses points", () => {
    const e = echantillonner([[0, 0], [10, 5], [20, 0]]);
    expect(e[0]).toEqual([0, 0]);
    expect(e[e.length - 1]).toEqual([20, 0]);
    expect(e.some((p) => p[0] === 10 && p[1] === 5)).toBe(true);
  });

  it("relie les routes à leurs carrefours", () => {
    const g = graphe(ROUTES);
    const centre = g.noeuds.findIndex((p) => p[0] === 0 && p[1] === 0);
    expect(g.voisins[centre]!.length).toBeGreaterThanOrEqual(3);
  });

  it("fait passer les personnages par la route", () => {
    const g = graphe(ROUTES);
    const c = chemin(g, [-18, 2], [1, 18]);
    // il longe la route horizontale puis remonte la verticale : jamais de raccourci en diagonale
    expect(c.slice(1, -1).every((p) => Math.abs(p[1]) < 0.01 || Math.abs(p[0]) < 0.01)).toBe(true);
    expect(longueur(c)).toBeGreaterThan(Math.hypot(19, 16));
  });
});

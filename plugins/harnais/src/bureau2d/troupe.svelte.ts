// Les agents de l'accueil : où ils sont, ce qu'ils font, leur file d'actions tirée du journal du cerveau. Chaque
// déplacement est un segment que l'écran anime (transition CSS de la durée donnée) ; avec du retard, ils vont plus vite.
import { habitant, type Evenement } from "@hameau/commun";
import { actions, durees } from "../ile/actions";
import { attache, consigne, type Consigne, type Geste } from "../bureau/journal";
import { distance, POSTES, trajet, type Point } from "./plan";

export const EMOJI: Record<Geste, string> = { attend: "", tape: "⌨️", lit: "📖", porte: "📁", telephone: "📱", cafe: "☕", dort: "💤", teste: "🧪" };

export class Acteur {
  x = $state(0);
  y = $state(0);
  /** Durée (ms) du segment en cours, pour la transition à l'écran. */
  duree = $state(0);
  geste = $state<Geste>("attend");
  texte = $state("");
  marche = $state(false);
  zone = $state("");
  file: Consigne[] = [];
  occupe = false;
  depuis = Date.now();

  constructor(
    readonly id: string,
    readonly nom: string,
    readonly couleur: string,
    readonly forme: "pion" | "mascotte",
  ) {}
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Troupe {
  acteurs = $state<Acteur[]>([]);
  modeleAllume = $state(true);
  private minuteur = 0;

  constructor() {
    this.minuteur = window.setInterval(() => this.diriger(), 400);
  }

  /** L'acteur d'un client du cerveau (créé au premier besoin), ou null si ce n'est pas un agent. */
  acteur(id: string): Acteur | null {
    const deja = this.acteurs.find((a) => a.id === id);
    if (deja) return deja;
    const h = habitant(id);
    if (!h) return null;
    const a = new Acteur(id, h.nom, h.couleurs[1], h.forme === "etoile" ? "mascotte" : "pion");
    a.zone = attache(id);
    const p = this.place(a.zone, a);
    a.x = p.x;
    a.y = p.y;
    this.acteurs.push(a);
    return a;
  }

  jouer(evs: Evenement[]): void {
    for (const a of actions(evs)) this.acteur(a.agent)?.file.push(consigne(a));
  }

  /** Une place libre dans une zone (la seconde si quelqu'un occupe déjà la première). */
  private place(zone: string, pour: Acteur): Point {
    const places = POSTES[zone]?.places ?? POSTES.dev!.places;
    const prise = (p: Point) => this.acteurs.some((a) => a !== pour && distance(a, p) < 0.3);
    return places.find((p) => !prise(p)) ?? places[0]!;
  }

  private async aller(a: Acteur, zone: string, vitesse: number): Promise<void> {
    a.zone = zone;
    a.marche = true;
    a.geste = "attend";
    for (const p of trajet(a, this.place(zone, a))) {
      a.duree = (distance(a, p) / (1.6 * vitesse)) * 1000;
      a.x = p.x;
      a.y = p.y;
      await pause(a.duree);
    }
    a.duree = 0;
    a.marche = false;
  }

  private diriger(): void {
    for (const a of this.acteurs) {
      if (a.occupe) continue;
      const c = a.file.shift();
      if (c) {
        a.occupe = true;
        const d = durees(a.file.length, 0);
        void this.aller(a, c.zone, d.vitesse).then(async () => {
          a.geste = c.geste;
          a.texte = c.texte;
          await pause(d.geste);
          a.occupe = false;
          a.depuis = Date.now();
        });
        continue;
      }
      // rien à faire : retour au poste d'attache ; Max dort quand le modèle est coupé
      const dort = a.id === "max" && !this.modeleAllume;
      const repos = attache(a.id);
      const geste: Geste = dort ? "dort" : "attend";
      if (Date.now() - a.depuis < 8000 || (a.zone === repos && a.geste === geste)) continue;
      a.occupe = true;
      void this.aller(a, repos, 1).then(() => {
        a.geste = geste;
        a.texte = dort ? "dort : le modèle est coupé" : "";
        a.occupe = false;
        a.depuis = Date.now();
      });
    }
  }

  detruire(): void {
    clearInterval(this.minuteur);
  }
}

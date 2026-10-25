// Le bureau vivant : la scène, la caméra (glisser, molette, clic sur une zone) et les agents qui rejouent le journal du
// cerveau. Chaque agent a sa file d'actions ; s'il prend du retard, il marche et agit plus vite. Sans rien à faire, il
// retourne à son poste d'attache ; Max fait la sieste quand le modèle est coupé.
import { habitant, type Evenement } from "@hameau/commun";
import * as THREE from "three";
import { actions, durees } from "../ile/actions";
import { Bureau, type Piece, type Theme } from "./bureau";
import { attache, consigne, posteLibre, type Consigne } from "./journal";
import { mascotteClaude } from "./mascotte";
import { MEUBLER, PIECES } from "./pieces";
import { Agent, pion } from "./pion";

const DIRECTION = new THREE.Vector3(0.32, 1, 0.78).normalize();
const DEFAUT = 54;

interface Suivi {
  agent: Agent;
  file: Consigne[];
  zone: string;
  poste: number;
  occupe: boolean;
  depuis: number;
}

export interface Survol {
  x: number;
  y: number;
  texte: string;
  agent: boolean;
}

export class Vivant {
  readonly bureau: Bureau;
  private readonly suivis = new Map<string, Suivi>();
  private readonly cible = new THREE.Vector3();
  private readonly cibleVoulue = new THREE.Vector3();
  private distance = DEFAUT;
  private distanceVoulue = DEFAUT;
  private avant = performance.now();
  private boucle = 0;
  private glisse: { x: number; y: number } | null = null;
  private aGlisse = false;
  private souris: { x: number; y: number } | null = null;
  private readonly rayon = new THREE.Raycaster();
  modeleAllume = true;
  choisie: Piece | null = null;
  /** Appelé à chaque image avec l'étiquette à afficher au survol (ou null). */
  onSurvol: (s: Survol | null) => void = () => {};
  onChoix: (p: Piece | null) => void = () => {};

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bureau = new Bureau(canvas, PIECES, MEUBLER);
    canvas.addEventListener("pointerdown", (e) => ((this.glisse = { x: e.clientX, y: e.clientY }), (this.aGlisse = false)));
    canvas.addEventListener("pointerup", (e) => {
      if (this.glisse && !this.aGlisse) this.choisir(PIECES.find((p) => p.id === this.viser(e)) ?? null);
      this.glisse = null;
    });
    canvas.addEventListener("pointermove", (e) => this.bouger(e));
    canvas.addEventListener("pointerleave", () => ((this.souris = null), (this.glisse = null)));
    canvas.addEventListener("wheel", (e) => (e.preventDefault(), this.zoomer(Math.exp(e.deltaY * 0.0012))), { passive: false });
    this.boucle = requestAnimationFrame((t) => this.image(t));
  }

  private viser(e: PointerEvent): string | null {
    const r = this.canvas.getBoundingClientRect();
    return this.bureau.viser(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
  }

  private bouger(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.souris = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!this.glisse) return;
    const dx = e.clientX - this.glisse.x;
    const dy = e.clientY - this.glisse.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.aGlisse = true;
    const k = this.distance * 0.0011;
    this.cibleVoulue.x -= dx * k;
    this.cibleVoulue.z -= dy * k * 1.3;
    this.cible.copy(this.cibleVoulue);
    this.glisse = { x: e.clientX, y: e.clientY };
  }

  zoomer(facteur: number): void {
    this.distanceVoulue = Math.min(90, Math.max(8, this.distanceVoulue * facteur));
  }

  recentrer(): void {
    this.choisir(null);
    this.cibleVoulue.set(0, 0, 0);
    this.distanceVoulue = DEFAUT;
  }

  choisir(p: Piece | null): void {
    this.choisie = p;
    if (p) {
      this.cibleVoulue.set((p.x0 + p.x1) / 2 + 2.4, 0, (p.z0 + p.z1) / 2);
      this.distanceVoulue = 26;
    }
    this.onChoix(p);
  }

  theme(t: Theme): void {
    this.bureau.appliquerTheme(t);
  }

  /** Les agents présents dans une zone. */
  presents(id: string): string[] {
    return [...this.suivis.values()].filter((s) => s.zone === id && !s.agent.marche).map((s) => s.agent.nom);
  }

  /** Ajoute au bureau ce que le journal du cerveau vient de noter. */
  jouer(evs: Evenement[]): void {
    for (const a of actions(evs)) {
      const s = this.suivi(a.agent);
      if (s) s.file.push(consigne(a));
    }
  }

  /** Crée l'agent au premier événement qui le concerne (ou d'emblée pour Max). */
  suivi(id: string): Suivi | null {
    const deja = this.suivis.get(id);
    if (deja) return deja;
    const h = habitant(id);
    if (!h) return null;
    const silhouette = id === "max" ? pion(h.couleurs[1], ["costard"]) : h.forme === "etoile" ? mascotteClaude() : pion(h.couleurs[1], ["casque"]);
    const agent = new Agent(id, h.nom, silhouette, new THREE.Vector3());
    this.bureau.scene.add(agent.groupe);
    const zone = attache(id);
    const s: Suivi = { agent, file: [], zone, poste: this.libre(zone), occupe: false, depuis: performance.now() };
    const p = this.position(zone, s.poste);
    agent.groupe.position.set(p.x, 0.03, p.z);
    agent.faire("attend", "", p.cap);
    this.suivis.set(id, s);
    return s;
  }

  private libre(zone: string, sauf?: Suivi): number {
    const p = PIECES.find((q) => q.id === zone)!;
    const occupes = [...this.suivis.values()].filter((s) => s !== sauf && s.zone === zone).map((s) => s.poste);
    return posteLibre(p.postes.length, occupes);
  }

  private position(zone: string, i: number): { x: number; z: number; cap: number } {
    const p = PIECES.find((q) => q.id === zone)!;
    const o = p.postes[i]!;
    return { x: p.x0 + o.x, z: p.z0 + o.z, cap: o.cap };
  }

  private async aller(s: Suivi, zone: string, vitesse: number): Promise<{ x: number; z: number; cap: number }> {
    s.zone = zone;
    s.poste = this.libre(zone, s);
    const p = this.position(zone, s.poste);
    await s.agent.suivre(this.bureau.chemin(s.agent.groupe.position, p), 2.2 * vitesse, performance.now());
    return p;
  }

  /** Fait avancer chaque agent libre : prochaine action de sa file, ou retour au poste d'attache. */
  private diriger(t: number): void {
    for (const s of this.suivis.values()) {
      if (s.occupe) continue;
      const c = s.file.shift();
      const attente = s.file.length;
      if (c) {
        s.occupe = true;
        const d = durees(attente, 0);
        void this.aller(s, c.zone, d.vitesse).then(async (p) => {
          s.agent.faire(c.geste, c.texte, p.cap);
          await new Promise((r) => setTimeout(r, d.geste));
          s.occupe = false;
          s.depuis = performance.now();
        });
        continue;
      }
      // rien à faire depuis un moment : retour au poste d'attache (Max dort sur le canapé si le modèle est coupé)
      const repos = s.agent.id === "max" && !this.modeleAllume ? "boss" : attache(s.agent.id);
      const geste = s.agent.id === "max" && !this.modeleAllume ? "dort" : "attend";
      if (t - s.depuis < 8000 || (s.zone === repos && s.agent.geste === geste)) continue;
      s.occupe = true;
      void this.aller(s, repos, 1).then((p) => {
        const poste = geste === "dort" ? this.position("boss", 1) : p;
        if (geste === "dort") s.agent.groupe.position.set(poste.x, 0.03, poste.z);
        s.agent.faire(geste, geste === "dort" ? "fait la sieste (modèle coupé)" : "", poste.cap);
        s.occupe = false;
        s.depuis = performance.now();
      });
    }
  }

  private survol(l: number, h: number): Survol | null {
    if (!this.souris || this.glisse) return null;
    const cam = this.bureau.camera;
    this.rayon.setFromCamera(new THREE.Vector2((this.souris.x / l) * 2 - 1, -(this.souris.y / h) * 2 + 1), cam);
    const ecran = (v: THREE.Vector3) => {
      const p = v.clone().project(cam);
      return { x: ((p.x + 1) / 2) * l, y: ((1 - p.y) / 2) * h };
    };
    for (const s of this.suivis.values()) {
      if (this.rayon.intersectObject(s.agent.groupe, true).length) {
        const a = s.agent;
        return { ...ecran(a.tete().add(new THREE.Vector3(0, 0.5, 0))), texte: `${a.nom} · ${a.marche ? "en route" : a.texte || "attend"}`, agent: true };
      }
    }
    const id = this.bureau.viser(this.souris.x, this.souris.y, l, h);
    const p = PIECES.find((q) => q.id === id);
    this.canvas.style.cursor = p ? "pointer" : "grab";
    return p ? { ...ecran(new THREE.Vector3((p.x0 + p.x1) / 2, 1.2, p.z0)), texte: `${p.emoji} ${p.nom}`, agent: false } : null;
  }

  private image(t: number): void {
    const dt = Math.min(0.1, Math.max(0, (t - this.avant) / 1000));
    this.avant = t;
    const l = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.floor(l * this.bureau.renderer.getPixelRatio())) this.bureau.taille(l, h);
    this.cible.lerp(this.cibleVoulue, 1 - Math.pow(0.002, dt));
    this.distance += (this.distanceVoulue - this.distance) * (1 - Math.pow(0.002, dt));
    this.bureau.camera.position.copy(this.cible).addScaledVector(DIRECTION, this.distance);
    this.bureau.camera.lookAt(this.cible);
    this.bureau.majServeur(this.modeleAllume);
    this.diriger(t);
    for (const s of this.suivis.values()) s.agent.animer(t, dt);
    this.bureau.rendre(t);
    this.onSurvol(this.survol(l, h));
    this.boucle = requestAnimationFrame((u) => this.image(u));
  }

  detruire(): void {
    cancelAnimationFrame(this.boucle);
    this.bureau.renderer.dispose();
  }
}

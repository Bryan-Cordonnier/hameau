// Le quartier de Hameau en 3D : sol infini, carrés d'herbe, routes courbes avec trottoirs, lignes et lampadaires,
// parcelles de tailles et d'orientations libres (une couleur secondaire par zone), bâtiments épurés, drones qui portent
// les flux de données, agents qui marchent par les routes. Sombre ou clair. Ombrage des recoins et léger halo.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Segment } from "./disposition";
import { chemin, echantillonner, graphe, type Graphe, type Pt } from "./reseau";

export type Theme = "sombre" | "clair";

const PAL = {
  sombre: { sol: "#171a20", herbe: "#1c3127", parcelle: "#272c37", route: "#3a4150", trottoir: "#4d5668", ligne: "#c9d1e0", corps: "#4a5263", toit: "#5a6375", arbre: "#3bb07a", tronc: "#5a4637", accent: "#ff8a66", froid: "#7fb7ff", vitre: "#151820" },
  clair: { sol: "#e2e5eb", herbe: "#cfe7c9", parcelle: "#f6f7f9", route: "#b9c1cd", trottoir: "#eef0f4", ligne: "#ffffff", corps: "#ffffff", toit: "#eceff4", arbre: "#4cc07e", tronc: "#9b7a5a", accent: "#f2785a", froid: "#4f8fe8", vitre: "#cfe2f3" },
};

export interface ZoneDef {
  id: string;
  nom: string;
  emoji: string;
  /** Couleur secondaire de la zone (bordure de parcelle, détails). */
  teinte: string;
  x: number;
  z: number;
  l: number;
  p: number;
  r: number;
}

export interface Zone extends ZoneDef {
  groupe: THREE.Group;
  /** Où se tiennent les agents qui viennent ici (devant, au bout de l'allée). */
  porte: THREE.Vector3;
}

const boite = (l: number, h: number, p: number, m: THREE.Material, x: number, y: number, z: number, r = 0.12) => {
  const b = new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 3, Math.min(r, l / 2, h / 2, p / 2)), m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = b.receiveShadow = true;
  return b;
};

export class Quartier {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(26, 1, 1, 500);
  readonly renderer: THREE.WebGLRenderer;
  readonly zones: Zone[] = [];
  readonly reseau: Graphe;
  readonly M = {
    sol: new THREE.MeshStandardMaterial({ roughness: 1 }),
    herbe: new THREE.MeshStandardMaterial({ roughness: 1 }),
    parcelle: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
    route: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.95 }),
    trottoir: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }),
    ligne: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 }),
    corps: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    toit: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    arbre: new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
    tronc: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    accent: new THREE.MeshStandardMaterial({ roughness: 0.5 }),
    lueur: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
    froid: new THREE.MeshStandardMaterial({ roughness: 0.4 }),
    vitre: new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1 }),
    lampe: new THREE.MeshStandardMaterial({ roughness: 0.3, color: "#fff2d6", emissive: "#ffd9a0" }),
  };
  private readonly teintes = new Map<string, THREE.MeshStandardMaterial>();
  private readonly hemi = new THREE.HemisphereLight();
  private readonly soleil = new THREE.DirectionalLight("#fff4e6", 2.6);
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly ao: GTAOPass;
  private readonly drones: { courbe: THREE.CatmullRomCurve3; groupe: THREE.Group; phase: number; duree: number }[] = [];
  private readonly animes: { o: THREE.Object3D; f: (o: THREE.Object3D, t: number) => void }[] = [];
  theme: Theme = "sombre";

  constructor(
    canvas: HTMLCanvasElement,
    zones: ZoneDef[],
    readonly routes: Pt[][],
    batir: Record<string, (g: THREE.Group, q: Quartier, teinte: THREE.MeshStandardMaterial) => void>,
    grille?: { segments: Segment[]; parcs: { genre: "parc" | "parking" | "place" | "jardin" | "terrain"; x: number; z: number; l: number; p: number }[] },
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.soleil.position.set(-30, 52, 22);
    this.soleil.castShadow = true;
    this.soleil.shadow.mapSize.set(2048, 2048);
    this.soleil.shadow.radius = 6;
    this.soleil.shadow.blurSamples = 16;
    this.soleil.shadow.bias = -0.0004;
    Object.assign(this.soleil.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, far: 180 });
    this.scene.add(this.hemi, this.soleil);

    const sol = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), this.M.sol);
    sol.rotation.x = -Math.PI / 2;
    sol.receiveShadow = true;
    this.scene.add(sol);

    this.reseau = graphe(routes);
    if (grille) {
      this.rues(grille.segments);
      for (const p of grille.parcs) ({ parc: this.parc, parking: this.parking, place: this.place, jardin: this.jardin, terrain: this.terrain })[p.genre].call(this, p.x, p.z, p.l, p.p);
    } else for (const r of routes) this.route(r);
    for (const d of zones) this.zone(d, batir[d.id]);
    if (!grille) {
      this.herbe();
      this.lampadaires();
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.4, thickness: 1, scale: 1.1 });
    this.ao.blendIntensity = 0.85;
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.appliquerTheme("sombre");
  }

  /** Une matière de la couleur secondaire d'une zone (lumineuse en sombre). */
  teinte(c: string): THREE.MeshStandardMaterial {
    let m = this.teintes.get(c);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: c, emissive: c, roughness: 0.5 });
      this.teintes.set(c, m);
    }
    return m;
  }

  /**
   * Rues droites (horizontales ou verticales) qui se rejoignent en T : asphalte, trottoirs, lignes de rive, pointillés.
   * Les trottoirs s'interrompent là où une rue arrive, et une rue qui débouche sur une autre s'arrête au bord de son
   * trottoir ; passages piétons à l'entrée de chaque carrefour, lampadaires aux angles.
   */
  private rues(segments: Segment[]): void {
    const L = 3.4;
    const T = 0.9;
    const plat = (x0: number, z0: number, x1: number, z1: number, h: number, m: THREE.Material, y = 0) => {
      if (x1 - x0 <= 0.01 || z1 - z0 <= 0.01) return;
      const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), m);
      b.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2);
      b.receiveShadow = true;
      this.scene.add(b);
    };
    const surLaRue = (s: Segment, x: number, z: number) =>
      s.x1 === s.x2 ? Math.abs(x - s.x1) < 0.01 && z > Math.min(s.z1, s.z2) + 0.01 && z < Math.max(s.z1, s.z2) - 0.01 : Math.abs(z - s.z1) < 0.01 && x > Math.min(s.x1, s.x2) + 0.01 && x < Math.max(s.x1, s.x2) - 0.01;
    let lampe = 0;
    for (const s of segments) {
      const vertical = s.x1 === s.x2;
      // repère local : u le long de la rue (de a à b), v en travers
      const a = vertical ? Math.min(s.z1, s.z2) : Math.min(s.x1, s.x2);
      const b = vertical ? Math.max(s.z1, s.z2) : Math.max(s.x1, s.x2);
      const c = vertical ? s.x1 : s.z1;
      const boite2 = (u0: number, u1: number, v0: number, v1: number, h: number, m: THREE.Material, y = 0) =>
        vertical ? plat(c + v0, u0, c + v1, u1, h, m, y) : plat(u0, c + v0, u1, c + v1, h, m, y);
      // les bouts qui débouchent sur une autre rue s'arrêtent à son bord (u = a + L/2 + T)
      const debutSur = segments.some((o) => o !== s && surLaRue(o, vertical ? c : a, vertical ? a : c));
      const finSur = segments.some((o) => o !== s && surLaRue(o, vertical ? c : b, vertical ? b : c));
      const ua = debutSur ? a + L / 2 + T : a;
      const ub = finSur ? b - L / 2 - T : b;
      boite2(debutSur ? a : a, finSur ? b : b, -L / 2, L / 2, 0.04, this.M.route);
      // coupures : les rues qui arrivent sur celle-ci, de chaque côté
      const coupes: Record<number, [number, number][]> = { [-1]: [], [1]: [] };
      for (const o of segments) {
        if (o === s) continue;
        for (const [ex, ez, ax, az] of [
          [o.x1, o.z1, o.x2, o.z2],
          [o.x2, o.z2, o.x1, o.z1],
        ] as [number, number, number, number][]) {
          if (!surLaRue(s, ex, ez)) continue;
          const u = vertical ? ez : ex;
          const cote = Math.sign(vertical ? ax - ex : az - ez) as -1 | 1;
          coupes[cote]!.push([u - L / 2, u + L / 2]);
          // passage piéton à l'entrée de la rue qui arrive, et un lampadaire à l'angle
          for (let k = -1.2; k <= 1.21; k += 0.6) {
            const v = cote * (L / 2 + T / 2 + 0.2);
            if (vertical) plat(c + v - 0.4, u + k - 0.17, c + v + 0.4, u + k + 0.17, 0.01, this.M.ligne, 0.04);
            else plat(u + k - 0.17, c + v - 0.4, u + k + 0.17, c + v + 0.4, 0.01, this.M.ligne, 0.04);
          }
          if (lampe++ % 2 === 0) {
            const lx = vertical ? c + cote * (L / 2 + T / 2) : u + L / 2 + T / 2;
            const lz = vertical ? u + L / 2 + T / 2 : c + cote * (L / 2 + T / 2);
            const poteau = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), this.M.toit);
            poteau.position.set(lx, 1.3, lz);
            poteau.castShadow = true;
            const tete = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), this.M.lampe);
            tete.position.set(lx, 2.55, lz);
            this.scene.add(poteau, tete);
          }
        }
      }
      // trottoirs et lignes de rive, en évitant les coupures
      for (const cote of [-1, 1] as const) {
        const morceaux: [number, number][] = [];
        let u = ua;
        for (const [c0, c1] of [...coupes[cote]!].sort((x, y) => x[0] - y[0])) {
          if (c0 > u) morceaux.push([u, Math.min(c0, ub)]);
          u = Math.max(u, c1);
        }
        if (u < ub) morceaux.push([u, ub]);
        for (const [m0, m1] of morceaux) {
          const v0 = cote * (L / 2);
          const v1 = cote * (L / 2 + T);
          boite2(m0, m1, Math.min(v0, v1), Math.max(v0, v1), 0.12, this.M.trottoir);
          const e = cote * (L / 2 - 0.2);
          boite2(m0, m1, e - 0.035, e + 0.035, 0.01, this.M.ligne, 0.04);
        }
      }
      // pointillés du milieu, hors des carrefours
      const toutes = [...coupes[-1]!, ...coupes[1]!];
      for (let u = ua + 1; u < ub - 1.2; u += 2.4) {
        if (toutes.some(([c0, c1]) => u + 1.1 > c0 - 0.5 && u < c1 + 0.5)) continue;
        boite2(u, u + 1.1, -0.05, 0.05, 0.01, this.M.ligne, 0.04);
      }
    }
  }

  /** Un îlot sans zone devient un parc : pelouse, allée en croix, arbres, bancs, petit bassin. */
  private parc(x: number, z: number, l: number, p: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(boite(l, 0.16, p, this.M.herbe, 0, 0, 0, 0.5));
    g.add(boite(l * 0.9, 0.02, 1, this.M.trottoir, 0, 0.16, 0, 0.1));
    g.add(boite(1, 0.02, p * 0.9, this.M.trottoir, 0, 0.16, 0, 0.1));
    if ((x + z) % 3 > 1) {
    const bassin = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.12, 32), new THREE.MeshStandardMaterial({ color: "#5fb7e0", roughness: 0.15, metalness: 0.1 }));
    bassin.position.set(0, 0.2, 0);
    g.add(bassin);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) {
      this.arbre(g, sx * l * 0.3, sz * p * 0.28, 1 + ((sx + sz + 3) % 3) * 0.15, 0.16);
      this.arbre(g, sx * l * 0.38, sz * p * 0.12, 0.8, 0.16);
    }
    this.banc(g, 0, p * 0.25, Math.PI);
    this.banc(g, l * 0.22, 0, -Math.PI / 2);
    this.scene.add(g);
  }

  /** Une place pavée : dalles, arbres en bacs, bancs, une fontaine. */
  private place(x: number, z: number, l: number, p: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(boite(l, 0.14, p, this.M.trottoir, 0, 0, 0, 0.3));
    for (let a = -l / 2 + 1.5; a < l / 2 - 1; a += 3) for (const b of [-p / 2 + 1.3, p / 2 - 1.3]) {
      g.add(boite(1, 0.45, 1, this.M.toit, a, 0.14, b, 0.12));
      this.arbre(g, a, b, 0.75, 0.55);
    }
    const f = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 0.4, 24), this.M.toit);
    f.position.set(0, 0.34, 0);
    g.add(f);
    const eau = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 24), new THREE.MeshStandardMaterial({ color: "#5fb7e0", roughness: 0.1, emissive: "#2a6f9a", emissiveIntensity: 0.3 }));
    eau.position.set(0, 0.52, 0);
    g.add(eau);
    this.banc(g, -2, 0, Math.PI / 2);
    this.banc(g, 2, 0, -Math.PI / 2);
    this.scene.add(g);
  }

  /** Un jardin : rangées de haies basses et de fleurs. */
  private jardin(x: number, z: number, l: number, p: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(boite(l, 0.16, p, this.M.herbe, 0, 0, 0, 0.5));
    const fleurs = ["#ff8a66", "#f2c14e", "#ff7fa8", "#a98bff"];
    let k = 0;
    for (let b = -p / 2 + 1.2; b < p / 2 - 0.8; b += 1.4) {
      g.add(boite(l - 2, 0.4, 0.5, this.M.arbre, 0, 0.16, b, 0.2));
      for (let a = -l / 2 + 1.4; a < l / 2 - 1.2; a += 0.9) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: fleurs[k++ % 4], roughness: 0.6 }));
        fl.position.set(a, 0.62, b);
        g.add(fl);
      }
    }
    this.scene.add(g);
  }

  /** Un terrain de sport : sol coloré, lignes, deux paniers. */
  private terrain(x: number, z: number, l: number, p: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(boite(l, 0.12, p, this.M.herbe, 0, 0, 0, 0.4));
    const tl = Math.min(l - 2, p * 1.6);
    const tp = Math.min(p - 2, l / 1.6);
    g.add(boite(tl, 0.04, tp, new THREE.MeshStandardMaterial({ color: "#5d7fc4", roughness: 0.8 }), 0, 0.12, 0, 0.1));
    g.add(boite(0.08, 0.01, tp - 0.4, this.M.ligne, 0, 0.16, 0, 0.01));
    const cercle = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), this.M.ligne);
    cercle.rotation.x = -Math.PI / 2;
    cercle.position.y = 0.17;
    g.add(cercle);
    for (const s of [-1, 1]) {
      g.add(boite(0.1, 2, 0.1, this.M.toit, s * (tl / 2 - 0.3), 0.12, 0, 0.03));
      g.add(boite(0.08, 0.6, 0.9, this.M.corps, s * (tl / 2 - 0.4), 1.8, 0, 0.03));
    }
    this.scene.add(g);
  }

  /** Un îlot sans zone peut aussi être un parking : places tracées, quelques petites voitures. */
  private parking(x: number, z: number, l: number, p: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(boite(l, 0.1, p, this.M.route, 0, 0, 0, 0.3));
    const n = Math.floor((l - 1) / 1.6);
    const couleurs = ["#ff8a66", "#6fa8ff", "#f2c14e", "#46c8b4", "#c9d1e0"];
    for (let i = 0; i < n; i++) {
      const px = -l / 2 + 1 + i * 1.6;
      for (const s of [-1, 1]) {
        g.add(boite(0.06, 0.01, 2.2, this.M.ligne, px - 0.8, 0.1, s * (p / 2 - 1.3), 0.01));
        if ((i * 7 + s * 3 + 11) % 3 !== 0) {
          const voiture = new THREE.Group();
          voiture.add(boite(1, 0.45, 1.8, new THREE.MeshStandardMaterial({ color: couleurs[(i + (s > 0 ? 2 : 0)) % couleurs.length], roughness: 0.4 }), 0, 0.12, 0, 0.18));
          voiture.add(boite(0.85, 0.35, 0.95, this.M.vitre, 0, 0.55, -0.1, 0.15));
          voiture.position.set(px, 0.1, s * (p / 2 - 1.3));
          g.add(voiture);
        }
      }
    }
    this.scene.add(g);
  }

  /** Une route : asphalte, trottoirs relevés, lignes de rive et pointillés, en suivant la courbe. */
  private route(points: Pt[]): void {
    const pts = echantillonner(points, 0.6);
    const bande = (decalage: number, largeur: number, y: number, m: THREE.Material) => {
      const pos: number[] = [];
      const idx: number[] = [];
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)]!;
        const b = pts[Math.min(pts.length - 1, i + 1)]!;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / l;
        const nz = (b[0] - a[0]) / l;
        const c = decalage;
        pos.push(p[0] + nx * (c - largeur / 2), y, p[1] + nz * (c - largeur / 2), p[0] + nx * (c + largeur / 2), y, p[1] + nz * (c + largeur / 2));
        if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    bande(0, 3.4, 0.03, this.M.route);
    bande(2.15, 0.9, 0.07, this.M.trottoir);
    bande(-2.15, 0.9, 0.07, this.M.trottoir);
    bande(1.45, 0.07, 0.04, this.M.ligne);
    bande(-1.45, 0.07, 0.04, this.M.ligne);
    // pointillés du milieu
    const fins = echantillonner(points, 0.3);
    for (let i = 2; i < fins.length - 4; i += 8) {
      const a = fins[i]!;
      const b = fins[i + 3]!;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, Math.hypot(b[0] - a[0], b[1] - a[1])), this.M.ligne);
      m.position.set((a[0] + b[0]) / 2, 0.045, (a[1] + b[1]) / 2);
      m.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      this.scene.add(m);
    }
  }

  private zone(d: ZoneDef, batir?: (g: THREE.Group, q: Quartier, teinte: THREE.MeshStandardMaterial) => void): void {
    const g = new THREE.Group();
    g.position.set(d.x, 0, d.z);
    g.rotation.y = d.r;
    const teinte = this.teinte(d.teinte);
    // bordure colorée sous la parcelle : chaque zone a sa couleur, sans criarder
    g.add(boite(d.l + 0.3, 0.12, d.p + 0.3, teinte, 0, 0, 0, 0.7));
    g.add(boite(d.l, 0.2, d.p, this.M.parcelle, 0, 0, 0, 0.6));
    batir?.(g, this, teinte);
    g.traverse((o) => (o.userData.zone = d.id));
    this.scene.add(g);
    // l'allée : de la porte (devant la parcelle) jusqu'à la route la plus proche
    const devant = new THREE.Vector3(0, 0.08, d.p / 2 + 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), d.r).add(g.position);
    const route = this.reseau.noeuds.reduce((m, p) => (Math.hypot(p[0] - devant.x, p[1] - devant.z) < Math.hypot(m[0] - devant.x, m[1] - devant.z) ? p : m));
    const long = Math.hypot(route[0] - devant.x, route[1] - devant.z);
    if (long > 0.5) {
      const allee = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, long), this.M.trottoir);
      allee.position.set((route[0] + devant.x) / 2, 0.06, (route[1] + devant.z) / 2);
      allee.rotation.y = Math.atan2(route[0] - devant.x, route[1] - devant.z);
      allee.receiveShadow = true;
      this.scene.add(allee);
    }
    this.zones.push({ ...d, groupe: g, porte: devant });
  }

  /** Un arbre rond (dans un groupe ou dans la scène). */
  arbre(g: THREE.Object3D, x: number, z: number, s = 1, y = 0.2): void {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.11 * s, 0.7 * s, 6), this.M.tronc);
    t.position.set(x, y + 0.35 * s, z);
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 * s, 1), this.M.arbre);
    f.position.set(x, y + 1.1 * s, z);
    t.castShadow = f.castShadow = true;
    g.add(t, f);
  }

  /** Banc. */
  banc(g: THREE.Object3D, x: number, z: number, r = 0): void {
    const b = new THREE.Group();
    b.add(boite(1.2, 0.08, 0.4, this.M.toit, 0, 0.42, 0, 0.03));
    b.add(boite(1.2, 0.35, 0.06, this.M.toit, 0, 0.5, -0.18, 0.03));
    for (const dx of [-0.5, 0.5]) b.add(boite(0.08, 0.42, 0.36, this.M.corps, dx, 0, 0, 0.02));
    b.position.set(x, 0.2, z);
    b.rotation.y = r;
    g.add(b);
  }

  animer(o: THREE.Object3D, f: (o: THREE.Object3D, t: number) => void): void {
    this.animes.push({ o, f });
  }

  /** Carrés d'herbe aux contours souples, avec des bosquets, là où il n'y a ni route ni parcelle. */
  private herbe(): void {
    const occupe = (x: number, z: number, m: number) =>
      this.zones.some((d) => {
        const dx = x - d.x;
        const dz = z - d.z;
        const lx = Math.cos(d.r) * dx - Math.sin(d.r) * dz;
        const lz = Math.sin(d.r) * dx + Math.cos(d.r) * dz;
        return Math.abs(lx) < d.l / 2 + m && Math.abs(lz) < d.p / 2 + m;
      }) || this.reseau.noeuds.some((p) => Math.hypot(p[0] - x, p[1] - z) < 2.6 + m);
    let graine = 7;
    const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 60; k++) {
      const x = (hasard() - 0.5) * 90;
      const z = (hasard() - 0.5) * 70;
      const r = 2 + hasard() * 3.5;
      if (occupe(x, z, r * 0.6)) continue;
      const forme = new THREE.Shape();
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const rr = r * (0.75 + hasard() * 0.35);
        if (i === 0) forme.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else forme.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const tache = new THREE.Mesh(new THREE.ExtrudeGeometry(forme, { depth: 0.06, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.04, bevelSegments: 2 }), this.M.herbe);
      tache.rotation.x = -Math.PI / 2;
      tache.position.set(x, 0.0, z);
      tache.receiveShadow = true;
      this.scene.add(tache);
      const n = Math.floor(hasard() * 4);
      for (let i = 0; i < n; i++) this.arbre(this.scene, x + (hasard() - 0.5) * r, z + (hasard() - 0.5) * r, 0.8 + hasard() * 0.6, 0.08);
    }
  }

  /** Lampadaires le long des routes, en alternant les côtés ; ils s'allument dans le thème sombre. */
  private lampadaires(): void {
    let cote = 1;
    for (const r of this.routes) {
      const pts = echantillonner(r, 0.6);
      for (let i = 8; i < pts.length - 4; i += 16) {
        const a = pts[i - 1]!;
        const b = pts[i + 1]!;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = (-(b[1] - a[1]) / l) * 2.3 * cote;
        const nz = ((b[0] - a[0]) / l) * 2.3 * cote;
        cote = -cote;
        const p = pts[i]!;
        const poteau = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8), this.M.toit);
        poteau.position.set(p[0] + nx, 1.15, p[1] + nz);
        const tete = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), this.M.lampe);
        tete.position.set(p[0] + nx, 2.3, p[1] + nz);
        poteau.castShadow = true;
        this.scene.add(poteau, tete);
      }
    }
  }

  /** Un drone qui porte une enveloppe d'une zone à l'autre, en arc. */
  drone(de: string, vers: string, duree = 7000, phase = 0): void {
    const A = this.zones.find((z) => z.id === de)!;
    const B = this.zones.find((z) => z.id === vers)!;
    const haut = 6 + Math.hypot(A.x - B.x, A.z - B.z) * 0.12;
    const courbe = new THREE.CatmullRomCurve3([new THREE.Vector3(A.x, 3, A.z), new THREE.Vector3((A.x + B.x) / 2, haut, (A.z + B.z) / 2), new THREE.Vector3(B.x, 3, B.z)]);
    const ligne = new THREE.Line(new THREE.BufferGeometry().setFromPoints(courbe.getPoints(64)), new THREE.LineDashedMaterial({ color: "#ff8a66", dashSize: 0.35, gapSize: 0.45, transparent: true, opacity: 0.45 }));
    ligne.computeLineDistances();
    this.scene.add(ligne);
    const g = new THREE.Group();
    g.add(boite(0.7, 0.18, 0.7, this.M.corps, 0, 0, 0, 0.08));
    for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]] as [number, number][]) {
      const helice = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), new THREE.MeshStandardMaterial({ color: "#c9d1e0", transparent: true, opacity: 0.5 }));
      helice.position.set(x, 0.2, z);
      g.add(helice);
      const bras = boite(0.08, 0.06, 0.08, this.M.toit, x, 0.1, z, 0.02);
      g.add(bras);
    }
    const lettre = boite(0.42, 0.04, 0.3, new THREE.MeshStandardMaterial({ color: "#fff7ea" }), 0, -0.3, 0, 0.01);
    lettre.add(boite(0.42, 0.045, 0.06, this.M.lueur, 0, 0, 0, 0.01));
    g.add(lettre);
    const feu = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.M.lueur);
    feu.position.set(0, 0.1, 0.36);
    g.add(feu);
    g.traverse((o) => ((o as THREE.Mesh).isMesh && (o.castShadow = true)));
    this.scene.add(g);
    this.drones.push({ courbe, groupe: g, phase, duree });
  }

  /** Chemin à pied (par les routes) d'un point à la porte d'une zone. */
  cheminVers(de: THREE.Vector3, zone: string): THREE.Vector3[] {
    const z = this.zones.find((x) => x.id === zone)!;
    return chemin(this.reseau, [de.x, de.z], [z.porte.x, z.porte.z]).slice(1).map(([x, zz]) => new THREE.Vector3(x, 0.08, zz));
  }

  appliquerTheme(t: Theme): void {
    this.theme = t;
    const p = PAL[t];
    for (const k of ["sol", "herbe", "parcelle", "route", "trottoir", "ligne", "corps", "toit", "arbre", "tronc", "vitre"] as const) this.M[k].color.set(p[k]);
    const sombre = t === "sombre";
    this.M.accent.color.set(p.accent);
    this.M.lueur.color.set(p.accent);
    this.M.lueur.emissive.set(p.accent);
    this.M.lueur.emissiveIntensity = sombre ? 1.6 : 0.4;
    this.M.froid.color.set(p.froid);
    this.M.froid.emissive.set(p.froid);
    this.M.froid.emissiveIntensity = sombre ? 1.4 : 0.3;
    this.M.vitre.emissive.set(sombre ? "#ffb48f" : "#000000");
    this.M.vitre.emissiveIntensity = sombre ? 0.45 : 0;
    this.M.lampe.emissiveIntensity = sombre ? 1.3 : 0;
    for (const m of this.teintes.values()) m.emissiveIntensity = sombre ? 0.55 : 0.05;
    this.scene.fog = new THREE.Fog(p.sol, 90, 180);
    this.scene.background = new THREE.Color(p.sol);
    this.hemi.color.set(sombre ? "#9fb2d6" : "#ffffff");
    this.hemi.groundColor.set(sombre ? "#1d2129" : "#d8dde6");
    this.hemi.intensity = sombre ? 1.15 : 1.25;
    this.soleil.intensity = sombre ? 1.6 : 2.6;
    this.soleil.color.set(sombre ? "#b8c8ff" : "#fff4e6");
    this.bloom.strength = sombre ? 0.75 : 0.18;
    this.renderer.toneMappingExposure = sombre ? 1.05 : 0.95;
  }

  taille(l: number, h: number): void {
    this.renderer.setSize(l, h, false);
    this.composer.setSize(l, h);
    this.camera.aspect = l / h;
    this.camera.updateProjectionMatrix();
  }

  /** Zone sous un point de l'écran (coordonnées en pixels du canevas). */
  viser(x: number, y: number, l: number, h: number): Zone | null {
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2((x / l) * 2 - 1, -(y / h) * 2 + 1), this.camera);
    const t = r.intersectObjects(this.zones.map((z) => z.groupe), true)[0];
    return this.zones.find((z) => z.id === t?.object.userData.zone) ?? null;
  }

  rendre(t: number): void {
    for (const d of this.drones) {
      const k = ((t + d.phase) % d.duree) / d.duree;
      const p = d.courbe.getPointAt(k);
      const q = d.courbe.getPointAt(Math.min(1, k + 0.01));
      d.groupe.position.copy(p).setY(p.y + Math.sin(t / 250) * 0.06);
      d.groupe.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
      d.groupe.children.forEach((c, i) => i > 0 && i < 9 && i % 2 === 1 && (c.rotation.y = t / 30));
    }
    for (const a of this.animes) a.f(a.o, t);
    this.composer.render();
  }
}

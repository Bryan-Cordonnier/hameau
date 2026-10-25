// Le bureau numérique des IA : un open space vu de haut, sans plafond. Des zones de tailles inégales posées sur un même
// plateau (sols différents, pas de couloir) ; seules quelques salles sont fermées, par des vitres ou des murs pleins.
// Palette neutre : seule la couleur des agents ressort. Les agents marchent en contournant les meubles (A* sur grille).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export type Theme = "sombre" | "clair";

export interface Poste {
  /** Coordonnées locales à la zone (depuis son coin x0, z0). */
  x: number;
  z: number;
  /** Direction du regard (radians) quand l'agent y travaille. */
  cap: number;
}

export interface Piece {
  id: string;
  nom: string;
  emoji: string;
  teinte: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  sol: "parquet" | "moquette" | "beton";
  /** Zone fermée : vitres ou murs pleins, avec une porte (côté, et distance depuis le début du mur). */
  murs?: "vitre" | "plein";
  porte?: { cote: "nord" | "sud" | "est" | "ouest"; a: number };
  postes: Poste[];
}

const PAL = {
  sombre: { fond: "#121214", dalle: "#1f1f23", mur: "#3a3a41", murHaut: "#56565f", bois: "#7a6150", meuble: "#36363d", meubleClair: "#47474f", tissu: "#4c4c56", vitre: "#a9c2d8", plante: "#3fae72", parquet: "#3a332d", moquette: "#2b2b31", beton: "#333337" },
  clair: { fond: "#e7e7ea", dalle: "#f4f4f6", mur: "#ffffff", murHaut: "#e9e9ed", bois: "#c9a27c", meuble: "#ffffff", meubleClair: "#eeeef1", tissu: "#d4d4dc", vitre: "#b9d2e8", plante: "#52c27f", parquet: "#e4d6c4", moquette: "#e2e2e8", beton: "#ececee" },
};

const boite = (l: number, h: number, p: number, m: THREE.Material, x: number, y: number, z: number, r = 0.04) => {
  const b = new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 2, Math.min(r, l / 2, h / 2, p / 2)), m);
  b.position.set(x, y + h / 2, z);
  b.castShadow = b.receiveShadow = true;
  return b;
};

const CEL = 0.25;

export class Bureau {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(22, 1, 1, 400);
  readonly renderer: THREE.WebGLRenderer;
  readonly pieces: (Piece & { groupe: THREE.Group })[] = [];
  readonly M = {
    dalle: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    parquet: new THREE.MeshStandardMaterial({ roughness: 0.75 }),
    moquette: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
    beton: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    mur: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    murHaut: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    bois: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    meuble: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    meubleClair: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    tissu: new THREE.MeshStandardMaterial({ roughness: 0.95 }),
    vitre: new THREE.MeshStandardMaterial({ roughness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
    plante: new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
    ecran: new THREE.MeshStandardMaterial({ color: "#7fb7ff", emissive: "#7fb7ff", roughness: 0.3 }),
    ecranVert: new THREE.MeshStandardMaterial({ color: "#8fffb0", emissive: "#5fe08a", roughness: 0.3 }),
    voyantRouge: new THREE.MeshStandardMaterial({ color: "#ff7a7a", emissive: "#ff4d4d", roughness: 0.3 }),
    lampe: new THREE.MeshStandardMaterial({ color: "#fff2d6", emissive: "#ffd9a0", roughness: 0.3 }),
  };
  private readonly teintes = new Map<string, THREE.MeshStandardMaterial>();
  private readonly hemi = new THREE.HemisphereLight();
  private readonly soleil = new THREE.DirectionalLight("#fff4e6", 2.4);
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly animes: ((t: number) => void)[] = [];
  private readonly obstacles: THREE.Object3D[] = [];
  private grille!: Uint8Array;
  private gx0 = 0;
  private gz0 = 0;
  private nx = 0;
  private nz = 0;
  theme: Theme = "sombre";
  serveurAllume = true;

  constructor(
    canvas: HTMLCanvasElement,
    pieces: Piece[],
    readonly meubler: Record<string, (g: THREE.Group, b: Bureau, p: Piece, teinte: THREE.MeshStandardMaterial) => void>,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.soleil.position.set(-14, 30, 18);
    this.soleil.castShadow = true;
    this.soleil.shadow.mapSize.set(2048, 2048);
    this.soleil.shadow.radius = 5;
    this.soleil.shadow.blurSamples = 12;
    this.soleil.shadow.bias = -0.0004;
    Object.assign(this.soleil.shadow.camera, { left: -20, right: 20, top: 16, bottom: -16, far: 90 });
    this.scene.add(this.hemi, this.soleil);

    // le plateau et son mur d'enceinte (haut au fond, bas devant pour voir dedans)
    const x0 = Math.min(...pieces.map((p) => p.x0)) - 0.5;
    const x1 = Math.max(...pieces.map((p) => p.x1)) + 0.5;
    const z0 = Math.min(...pieces.map((p) => p.z0)) - 0.5;
    const z1 = Math.max(...pieces.map((p) => p.z1)) + 0.5;
    const plateau = new THREE.Group();
    plateau.add(boite(x1 - x0, 0.3, z1 - z0, this.M.dalle, (x0 + x1) / 2, -0.3, (z0 + z1) / 2, 0.2));
    const E = 0.16;
    plateau.add(boite(x1 - x0, 0.9, E, this.M.mur, (x0 + x1) / 2, 0, z0, 0.03), boite(E, 0.9, z1 - z0, this.M.mur, x0, 0, (z0 + z1) / 2, 0.03));
    plateau.add(boite(x1 - x0, 0.25, E, this.M.mur, (x0 + x1) / 2, 0, z1, 0.03), boite(E, 0.25, z1 - z0, this.M.mur, x1, 0, (z0 + z1) / 2, 0.03));
    for (let i = 0; i < 4; i++) this.obstacles.push(plateau.children[i + 1]!);
    this.scene.add(plateau);
    for (const p of pieces) this.piece(p);
    this.construireGrille(x0, z0, x1, z1);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const ao = new GTAOPass(this.scene, this.camera, 1, 1);
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.3, thickness: 1, scale: 1 });
    ao.blendIntensity = 0.9;
    this.composer.addPass(ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.4, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.appliquerTheme("sombre");
  }

  teinte(c: string): THREE.MeshStandardMaterial {
    let m = this.teintes.get(c);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
      this.teintes.set(c, m);
    }
    return m;
  }

  /** Une zone : son sol, éventuellement ses murs (vitres ou pleins) avec une porte, puis son mobilier en coordonnées locales. */
  private piece(p: Piece): void {
    const g = new THREE.Group();
    const l = p.x1 - p.x0;
    const pr = p.z1 - p.z0;
    const sol = boite(l, 0.025, pr, this.M[p.sol], l / 2, 0, pr / 2, 0.02);
    sol.userData.sol = true;
    g.add(sol);
    if (p.murs) {
      const H = 0.9;
      const E = 0.1;
      const mur = (ax: number, az: number, bx: number, bz: number) => {
        const lg = Math.hypot(bx - ax, bz - az);
        if (lg < 0.05) return;
        const horiz = Math.abs(bx - ax) > Math.abs(bz - az);
        const cx = (ax + bx) / 2;
        const cz = (az + bz) / 2;
        const [sx, sz] = horiz ? [lg, E] : [E, lg];
        if (p.murs === "plein") {
          g.add(boite(sx, H, sz, this.M.mur, cx, 0, cz, 0.03), boite(sx + 0.02, 0.04, sz + 0.02, this.M.murHaut, cx, H, cz, 0.02));
        } else {
          const v = new THREE.Mesh(new THREE.BoxGeometry(horiz ? lg : 0.03, H - 0.12, horiz ? 0.03 : lg), this.M.vitre);
          v.position.set(cx, 0.08 + (H - 0.12) / 2, cz);
          g.add(v, boite(sx, 0.08, sz, this.M.murHaut, cx, 0, cz, 0.02), boite(sx, 0.04, sz, this.M.murHaut, cx, H - 0.04, cz, 0.02));
        }
      };
      const cotes = { nord: [0, 0, l, 0], sud: [0, pr, l, pr], ouest: [0, 0, 0, pr], est: [l, 0, l, pr] } as const;
      for (const [cote, [ax, az, bx, bz]] of Object.entries(cotes)) {
        if (p.porte?.cote !== cote) {
          mur(ax, az, bx, bz);
          continue;
        }
        const a = p.porte.a - 0.8;
        const b = p.porte.a + 0.8;
        if (az === bz) mur(ax, az, a, az), mur(b, az, bx, bz);
        else mur(ax, az, ax, a), mur(ax, b, bx, bz);
      }
    }
    this.meubler[p.id]?.(g, this, p, this.teinte(p.teinte));
    g.position.set(p.x0, 0, p.z0);
    g.traverse((o) => (o.userData.piece = p.id));
    for (const o of g.children) if (!o.userData.sol) this.obstacles.push(o);
    this.scene.add(g);
    this.pieces.push({ ...p, groupe: g });
  }

  // ---------- petit mobilier réutilisable ----------
  bureauEcran(g: THREE.Object3D, x: number, z: number, cap: number, ecrans = 1, ecran = this.M.ecran): void {
    const o = new THREE.Group();
    o.add(boite(1.1, 0.05, 0.55, this.M.bois, 0, 0.5, 0, 0.02));
    for (const dx of [-0.5, 0.5]) o.add(boite(0.05, 0.5, 0.5, this.M.meuble, dx, 0, 0, 0.01));
    for (let i = 0; i < ecrans; i++) {
      const dx = (i - (ecrans - 1) / 2) * 0.42;
      o.add(boite(0.4, 0.26, 0.03, this.M.meuble, dx, 0.62, -0.16, 0.01));
      o.add(boite(0.36, 0.22, 0.01, ecran, dx, 0.64, -0.14, 0.005));
      o.add(boite(0.04, 0.1, 0.04, this.M.meuble, dx, 0.55, -0.17, 0.01));
    }
    o.add(boite(0.36, 0.02, 0.12, this.M.meubleClair, 0, 0.55, 0.08, 0.01));
    o.add(this.chaise(0, 0.55));
    o.position.set(x, 0, z);
    o.rotation.y = cap + Math.PI;
    g.add(o);
  }

  chaise(x: number, z: number): THREE.Group {
    const c = new THREE.Group();
    c.add(boite(0.36, 0.06, 0.36, this.M.tissu, 0, 0.32, 0, 0.03));
    c.add(boite(0.36, 0.38, 0.06, this.M.tissu, 0, 0.38, 0.16, 0.03));
    c.add(boite(0.05, 0.32, 0.05, this.M.meuble, 0, 0, 0, 0.01));
    c.position.set(x, 0, z);
    return c;
  }

  plante(g: THREE.Object3D, x: number, z: number, s = 1): void {
    g.add(boite(0.28 * s, 0.3 * s, 0.28 * s, this.M.meubleClair, x, 0, z, 0.05));
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 * s, 1), this.M.plante);
    f.position.set(x, 0.55 * s, z);
    f.castShadow = true;
    g.add(f);
  }

  etagere(g: THREE.Object3D, x: number, z: number, l: number, cap: number, couleurs: string[]): void {
    const o = new THREE.Group();
    o.add(boite(l, 1.3, 0.3, this.M.meuble, 0, 0, 0, 0.02));
    let k = 0;
    for (let rang = 0; rang < 3; rang++) {
      for (let a = -l / 2 + 0.1; a < l / 2 - 0.08; a += 0.09) {
        o.add(boite(0.07, 0.28, 0.22, this.teinte(couleurs[k++ % couleurs.length]!), a + 0.035, 0.12 + rang * 0.4, 0.05, 0.01));
      }
    }
    o.position.set(x, 0, z);
    o.rotation.y = cap;
    g.add(o);
  }

  animer(f: (t: number) => void): void {
    this.animes.push(f);
  }

  /** Allume ou éteint les voyants de la salle serveur : le modèle local tourne ou dort. */
  majServeur(allume: boolean): void {
    this.serveurAllume = allume;
  }

  appliquerTheme(t: Theme): void {
    this.theme = t;
    const p = PAL[t];
    const sombre = t === "sombre";
    for (const k of ["dalle", "parquet", "moquette", "beton", "mur", "murHaut", "bois", "meuble", "meubleClair", "tissu", "vitre", "plante"] as const) this.M[k].color.set(p[k]);
    this.M.vitre.opacity = sombre ? 0.14 : 0.3;
    this.M.ecran.emissiveIntensity = sombre ? 1.2 : 0.5;
    this.M.ecranVert.emissiveIntensity = sombre ? 1.2 : 0.5;
    this.M.lampe.emissiveIntensity = sombre ? 1.4 : 0.3;
    this.scene.background = new THREE.Color(p.fond);
    this.hemi.color.set("#ffffff");
    this.hemi.groundColor.set(sombre ? "#1c1c20" : "#dcdce2");
    this.hemi.intensity = sombre ? 1.6 : 1.35;
    this.soleil.intensity = sombre ? 1.9 : 2.3;
    this.bloom.strength = sombre ? 0.4 : 0.1;
    this.renderer.toneMappingExposure = sombre ? 1.05 : 1;
  }

  taille(l: number, h: number): void {
    this.renderer.setSize(l, h, false);
    this.composer.setSize(l, h);
    this.camera.aspect = l / h;
    this.camera.updateProjectionMatrix();
  }

  viser(x: number, y: number, l: number, h: number): string | null {
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2((x / l) * 2 - 1, -(y / h) * 2 + 1), this.camera);
    const t = r.intersectObjects(this.pieces.map((p) => p.groupe), true)[0];
    return (t?.object.userData.piece as string | undefined) ?? null;
  }

  // ---------- déplacements : A* sur une grille de 25 cm ----------
  private construireGrille(x0: number, z0: number, x1: number, z1: number): void {
    this.gx0 = x0;
    this.gz0 = z0;
    this.nx = Math.ceil((x1 - x0) / CEL);
    this.nz = Math.ceil((z1 - z0) / CEL);
    this.grille = new Uint8Array(this.nx * this.nz);
    this.scene.updateMatrixWorld(true);
    const b = new THREE.Box3();
    const marge = 0.18;
    for (const o of this.obstacles) {
      b.setFromObject(o);
      if (b.isEmpty() || b.max.y < 0.12) continue;
      const i0 = Math.max(0, Math.floor((b.min.x - marge - x0) / CEL));
      const i1 = Math.min(this.nx - 1, Math.floor((b.max.x + marge - x0) / CEL));
      const j0 = Math.max(0, Math.floor((b.min.z - marge - z0) / CEL));
      const j1 = Math.min(this.nz - 1, Math.floor((b.max.z + marge - z0) / CEL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.grille[j * this.nx + i] = 1;
    }
  }

  private cellule(x: number, z: number): number {
    const i = Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.gx0) / CEL)));
    const j = Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.gz0) / CEL)));
    return j * this.nx + i;
  }

  /** La case libre la plus proche (les postes sont souvent sur une chaise, donc « dans » un meuble). */
  private libreProche(c: number): number {
    const vu = new Set([c]);
    const file = [c];
    while (file.length) {
      const k = file.shift()!;
      if (!this.grille[k]) return k;
      const i = k % this.nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = k + di + dj * this.nx;
        if (i + di < 0 || i + di >= this.nx || n < 0 || n >= this.grille.length || vu.has(n)) continue;
        vu.add(n);
        file.push(n);
      }
    }
    return c;
  }

  private centre(c: number): THREE.Vector3 {
    return new THREE.Vector3(this.gx0 + ((c % this.nx) + 0.5) * CEL, 0.03, this.gz0 + (Math.floor(c / this.nx) + 0.5) * CEL);
  }

  private voit(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const n = Math.ceil(a.distanceTo(b) / (CEL / 2));
    for (let k = 1; k < n; k++) if (this.grille[this.cellule(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n)]) return false;
    return true;
  }

  /** Chemin à pied jusqu'à un point (coordonnées du monde), en contournant meubles et murs. */
  chemin(de: THREE.Vector3, vers: { x: number; z: number }): THREE.Vector3[] {
    const fin = new THREE.Vector3(vers.x, 0.03, vers.z);
    const depart = this.libreProche(this.cellule(de.x, de.z));
    const but = this.libreProche(this.cellule(vers.x, vers.z));
    const g = new Map<number, number>([[depart, 0]]);
    const avant = new Map<number, number>();
    const ouverts = new Set([depart]);
    const h = (c: number) => {
      const dx = Math.abs((c % this.nx) - (but % this.nx));
      const dz = Math.abs(Math.floor(c / this.nx) - Math.floor(but / this.nx));
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    // shortcut: liste ouverte parcourue en entier (pas de tas), suffisant pour ~7 000 cases
    while (ouverts.size) {
      let c = -1;
      let meilleur = Infinity;
      for (const o of ouverts) {
        const f = g.get(o)! + h(o);
        if (f < meilleur) (meilleur = f), (c = o);
      }
      if (c === but) break;
      ouverts.delete(c);
      const i = c % this.nx;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const n = c + di + dj * this.nx;
          if (i + di < 0 || i + di >= this.nx || n < 0 || n >= this.grille.length || this.grille[n]) continue;
          if (di && dj && (this.grille[c + di] || this.grille[c + dj * this.nx])) continue;
          const cout = g.get(c)! + (di && dj ? 1.414 : 1);
          if (cout < (g.get(n) ?? Infinity)) g.set(n, cout), avant.set(n, c), ouverts.add(n);
        }
    }
    if (!avant.has(but) && but !== depart) return [fin];
    const cases = [but];
    while (cases[0] !== depart) cases.unshift(avant.get(cases[0]!)!);
    // on lisse : on ne garde que les points nécessaires pour ne pas traverser un obstacle
    const pts = [de.clone(), ...cases.map((c) => this.centre(c))];
    const lisse: THREE.Vector3[] = [];
    let k = 0;
    while (k < pts.length - 1) {
      let m = pts.length - 1;
      while (m > k + 1 && !this.voit(pts[k]!, pts[m]!)) m--;
      lisse.push(pts[m]!);
      k = m;
    }
    lisse.push(fin);
    return lisse;
  }

  rendre(t: number): void {
    for (const f of this.animes) f(t);
    this.composer.render();
  }
}

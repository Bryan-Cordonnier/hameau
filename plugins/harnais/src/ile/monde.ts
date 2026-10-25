// L'île en 3D low poly (three.js) : caméra basse et fixe en angle (on se déplace et on zoome, on ne tourne pas), lumière
// chaude, eau animée, terrain sculpté qui pousse avec les modules (grille.ts), bâtiments façon jouet avec intérieurs
// (au survol, le toit s'enlève et les murs s'effacent), jour et nuit à l'heure réelle.
import * as THREE from "three";
import type { Lieu } from "./actions";
import * as B from "./batiments";
import { Eau } from "./eau";
import { bruit2, CASE, cote, hauteur, MODULES_DE_BASE, placer, type Module, type Place } from "./grille";
import { limites, solDeLIle } from "./sol";

const mat = B.mat;

export interface Batiment {
  id: string;
  nom: string;
  emoji: string;
  groupe: THREE.Group;
  c: B.Construction;
  porte: THREE.Vector3;
}

const FABRIQUES: Record<string, { nom: string; emoji: string; f: (g: THREE.Group) => B.Construction }> = {
  panneau: { nom: "Tâches", emoji: "📌", f: B.tableau },
  bibliotheque: { nom: "Bibliothèque", emoji: "🧠", f: B.archives },
  poste: { nom: "Poste", emoji: "✉️", f: B.poste },
  mairie: { nom: "Mairie", emoji: "📅", f: B.mairie },
  maison: { nom: "Ta maison", emoji: "🏠", f: (g) => B.maison(g) },
  cabane: { nom: "Cabane de Max", emoji: "🪨", f: B.cabane },
  atelier: { nom: "Atelier", emoji: "🛠️", f: B.atelier },
  centrale: { nom: "Centrale", emoji: "⚡", f: B.centrale },
  gare: { nom: "Port", emoji: "⚓", f: B.port },
};

/** Direction de la caméra : basse (environ 24° au-dessus de l'horizon), en diagonale. */
const VISEE = new THREE.Vector3(1, 0.62, 1).normalize();

export class Monde {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly batiments = new Map<string, Batiment>();
  private readonly soleil: THREE.DirectionalLight;
  private readonly ciel: THREE.HemisphereLight;
  private readonly appoint: THREE.DirectionalLight;
  private eau: Eau | null = null;
  private readonly terrain = new THREE.Group();
  private readonly feuilles: THREE.Mesh[] = [];
  private places: Place[] = [];
  private chantiers: { id: number; titre: string; avancement: number }[] = [];
  private readonly cible = new THREE.Vector3();
  private centraleAllumee = false;
  private survole: string | null = null;
  private l = 1;
  private h = 1;
  nuit = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);

    this.ciel = new THREE.HemisphereLight("#dcefff", "#d8b98a", 1.6);
    this.scene.add(this.ciel);
    this.soleil = new THREE.DirectionalLight("#ffe2b8", 3.1);
    this.soleil.castShadow = true;
    this.soleil.shadow.mapSize.set(2048, 2048);
    this.soleil.shadow.bias = -0.0005;
    this.soleil.shadow.normalBias = 0.03;
    this.soleil.shadow.radius = 4;
    this.scene.add(this.soleil, this.soleil.target);
    this.appoint = new THREE.DirectionalLight("#a8c8ff", 0.8);
    this.appoint.position.set(20, 10, -16);
    this.scene.add(this.appoint);
    this.scene.add(this.terrain);
    this.reconstruire();
  }

  /** Les modules posés sur l'île : ceux de base, puis un par chantier ouvert (dans l'ordre de leur création). */
  private modules(): Module[] {
    return [...MODULES_DE_BASE, ...this.chantiers.map((c) => ({ id: `chantier-${c.id}`, cases: [1, 1] as [number, number] }))];
  }

  /** Recalcule l'île (terrain, eau, bâtiments, décor) à partir des modules. Les anciens ne bougent pas. */
  private reconstruire(): void {
    this.places = placer(this.modules());
    for (const b of this.batiments.values()) this.scene.remove(b.groupe);
    this.batiments.clear();
    this.terrain.clear();
    if (this.eau) this.scene.remove(this.eau.mesh);

    this.terrain.add(solDeLIle(this.places));
    const { x0, x1, z0, z1 } = limites(this.places);
    const centre = new THREE.Vector2((x0 + x1) / 2, (z0 + z1) / 2);
    this.eau = new Eau((x, z) => cote(this.places, x, z) - 0.25, centre, Math.max(x1 - x0, z1 - z0) * 2.2);
    this.scene.add(this.eau.mesh);

    for (const p of this.places) {
      const chantier = this.chantiers.find((c) => `chantier-${c.id}` === p.id);
      const fab = chantier ? { nom: `${chantier.titre} · ${chantier.avancement} %`, emoji: "🏗️", f: (g: THREE.Group) => B.chantier(g, chantier.avancement) } : FABRIQUES[p.id];
      if (fab) this.poser(p, fab.nom, fab.emoji, fab.f);
    }
    this.decor();
    this.cadrer();
    this.majHeure(new Date(), true);
    this.majCentrale(this.centraleAllumee);
  }

  private poser(p: Place, nom: string, emoji: string, f: (g: THREE.Group) => B.Construction): void {
    const g = new THREE.Group();
    g.position.set(p.x, hauteur(this.places, p.x, p.z) - 0.02, p.z);
    // le port regarde le large ; les autres tournent leur porte vers le centre de l'île
    g.rotation.y = p.id === "gare" ? -Math.atan2(p.z, p.x) : Math.hypot(p.x, p.z) < 0.1 ? 0 : Math.atan2(-p.x, -p.z);
    const c = f(g);
    g.traverse((o) => {
      o.userData.batiment = p.id;
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(g);
    const porte = new THREE.Vector3(c.porte[0], 0, c.porte[1]).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(g.position);
    porte.y = Math.max(0.15, hauteur(this.places, porte.x, porte.z));
    this.batiments.set(p.id, { id: p.id, nom, emoji, groupe: g, c, porte });
  }

  /** Arbres en bosquets, buissons, rochers, fleurs et chemins, espacés, là où il n'y a rien. */
  private decor(): void {
    const { x0, x1, z0, z1 } = limites(this.places);
    const poses: { x: number; z: number }[] = [];
    const loinDesBatiments = (x: number, z: number, m: number) =>
      this.places.every((p) => Math.abs(x - p.x) > (p.cases[0] * CASE) / 2 + m || Math.abs(z - p.z) > (p.cases[1] * CASE) / 2 + m) &&
      [...this.batiments.values()].every((b) => Math.hypot(b.porte.x - x, b.porte.z - z) > 1.6);
    const dispo = (x: number, z: number, ecart: number) => poses.every((q) => Math.hypot(q.x - x, q.z - z) > ecart);
    const sapin = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 1.5, 6), mat("#4f9150"), 80);
    const rond = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.62, 0), mat("#7cbf55"), 80);
    const tronc = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 0.6, 5), mat("#7a5233"), 160);
    const buisson = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 0), mat("#6fb04f"), 80);
    const rocher = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.35, 0), mat("#a59d92"), 80);
    const fleur = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), mat("#ffffff"), 300);
    const couleursFleurs = ["#f2785a", "#ffd34d", "#ffffff", "#c79bf2"].map((c) => new THREE.Color(c));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const n = { sapin: 0, rond: 0, tronc: 0, buisson: 0, rocher: 0, fleur: 0 };
    for (let k = 0; k < 2600; k++) {
      const x = x0 + bruit2(k * 0.731, 3.1) * (x1 - x0);
      const z = z0 + bruit2(7.7, k * 0.613) * (z1 - z0);
      const y = hauteur(this.places, x, z);
      const r = bruit2(k * 1.37, k * 0.29);
      const s = 0.8 + bruit2(k, k * 0.5) * 0.5;
      if (y < 0.18) {
        if (y > -0.7 && r < 0.05 && n.rocher < 80 && dispo(x, z, 1.4)) {
          q.setFromEuler(new THREE.Euler(r * 9, r * 7, 0));
          m.compose(new THREE.Vector3(x, y + 0.05, z), q, new THREE.Vector3(s * 1.3, s * 0.8, s * 1.1));
          rocher.setMatrixAt(n.rocher++, m);
          poses.push({ x, z });
        }
        continue;
      }
      if (!loinDesBatiments(x, z, 0.9)) continue;
      const bosquet = bruit2(x * 0.25 + 11, z * 0.25);
      if (bosquet > 0.55 && dispo(x, z, 1.9)) {
        m.compose(new THREE.Vector3(x, y + 0.3 * s, z), q.identity(), new THREE.Vector3(s, s, s));
        if (r < 0.5 && n.sapin < 80) {
          tronc.setMatrixAt(n.tronc++, m);
          m.compose(new THREE.Vector3(x, y + 1.1 * s, z), q.identity(), new THREE.Vector3(s, s, s));
          sapin.setMatrixAt(n.sapin++, m);
        } else if (n.rond < 80) {
          tronc.setMatrixAt(n.tronc++, m);
          m.compose(new THREE.Vector3(x, y + 0.95 * s, z), q.setFromEuler(new THREE.Euler(0, r * 6, 0)), new THREE.Vector3(s, s * 0.9, s));
          rond.setMatrixAt(n.rond++, m);
        }
        poses.push({ x, z });
      } else if (r < 0.08 && n.buisson < 80 && dispo(x, z, 1.2)) {
        m.compose(new THREE.Vector3(x, y + 0.15, z), q.identity(), new THREE.Vector3(s, s * 0.8, s));
        buisson.setMatrixAt(n.buisson++, m);
        poses.push({ x, z });
      } else if (r > 0.88 && n.fleur < 300) {
        m.compose(new THREE.Vector3(x, y + 0.08, z), q.identity(), new THREE.Vector3(1, 1, 1));
        fleur.setMatrixAt(n.fleur, m);
        fleur.setColorAt(n.fleur++, couleursFleurs[k % 4]!);
      }
    }
    sapin.count = n.sapin;
    rond.count = n.rond;
    tronc.count = n.tronc;
    buisson.count = n.buisson;
    rocher.count = n.rocher;
    fleur.count = n.fleur;
    for (const x of [sapin, rond, tronc, buisson, rocher]) {
      x.castShadow = x.receiveShadow = true;
      this.terrain.add(x);
    }
    this.terrain.add(fleur);
    this.chemins();
  }

  /** Chemins de dalles du tableau des tâches vers chaque porte, qui ondulent un peu. */
  private chemins(): void {
    const dalles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 6), mat("#e6dccb"), 600);
    const m = new THREE.Matrix4();
    let n = 0;
    const depart = this.batiments.get("panneau")?.porte ?? new THREE.Vector3();
    for (const b of this.batiments.values()) {
      if (b.id === "panneau") continue;
      const long = Math.hypot(b.porte.x - depart.x, b.porte.z - depart.z);
      const nx = -(b.porte.z - depart.z) / long;
      const nz = (b.porte.x - depart.x) / long;
      for (let d = 0.6; d < long && n < 600; d += 0.5) {
        const k = d / long;
        const vague = Math.sin(k * Math.PI) * Math.sin(long * 0.7) * 1.2;
        const x = depart.x + (b.porte.x - depart.x) * k + nx * vague + (bruit2(n, 1) - 0.5) * 0.15;
        const z = depart.z + (b.porte.z - depart.z) * k + nz * vague + (bruit2(1, n) - 0.5) * 0.15;
        const y = hauteur(this.places, x, z);
        if (y < 0.1) continue;
        m.compose(new THREE.Vector3(x, y + 0.03, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, n, 0)), new THREE.Vector3(1, 1, 1));
        dalles.setMatrixAt(n++, m);
      }
    }
    dalles.count = n;
    dalles.receiveShadow = true;
    this.terrain.add(dalles);
  }

  /** Centre la caméra sur l'île et règle l'ombre du soleil sur toute sa surface. */
  private cadrer(): void {
    const { x0, x1, z0, z1 } = limites(this.places);
    this.cible.set((x0 + x1) / 2, 0.4, (z0 + z1) / 2);
    const rayon = Math.max(x1 - x0, z1 - z0) / 2;
    this.soleil.position.copy(this.cible).add(new THREE.Vector3(-18, 26, 14));
    this.soleil.target.position.copy(this.cible);
    const s = this.soleil.shadow.camera;
    s.left = s.bottom = -rayon;
    s.right = s.top = rayon;
    s.far = 120;
    s.updateProjectionMatrix();
    this.placerCamera();
  }

  private placerCamera(): void {
    this.camera.position.copy(this.cible).addScaledVector(VISEE, 80);
    this.camera.lookAt(this.cible);
    this.camera.updateProjectionMatrix();
  }

  /** Taille du rendu : 19 unités de haut au zoom 1, quelle que soit la fenêtre. */
  redimensionner(l: number, h: number): void {
    this.l = l;
    this.h = h;
    this.renderer.setSize(l, h, false);
    const t = 9.5;
    const ratio = l / Math.max(1, h);
    this.camera.left = -t * ratio;
    this.camera.right = t * ratio;
    this.camera.top = t;
    this.camera.bottom = -t;
    this.camera.updateProjectionMatrix();
  }

  /** Glisser la vue (en pixels). */
  deplacer(dx: number, dy: number): void {
    const u = (this.camera.top - this.camera.bottom) / this.camera.zoom / this.h;
    const droite = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), VISEE).normalize();
    const avant = new THREE.Vector3(-VISEE.x, 0, -VISEE.z).normalize();
    this.cible.addScaledVector(droite, dx * u).addScaledVector(avant, (dy * u) / Math.sin(Math.asin(VISEE.y)));
    this.placerCamera();
  }

  zoomer(facteur: number): void {
    this.camera.zoom = Math.min(3.2, Math.max(0.35, this.camera.zoom * facteur));
    this.camera.updateProjectionMatrix();
  }

  majPanneau(couleurs: string[]): void {
    const g = this.batiments.get("panneau")?.groupe;
    if (!g) return;
    for (const f of this.feuilles) g.remove(f);
    this.feuilles.length = 0;
    couleurs.slice(0, 8).forEach((c, i) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.02), mat("#fffdf6"));
      f.position.set(-0.84 + (i % 4) * 0.56, 1.85 - Math.floor(i / 4) * 0.6, 0.08);
      f.rotation.z = (bruit2(i, 3) - 0.5) * 0.2;
      const punaise = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat(c));
      punaise.position.set(0, 0.2, 0.03);
      f.add(punaise);
      f.userData.batiment = "panneau";
      f.castShadow = true;
      g.add(f);
      this.feuilles.push(f);
    });
  }

  /** Les chantiers ouverts : chacun prend une case ; l'île pousse si besoin. */
  majChantiers(liste: { id: number; titre: string; avancement: number }[]): void {
    const avant = JSON.stringify(this.chantiers);
    this.chantiers = [...liste].sort((a, b) => a.id - b.id);
    if (JSON.stringify(this.chantiers) !== avant) this.reconstruire();
  }

  porte(lieu: Lieu, chantier?: number): THREE.Vector3 {
    const b =
      (chantier !== undefined && this.batiments.get(`chantier-${chantier}`)) ||
      (lieu === "chantier" ? [...this.batiments.values()].find((x) => x.id.startsWith("chantier-")) : undefined) ||
      this.batiments.get(lieu) ||
      this.batiments.get("panneau")!;
    return b.porte.clone();
  }

  majCentrale(allumee: boolean): void {
    this.centraleAllumee = allumee;
    const b = this.batiments.get("centrale");
    if (!b) return;
    for (const s of b.c.fumees) s.visible = allumee;
    for (const v of b.c.voyants) v.emissiveIntensity = allumee ? 0.9 : 0.05;
  }

  majHeure(d: Date, force = false): void {
    const h = d.getHours() + d.getMinutes() / 60;
    const nuit = h < 6 || h > 22 ? 1 : h < 8 ? 1 - (h - 6) / 2 : h > 20 ? (h - 20) / 2 : 0;
    if (!force && Math.abs(nuit - this.nuit) < 0.01) return;
    this.nuit = nuit;
    this.soleil.intensity = 3.1 * (1 - nuit) + 0.4 * nuit;
    this.soleil.color.set(new THREE.Color("#ffe2b8").lerp(new THREE.Color("#8fa6ff"), nuit));
    this.ciel.intensity = 1.6 - nuit * 1.05;
    this.ciel.color.set(new THREE.Color("#dcefff").lerp(new THREE.Color("#33406e"), nuit));
    for (const b of this.batiments.values()) for (const f of b.c.vitres) f.emissiveIntensity = nuit * 2.4;
  }

  /** Survol : le toit s'enlève et les murs s'effacent pour voir l'intérieur. */
  transparence(id: string | null): void {
    if (id === this.survole) return;
    this.survole = id;
    for (const b of this.batiments.values()) {
      const ouvert = b.id === id;
      b.c.toit.visible = !ouvert;
      for (const m of b.c.murs) m.opacity = ouvert ? 0.16 : 1;
    }
  }

  viser(x: number, y: number): string | null {
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2((x / this.l) * 2 - 1, -(y / this.h) * 2 + 1), this.camera);
    const touche = r.intersectObjects([...this.batiments.values()].map((b) => b.groupe), true)[0];
    return (touche?.object.userData.batiment as string | undefined) ?? null;
  }

  projeter(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.l, y: ((1 - p.y) / 2) * this.h };
  }

  animer(t: number): void {
    this.eau?.animer(t, this.nuit);
    for (const b of this.batiments.values()) {
      if (b.id !== "centrale" || this.centraleAllumee) b.c.voyants.forEach((v, i) => (v.emissiveIntensity = 0.6 + 0.4 * Math.sin(t / 300 + i * 1.7)));
      for (const o of b.groupe.children) if (o.userData.bateau) o.position.y = -0.05 + Math.sin(t / 700) * 0.06;
    }
    if (!this.centraleAllumee) return;
    for (const s of this.batiments.get("centrale")?.c.fumees ?? []) {
      const k = (t / 4200 + s.userData.phase) % 1;
      s.position.y = s.userData.base + k * 2.6;
      s.position.x = s.userData.x + Math.sin(k * 5) * 0.3 + k * 0.7;
      s.scale.setScalar(0.5 + k * 1.4);
      (s.material as THREE.MeshStandardMaterial).opacity = 0.9 * (1 - k);
    }
  }

  rendre(): void {
    this.renderer.render(this.scene, this.camera);
  }

  liberer(): void {
    this.renderer.dispose();
  }
}

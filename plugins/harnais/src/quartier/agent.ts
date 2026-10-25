// Un agent du quartier en 3D : Max est un galet lisse aux couleurs dégradées, grands yeux, pieds et mains ronds ; les
// visiteurs (Claude) sont des étoiles arrondies. Ils marchent par les routes (chemin donné point par point), se tournent
// en douceur, se dandinent, respirent au repos, et dorment avec des « Z » qui montent.
import * as THREE from "three";
import type { Habitant } from "@hameau/commun";

export type Geste = "attend" | "lit" | "ecrit" | "trie" | "travaille" | "regarde" | "dort";

const lisse = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });

/** Galet : sphère déformée, plus claire en haut (couleurs par sommet). */
function corpsGalet(c1: string, c2: string): THREE.Mesh {
  const g = new THREE.SphereGeometry(0.62, 40, 28);
  const p = g.attributes.position!;
  const couleurs: number[] = [];
  const haut = new THREE.Color(c1);
  const bas = new THREE.Color(c2);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = 1 + Math.sin(p.getX(i) * 3.1 + y * 2.3) * 0.03;
    p.setXYZ(i, p.getX(i) * 1.05 * k, y * (y < 0 ? 0.78 : 0.92) * k, p.getZ(i) * 0.94 * k);
    const t = THREE.MathUtils.clamp((y + 0.6) / 1.2, 0, 1);
    const c = bas.clone().lerp(haut, t);
    couleurs.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(couleurs, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: c2, emissiveIntensity: 0.22 }));
}

function corpsEtoile(c: string): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.3 : 0.66;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.34, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4, curveSegments: 1 });
  g.translate(0, 0, -0.17);
  return new THREE.Mesh(g, lisse(c, { emissive: c, emissiveIntensity: 0.2 }));
}

export class Agent {
  readonly groupe = new THREE.Group();
  private readonly corps = new THREE.Group();
  private readonly pieds: THREE.Mesh[] = [];
  private readonly mains: THREE.Mesh[] = [];
  private readonly objet = new THREE.Group();
  private readonly zzz: THREE.Sprite[] = [];
  geste: Geste = "attend";
  texte = "";
  private trajet: { pts: THREE.Vector3[]; longueurs: number[]; total: number; debut: number; vitesse: number; fini: () => void } | null = null;
  private cap = 0;

  constructor(
    readonly qui: Habitant,
    position: THREE.Vector3,
  ) {
    const fonce = new THREE.Color(qui.couleurs[1]).multiplyScalar(0.72).getStyle();
    if (qui.forme === "etoile") {
      const e = corpsEtoile(qui.couleurs[1]);
      e.position.y = 0.95;
      this.corps.add(e);
      this.yeux(0.98, 0.3, 0.15, 0.1);
    } else {
      const g = corpsGalet(qui.couleurs[0], qui.couleurs[1]);
      g.position.y = 0.78;
      this.corps.add(g);
      this.yeux(0.86, 0.5, 0.19, 0.13);
      for (const x of [-0.36, 0.36]) {
        const joue = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), lisse("#ff8f86", { transparent: true, opacity: 0.75 }));
        joue.scale.set(1, 0.6, 0.35);
        joue.position.set(x, 0.7, 0.5);
        this.corps.add(joue);
      }
    }
    for (const x of [-0.2, 0.2]) {
      const pied = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.1, 6, 12), lisse(fonce));
      pied.rotation.x = Math.PI / 2;
      pied.position.set(x, 0.12, 0.03);
      this.pieds.push(pied);
      this.groupe.add(pied);
    }
    for (const x of [-0.66, 0.66]) {
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), lisse(fonce));
      main.position.set(x, 0.68, 0.06);
      this.mains.push(main);
      this.corps.add(main);
    }
    this.objet.position.set(0, 0.7, 0.62);
    this.corps.add(this.objet);
    this.groupe.add(this.corps);
    this.groupe.position.copy(position);
    this.groupe.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      o.userData.agent = qui.id;
    });
    // les « Z » du sommeil
    const toile = document.createElement("canvas");
    toile.width = toile.height = 64;
    const ctx = toile.getContext("2d")!;
    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("z", 32, 34);
    const tex = new THREE.CanvasTexture(toile);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false;
      s.userData.phase = i / 3;
      this.zzz.push(s);
      this.groupe.add(s);
    }
  }

  private yeux(y: number, z: number, ecart: number, r: number): void {
    for (const x of [-ecart, ecart]) {
      const blanc = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), lisse("#ffffff", { roughness: 0.3 }));
      blanc.scale.set(1, 1.15, 0.55);
      blanc.position.set(x, y, z);
      const pupille = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 14, 10), lisse("#24130c", { roughness: 0.2 }));
      pupille.position.set(x, y - r * 0.05, z + r * 0.38);
      pupille.scale.z = 0.5;
      const reflet = new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
      reflet.position.set(x + r * 0.2, y + r * 0.22, z + r * 0.62);
      this.corps.add(blanc, pupille, reflet);
    }
  }

  private tenir(g: Geste): void {
    this.objet.clear();
    const m = (geo: THREE.BufferGeometry, c: string, e?: string) => {
      const x = new THREE.Mesh(geo, lisse(c, e ? { emissive: e, emissiveIntensity: 0.8 } : {}));
      x.castShadow = true;
      this.objet.add(x);
      return x;
    };
    if (g === "lit") m(new THREE.BoxGeometry(0.42, 0.3, 0.05), "#6fa8ff").rotation.x = -0.5;
    if (g === "ecrit") m(new THREE.BoxGeometry(0.4, 0.28, 0.04), "#2a3140", "#7fb7ff").rotation.x = -0.6;
    if (g === "trie") m(new THREE.BoxGeometry(0.34, 0.22, 0.03), "#fff3d6");
    if (g === "travaille") m(new THREE.BoxGeometry(0.1, 0.4, 0.1), "#f2c14e").rotation.z = 0.6;
  }

  /** Suit un chemin (points du monde) à `vitesse` unités par seconde ; la promesse se résout à l'arrivée. */
  suivre(pts: THREE.Vector3[], vitesse: number, maintenant: number): Promise<void> {
    return new Promise((fini) => {
      const tous = [this.groupe.position.clone(), ...pts];
      const longueurs = tous.slice(1).map((p, i) => p.distanceTo(tous[i]!));
      this.trajet = { pts: tous, longueurs, total: longueurs.reduce((a, b) => a + b, 0), debut: maintenant, vitesse, fini };
      this.faire("attend");
    });
  }

  faire(g: Geste, texte = ""): void {
    this.geste = g;
    this.texte = texte;
    this.tenir(g);
    for (const z of this.zzz) z.visible = g === "dort";
  }

  get marche(): boolean {
    return this.trajet !== null;
  }

  animer(t: number, dt: number): void {
    const s = t / 1000;
    let vitesseMarche = 0;
    if (this.trajet) {
      const tr = this.trajet;
      let d = ((t - tr.debut) / 1000) * tr.vitesse;
      if (d >= tr.total) {
        this.groupe.position.copy(tr.pts[tr.pts.length - 1]!);
        this.trajet = null;
        tr.fini();
      } else {
        let i = 0;
        while (d > tr.longueurs[i]! && i < tr.longueurs.length - 1) d -= tr.longueurs[i++]!;
        const a = tr.pts[i]!;
        const b = tr.pts[i + 1]!;
        this.groupe.position.lerpVectors(a, b, tr.longueurs[i]! > 0 ? d / tr.longueurs[i]! : 1);
        // il se tourne en douceur vers où il va
        const voulu = Math.atan2(b.x - a.x, b.z - a.z);
        let ecart = voulu - this.cap;
        ecart = Math.atan2(Math.sin(ecart), Math.cos(ecart));
        this.cap += ecart * Math.min(1, dt * 8);
        vitesseMarche = 1;
      }
    } else if (this.geste !== "dort") {
      let ecart = 0 - this.cap;
      ecart = Math.atan2(Math.sin(ecart), Math.cos(ecart));
      this.cap += ecart * Math.min(1, dt * 3);
    }
    this.groupe.rotation.y = this.cap;
    const pas = Math.sin(s * 11) * vitesseMarche;
    // pieds qui avancent et se lèvent, dandinement, rebond
    this.pieds[0]!.position.z = 0.03 + pas * 0.16;
    this.pieds[1]!.position.z = 0.03 - pas * 0.16;
    this.pieds[0]!.position.y = 0.12 + Math.max(0, pas) * 0.08;
    this.pieds[1]!.position.y = 0.12 + Math.max(0, -pas) * 0.08;
    this.corps.rotation.set(0, 0, pas * 0.1);
    this.corps.position.set(0, vitesseMarche ? Math.abs(Math.sin(s * 11)) * 0.06 : 0, 0);
    this.corps.scale.set(1, vitesseMarche ? 1 : 1 + Math.sin(s * 2.2) * 0.02, 1);
    const [mg, md] = this.mains as [THREE.Mesh, THREE.Mesh];
    mg.position.set(-0.66, 0.68, 0.06 - pas * 0.12);
    md.position.set(0.66, 0.68, 0.06 + pas * 0.12);
    this.objet.visible = !vitesseMarche;
    switch (this.geste) {
      case "lit":
        mg.position.set(-0.3, 0.72, 0.6);
        md.position.set(0.3, 0.72, 0.6);
        this.corps.rotation.x = 0.1 + Math.sin(s * 1.3) * 0.03;
        break;
      case "ecrit":
        mg.position.set(-0.28, 0.7, 0.62);
        md.position.set(0.15 + Math.sin(s * 14) * 0.08, 0.72, 0.64);
        break;
      case "trie":
        md.position.set(0.4 + Math.sin(s * 8) * 0.2, 0.75, 0.55);
        this.objet.position.x = Math.sin(s * 8) * 0.2;
        break;
      case "travaille":
        md.position.set(0.45, 0.7 + Math.abs(Math.sin(s * 6)) * 0.25, 0.5);
        break;
      case "regarde":
        this.corps.rotation.y = Math.sin(s * 1.1) * 0.5;
        break;
      case "dort":
        this.corps.rotation.set(0, 0, 1.25);
        this.corps.position.set(-0.4, -0.38 + Math.sin(s * 1.5) * 0.03, 0);
        this.zzz.forEach((z) => {
          const k = (s * 0.35 + z.userData.phase) % 1;
          z.position.set(0.3 + k * 0.5, 0.9 + k * 1.2, 0);
          z.scale.setScalar(0.18 + k * 0.25);
          (z.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
        });
        break;
    }
  }

  tete(): THREE.Vector3 {
    return this.groupe.position.clone().add(new THREE.Vector3(0, this.geste === "dort" ? 1 : 1.7, 0));
  }
}

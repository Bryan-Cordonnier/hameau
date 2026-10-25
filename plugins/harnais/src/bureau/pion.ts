// Les agents du bureau : de petits pions colorés (une couleur par agent) avec des accessoires selon le rôle — costard et
// cravate pour le boss (Max), casque audio pour un développeur, oreillette au secrétariat, tablier d'atelier. Ils marchent
// le long d'un chemin, se tournent en douceur, et font des gestes : taper au clavier, lire, porter un dossier, sortir
// leur téléphone, boire un café, dormir.
import * as THREE from "three";

export type Accessoire = "costard" | "casque" | "oreillette" | "tablier";
export type Geste = "attend" | "tape" | "lit" | "porte" | "telephone" | "cafe" | "dort" | "teste";

const mat = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });

export interface Silhouette {
  groupe: THREE.Group;
  corps: THREE.Group;
  mainG: THREE.Object3D;
  mainD: THREE.Object3D;
  tete: THREE.Object3D;
}

/** Un agent qui se déplace et agit ; la silhouette (pion ou mascotte) est fabriquée à part. */
export class Agent {
  readonly groupe: THREE.Group;
  geste: Geste = "attend";
  texte = "";
  private readonly s: Silhouette;
  private readonly objet = new THREE.Group();
  private readonly zzz: THREE.Sprite[] = [];
  private trajet: { pts: THREE.Vector3[]; l: number[]; total: number; debut: number; v: number; fini: () => void } | null = null;
  private cap = 0;
  capRepos = 0;
  // les gestes sont réglés pour le pion ; une autre silhouette (la mascotte) garde l'écart de ses mains
  private readonly decalG: THREE.Vector3;
  private readonly decalD: THREE.Vector3;

  constructor(
    readonly id: string,
    readonly nom: string,
    silhouette: Silhouette,
    position: THREE.Vector3,
  ) {
    this.s = silhouette;
    this.decalG = silhouette.mainG.position.clone().sub(new THREE.Vector3(-0.17, 0.42, 0));
    this.decalD = silhouette.mainD.position.clone().sub(new THREE.Vector3(0.17, 0.42, 0));
    this.groupe = silhouette.groupe;
    this.groupe.position.copy(position);
    this.s.mainD.add(this.objet);
    this.groupe.traverse((o) => {
      o.userData.agent = id;
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    const toile = document.createElement("canvas");
    toile.width = toile.height = 64;
    const ctx = toile.getContext("2d")!;
    ctx.font = "bold 46px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText("z", 32, 46);
    const tex = new THREE.CanvasTexture(toile);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.visible = false;
      sp.userData.phase = i / 3;
      this.zzz.push(sp);
      this.groupe.add(sp);
    }
  }

  private tenir(g: Geste): void {
    this.objet.clear();
    const m = (geo: THREE.BufferGeometry, c: string, o: THREE.MeshStandardMaterialParameters = {}) => {
      const x = new THREE.Mesh(geo, mat(c, o));
      x.castShadow = true;
      this.objet.add(x);
      return x;
    };
    if (g === "lit") m(new THREE.BoxGeometry(0.22, 0.03, 0.16), "#6fa8ff").position.set(0, 0, 0.08);
    if (g === "porte") m(new THREE.BoxGeometry(0.24, 0.05, 0.18), "#f2c14e").position.set(0, 0.02, 0.08);
    if (g === "telephone") m(new THREE.BoxGeometry(0.07, 0.13, 0.015), "#1d2330", { emissive: "#7fb7ff", emissiveIntensity: 0.9 }).position.set(0, 0.05, 0.05);
    if (g === "cafe") m(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 12), "#ffffff").position.set(0, 0.04, 0.04);
    if (g === "teste") m(new THREE.BoxGeometry(0.04, 0.2, 0.04), "#f2c14e").position.set(0, 0.06, 0.06);
  }

  /** Suit un chemin (points au sol) à `vitesse` unités par seconde. */
  suivre(pts: THREE.Vector3[], vitesse: number, maintenant: number): Promise<void> {
    return new Promise((fini) => {
      const tous = [this.groupe.position.clone(), ...pts];
      const l = tous.slice(1).map((p, i) => p.distanceTo(tous[i]!));
      this.trajet = { pts: tous, l, total: l.reduce((a, b) => a + b, 0), debut: maintenant, v: vitesse, fini };
      this.faire("attend");
    });
  }

  faire(g: Geste, texte = "", cap?: number): void {
    this.geste = g;
    this.texte = texte;
    if (cap !== undefined) this.capRepos = cap;
    this.tenir(g);
    for (const z of this.zzz) z.visible = g === "dort";
  }

  get marche(): boolean {
    return this.trajet !== null;
  }

  animer(t: number, dt: number): void {
    const s = t / 1000;
    let marche = 0;
    if (this.trajet) {
      const tr = this.trajet;
      let d = ((t - tr.debut) / 1000) * tr.v;
      if (d >= tr.total) {
        this.groupe.position.copy(tr.pts[tr.pts.length - 1]!);
        this.trajet = null;
        tr.fini();
      } else {
        let i = 0;
        while (d > tr.l[i]! && i < tr.l.length - 1) d -= tr.l[i++]!;
        const a = tr.pts[i]!;
        const b = tr.pts[i + 1]!;
        this.groupe.position.lerpVectors(a, b, tr.l[i]! > 0 ? d / tr.l[i]! : 1);
        this.tourner(Math.atan2(b.x - a.x, b.z - a.z), dt * 10);
        marche = 1;
      }
    } else this.tourner(this.capRepos, dt * 5);
    this.groupe.rotation.y = this.cap;
    const { corps, mainG, mainD } = this.s;
    const pas = Math.sin(s * 12) * marche;
    corps.position.set(0, marche ? Math.abs(Math.sin(s * 12)) * 0.035 : Math.sin(s * 2) * 0.006, 0);
    corps.rotation.set(0, 0, pas * 0.08);
    mainG.position.set(-0.17, 0.42, pas * 0.06);
    mainD.position.set(0.17, 0.42, -pas * 0.06);
    this.objet.visible = !marche;
    if (!marche) this.geste_(s);
    mainG.position.add(this.decalG);
    mainD.position.add(this.decalD);
  }

  private geste_(s: number): void {
    const { corps, mainG, mainD } = this.s;
    switch (this.geste) {
      case "tape":
        mainG.position.set(-0.08, 0.46 + Math.max(0, Math.sin(s * 22)) * 0.03, 0.14);
        mainD.position.set(0.08, 0.46 + Math.max(0, -Math.sin(s * 22)) * 0.03, 0.14);
        break;
      case "lit":
      case "porte":
        mainG.position.set(-0.08, 0.5, 0.14);
        mainD.position.set(0.08, 0.5, 0.14);
        corps.rotation.x = 0.06;
        break;
      case "telephone":
        mainD.position.set(0.06, 0.62, 0.12);
        corps.rotation.x = 0.1;
        break;
      case "cafe":
        mainD.position.set(0.12, 0.5 + Math.max(0, Math.sin(s * 0.9)) * 0.14, 0.1);
        break;
      case "teste":
        mainD.position.set(0.1, 0.5 + Math.abs(Math.sin(s * 5)) * 0.06, 0.16);
        break;
      case "dort":
        corps.rotation.set(-1.3, 0, 0);
        corps.position.set(0, 0.16, -0.18);
        this.zzz.forEach((z) => {
          const k = (s * 0.35 + z.userData.phase) % 1;
          z.position.set(0.15 + k * 0.25, 0.55 + k * 0.6, -0.2);
          z.scale.setScalar(0.1 + k * 0.14);
          (z.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
        });
        break;
    }
  }

  private tourner(voulu: number, k: number): void {
    let e = voulu - this.cap;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    this.cap += e * Math.min(1, k);
  }

  tete(): THREE.Vector3 {
    return this.groupe.position.clone().add(new THREE.Vector3(0, 1.15, 0));
  }
}

/** Un pion : socle, corps arrondi, tête, petits yeux ; couleur de l'agent ; accessoires selon le rôle. */
export function pion(couleur: string, accessoires: Accessoire[] = []): Silhouette {
  const groupe = new THREE.Group();
  const corps = new THREE.Group();
  const c = new THREE.Color(couleur);
  const fonce = c.clone().multiplyScalar(0.7).getStyle();
  const peau = mat(couleur);
  // socle de pion
  const socle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.06, 28), mat(fonce));
  socle.position.y = 0.03;
  groupe.add(socle);
  // corps : un tronc de cône arrondi
  const profil = [new THREE.Vector2(0, 0.06), new THREE.Vector2(0.16, 0.06), new THREE.Vector2(0.15, 0.2), new THREE.Vector2(0.12, 0.42), new THREE.Vector2(0.1, 0.52), new THREE.Vector2(0, 0.56)];
  const tronc = new THREE.Mesh(new THREE.LatheGeometry(profil, 28), accessoires.includes("costard") ? mat("#3b3348") : peau);
  corps.add(tronc);
  const tete = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 20), peau);
  tete.position.y = 0.7;
  corps.add(tete);
  for (const x of [-0.055, 0.055]) {
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), mat("#ffffff", { roughness: 0.2 }));
    oeil.position.set(x, 0.72, 0.13);
    const pupille = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), mat("#1a1024"));
    pupille.position.set(x, 0.715, 0.15);
    corps.add(oeil, pupille);
  }
  const mainG = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), accessoires.includes("costard") ? mat(couleur) : mat(fonce));
  const mainD = mainG.clone();
  mainG.position.set(-0.17, 0.42, 0);
  mainD.position.set(0.17, 0.42, 0);
  corps.add(mainG, mainD);
  for (const a of accessoires) {
    if (a === "costard") {
      // chemise blanche, revers, cravate dorée : le boss
      const plastron = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 3), mat("#ffffff"));
      plastron.rotation.x = Math.PI;
      plastron.position.set(0, 0.44, 0.1);
      plastron.scale.z = 0.4;
      const cravate = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.02), mat("#ffd36e", { roughness: 0.3 }));
      cravate.position.set(0, 0.4, 0.125);
      cravate.rotation.x = -0.25;
      const noeud = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mat("#ffd36e"));
      noeud.position.set(0, 0.49, 0.1);
      corps.add(plastron, cravate, noeud);
    }
    if (a === "casque") {
      const arceau = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 24, Math.PI), mat("#2b2f3a"));
      arceau.position.y = 0.72;
      corps.add(arceau);
      for (const x of [-0.16, 0.16]) {
        const ecouteur = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), mat("#2b2f3a"));
        ecouteur.rotation.z = Math.PI / 2;
        ecouteur.position.set(x, 0.71, 0);
        corps.add(ecouteur);
      }
    }
    if (a === "oreillette") {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat("#2b2f3a"));
      o.position.set(0.15, 0.71, 0.02);
      const micro = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), mat("#2b2f3a"));
      micro.rotation.x = Math.PI / 2.4;
      micro.position.set(0.13, 0.66, 0.08);
      corps.add(o, micro);
    }
    if (a === "tablier") {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.02), mat("#3d4f6b"));
      t.position.set(0, 0.28, 0.14);
      t.rotation.x = -0.12;
      corps.add(t);
    }
  }
  groupe.add(corps);
  groupe.scale.setScalar(1.5);
  return { groupe, corps, mainG, mainD, tete };
}

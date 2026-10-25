// Les personnages de l'île en 3D low poly : Max est son galet du logo avec de petites pattes et de petits bras ; Claude et
// les visiteurs sont des étoiles sur pattes. Animations calculées à la volée (marche, rebond, écriture, tri, tablette,
// sommeil), sans squelette.
import * as THREE from "three";
import type { Habitant } from "@hameau/commun";
import type { Geste } from "./actions";

const mat = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, ...o });

export type Etat = "attend" | "marche" | Geste | "dort";

export class Personnage {
  readonly groupe = new THREE.Group();
  private readonly corps = new THREE.Group();
  private readonly jambes: THREE.Mesh[] = [];
  private readonly bras: THREE.Mesh[] = [];
  private readonly objet = new THREE.Group();
  etat: Etat = "attend";
  texte = "";
  private trajet: { de: THREE.Vector3; vers: THREE.Vector3; debut: number; duree: number; fini: () => void } | null = null;

  constructor(
    readonly qui: Habitant,
    position: THREE.Vector3,
  ) {
    const peau = mat(qui.couleurs[1]);
    const brun = mat("#7a3d2a");
    if (qui.forme === "etoile") {
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.24 : 0.55;
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
      }
      const etoile = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 }), peau);
      etoile.position.set(0, 0.85, -0.11);
      this.corps.add(etoile);
      this.yeux(0.85, 0.2, 0.13);
    } else {
      // le galet : une sphère à facettes, aplatie et un peu cabossée
      const g = new THREE.IcosahedronGeometry(0.5, 1);
      const p = g.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        const k = 1 + Math.sin(i * 7.3) * 0.04;
        p.setXYZ(i, p.getX(i) * 1.05 * k, p.getY(i) * 0.86 * k, p.getZ(i) * 0.9 * k);
      }
      g.computeVertexNormals();
      const galet = new THREE.Mesh(g, mat(qui.couleurs[1]));
      galet.position.y = 0.78;
      this.corps.add(galet);
      this.yeux(0.82, 0.42, 0.16);
      for (const x of [-0.3, 0.3]) {
        const joue = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), mat("#ff8f86"));
        joue.position.set(x, 0.7, 0.4);
        joue.scale.z = 0.4;
        this.corps.add(joue);
      }
    }
    for (const x of [-0.17, 0.17]) {
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.4, 5), brun);
      j.geometry.translate(0, -0.2, 0);
      j.position.set(x, 0.42, 0);
      this.jambes.push(j);
      this.groupe.add(j);
    }
    for (const x of [-0.5, 0.5]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 5), brun);
      b.geometry.translate(0, -0.16, 0);
      b.position.set(x, 0.85, 0.05);
      b.rotation.z = x < 0 ? -0.5 : 0.5;
      this.bras.push(b);
      this.corps.add(b);
    }
    this.objet.position.set(0, 0.75, 0.55);
    this.corps.add(this.objet);
    this.groupe.add(this.corps);
    this.groupe.position.copy(position);
    this.groupe.scale.setScalar(1.45);
    this.groupe.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  private yeux(y: number, z: number, ecart: number): void {
    for (const x of [-ecart, ecart]) {
      const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), mat("#3b1d10", { roughness: 0.3 }));
      oeil.position.set(x, y, z);
      this.corps.add(oeil);
      const reflet = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), mat("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.6 }));
      reflet.position.set(x + 0.02, y + 0.025, z + 0.055);
      this.corps.add(reflet);
    }
  }

  /** L'objet qu'il tient pendant un geste : un papier, une lettre, une tablette… */
  private tenir(geste: Etat): void {
    this.objet.clear();
    const ajouter = (geo: THREE.BufferGeometry, c: string, emissif = false) => {
      const m = new THREE.Mesh(geo, mat(c, emissif ? { emissive: "#8fd0ff", emissiveIntensity: 0.6 } : {}));
      m.castShadow = true;
      this.objet.add(m);
      return m;
    };
    if (geste === "ecrit" || geste === "lit") ajouter(new THREE.BoxGeometry(0.34, 0.42, 0.03), "#fffdf6").rotation.x = -0.5;
    if (geste === "trie") ajouter(new THREE.BoxGeometry(0.36, 0.24, 0.03), "#fff3d6");
    if (geste === "tablette") ajouter(new THREE.BoxGeometry(0.42, 0.3, 0.04), "#2b3440", true).rotation.x = -0.4;
    if (geste === "travaille") ajouter(new THREE.BoxGeometry(0.08, 0.36, 0.08), "#8a6a3e").rotation.z = 0.6;
  }

  /** Marche jusqu'à un point en `duree` ms, puis appelle `fini`. */
  aller(vers: THREE.Vector3, duree: number, maintenant: number): Promise<void> {
    return new Promise((fini) => {
      this.trajet = { de: this.groupe.position.clone(), vers: vers.clone(), debut: maintenant, duree, fini };
      this.etat = "marche";
      this.tenir("marche");
      const d = vers.clone().sub(this.groupe.position);
      if (d.lengthSq() > 0.001) this.groupe.rotation.y = Math.atan2(d.x, d.z);
    });
  }

  faire(geste: Etat, texte = ""): void {
    this.etat = geste;
    this.texte = texte;
    this.tenir(geste);
    if (geste !== "marche") this.groupe.rotation.y = geste === "dort" ? 0.6 : 0;
  }

  get bouge(): boolean {
    return this.trajet !== null || this.etat !== "attend";
  }

  /** Avance l'animation au temps `t` (ms). */
  animer(t: number): void {
    if (this.trajet) {
      const k = Math.min(1, (t - this.trajet.debut) / this.trajet.duree);
      const lisse = k * k * (3 - 2 * k);
      this.groupe.position.lerpVectors(this.trajet.de, this.trajet.vers, lisse);
      if (k >= 1) {
        const f = this.trajet.fini;
        this.trajet = null;
        this.etat = "attend";
        f();
      }
    }
    const s = t / 1000;
    const marche = this.trajet !== null;
    const pas = marche ? Math.sin(s * 14) : 0;
    this.jambes[0]!.rotation.x = pas * 0.7;
    this.jambes[1]!.rotation.x = -pas * 0.7;
    this.corps.position.y = marche ? Math.abs(Math.sin(s * 14)) * 0.08 : Math.sin(s * 2.2) * 0.02;
    this.corps.rotation.z = 0;
    this.corps.rotation.x = 0;
    this.corps.position.x = 0;
    const [bg, bd] = this.bras as [THREE.Mesh, THREE.Mesh];
    bg.rotation.x = bd.rotation.x = marche ? -pas * 0.6 : 0;
    switch (this.etat) {
      case "ecrit":
        bd.rotation.x = -1.2 + Math.sin(s * 18) * 0.25;
        break;
      case "lit":
        bg.rotation.x = bd.rotation.x = -1.1;
        this.corps.rotation.x = 0.08 + Math.sin(s * 1.5) * 0.04;
        break;
      case "trie":
        bd.rotation.x = -1 + Math.sin(s * 9) * 0.6;
        this.objet.position.x = Math.sin(s * 9) * 0.25;
        break;
      case "tablette":
        bg.rotation.x = bd.rotation.x = -1.25;
        break;
      case "travaille":
        bd.rotation.x = -1.4 + Math.abs(Math.sin(s * 7)) * 1.2;
        break;
      case "regarde":
        this.corps.rotation.z = Math.sin(s * 1.4) * 0.12;
        break;
      case "dort":
        this.corps.rotation.z = 1.35;
        this.corps.position.x = -0.35;
        this.corps.position.y = -0.48 + Math.sin(s * 1.6) * 0.03;
        this.jambes[0]!.rotation.x = this.jambes[1]!.rotation.x = 1.5;
        break;
    }
  }

  /** Où afficher sa bulle (au-dessus de la tête). */
  tete(): THREE.Vector3 {
    return this.groupe.position.clone().add(new THREE.Vector3(0, this.etat === "dort" ? 0.8 : 1.6, 0));
  }
}

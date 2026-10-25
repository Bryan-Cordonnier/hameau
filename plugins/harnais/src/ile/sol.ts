// Le sol de l'île : un maillage low poly à triangles irréguliers, sculpté par la hauteur (plateau, pente, plage, fond),
// coloré face par face (herbes de plusieurs verts, sable sec et mouillé, quelques roches dans les pentes).
import * as THREE from "three";
import { bruit2, CASE, fbm, hauteur, type Place } from "./grille";

const PAS = 0.62;

const C = {
  herbe1: new THREE.Color("#9fd27a"),
  herbe2: new THREE.Color("#86c46a"),
  herbe3: new THREE.Color("#b4dc86"),
  terre: new THREE.Color("#c9ab7d"),
  roche: new THREE.Color("#b3a28c"),
  sable: new THREE.Color("#f3e2b3"),
  mouille: new THREE.Color("#d9c18c"),
  fond: new THREE.Color("#c7b48a"),
};

/** Les limites du terrain à mailler (les places, plus une bonne marge d'eau). */
export function limites(places: Place[]): { x0: number; x1: number; z0: number; z1: number } {
  const xs = places.flatMap((p) => [p.x - (p.cases[0] * CASE) / 2, p.x + (p.cases[0] * CASE) / 2]);
  const zs = places.flatMap((p) => [p.z - (p.cases[1] * CASE) / 2, p.z + (p.cases[1] * CASE) / 2]);
  const m = CASE * 3;
  return { x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m };
}

export function solDeLIle(places: Place[]): THREE.Mesh {
  const { x0, x1, z0, z1 } = limites(places);
  const nx = Math.ceil((x1 - x0) / PAS);
  const nz = Math.ceil((z1 - z0) / PAS);
  // sommets décalés au hasard (triangles irréguliers), hauteurs calculées une fois
  const sommets: THREE.Vector3[][] = [];
  for (let i = 0; i <= nx; i++) {
    const ligne: THREE.Vector3[] = [];
    for (let j = 0; j <= nz; j++) {
      const bord = i === 0 || j === 0 || i === nx || j === nz;
      const x = x0 + i * PAS + (bord ? 0 : (bruit2(i * 3.7, j * 1.3) - 0.5) * PAS * 0.7);
      const z = z0 + j * PAS + (bord ? 0 : (bruit2(i * 1.9 + 7, j * 4.1) - 0.5) * PAS * 0.7);
      const y = hauteur(places, x, z) + (bruit2(i * 5.3, j * 5.9) - 0.5) * 0.05;
      ligne.push(new THREE.Vector3(x, y, z));
    }
    sommets.push(ligne);
  }
  const pos: number[] = [];
  const col: number[] = [];
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const y = (a.y + b.y + c.y) / 3;
    if (y < -1.4) return;
    const pente = Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y);
    const cx = (a.x + b.x + c.x) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    let couleur: THREE.Color;
    if (y < -0.2) couleur = C.fond;
    else if (y < 0.02) couleur = C.mouille;
    else if (y < 0.2) couleur = C.sable;
    else if (pente > 0.28) couleur = C.roche;
    else if (pente > 0.18) couleur = C.terre;
    else {
      const t = fbm(cx * 0.18, cz * 0.18);
      couleur = t < 0.42 ? C.herbe2 : t > 0.62 ? C.herbe3 : C.herbe1;
    }
    const k = 0.94 + bruit2(cx * 7, cz * 7) * 0.1;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let n = 0; n < 3; n++) col.push(couleur.r * k, couleur.g * k, couleur.b * k);
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = sommets[i]![j]!;
      const b = sommets[i + 1]![j]!;
      const c = sommets[i + 1]![j + 1]!;
      const d = sommets[i]![j + 1]!;
      // diagonale alternée : pas de motif régulier visible
      if ((i + j) % 2) {
        face(a, d, b);
        face(b, d, c);
      } else {
        face(a, d, c);
        face(a, c, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  m.receiveShadow = true;
  return m;
}

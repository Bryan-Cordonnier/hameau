// La mascotte de Claude Code en petits cubes : une créature orange en pixels, deux yeux noirs, des pinces de chaque côté
// et quatre petites pattes. (Marque d'Anthropic : d'accord pour l'appli perso de Bryan ; à remplacer par un pion orange
// si Hameau est un jour distribué.)
import * as THREE from "three";
import type { Silhouette } from "./pion";

export function mascotteClaude(): Silhouette {
  const groupe = new THREE.Group();
  const corps = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: "#d97757", roughness: 0.55 });
  const noir = new THREE.MeshStandardMaterial({ color: "#1b1410", roughness: 0.4 });
  const p = 0.07; // taille d'un pixel
  const cube = (x: number, y: number, z: number, m = orange, l = 1, h = 1, e = 1) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(p * l, p * h, p * e), m);
    b.position.set(x * p, y * p, z * p);
    return b;
  };
  // le corps : un bloc de 8 × 5 pixels, 4 d'épaisseur
  corps.add(cube(0, 6.5, 0, orange, 8, 5, 4));
  // les yeux, sur la face avant
  corps.add(cube(-1.5, 7.5, 2.05, noir, 1, 2, 0.2), cube(1.5, 7.5, 2.05, noir, 1, 2, 0.2));
  // quatre pattes
  for (const x of [-3, -1, 1, 3]) groupe.add(cube(x, 2.5, 0, orange, 1, 3, 1.5));
  const mainG = cube(-5, 6.5, 0, orange, 2, 1.5, 2);
  const mainD = cube(5, 6.5, 0, orange, 2, 1.5, 2);
  corps.add(mainG, mainD);
  groupe.add(corps);
  groupe.scale.setScalar(1.4);
  return { groupe, corps, mainG, mainD, tete: corps };
}

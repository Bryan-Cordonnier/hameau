// L'eau autour de l'île : vagues facettées animées, dégradé lagon → bleu profond, écume qui respire sur le rivage,
// lignes de houle qui avancent vers la côte et petits reflets du soleil. La distance au rivage est cuite dans une texture.
import * as THREE from "three";

const RESOLUTION = 160;

const sommets = /* glsl */ `
uniform float temps;
varying vec3 vMonde;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 m = modelMatrix * vec4(position, 1.0);
  m.y += sin(m.x * 0.8 + temps * 1.2) * 0.05 + sin(m.z * 1.1 - temps) * 0.045 + sin((m.x - m.z) * 2.3 + temps * 2.2) * 0.02;
  vMonde = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`;

const fragments = /* glsl */ `
uniform float temps;
uniform sampler2D rivage;
uniform vec3 lagon;
uniform vec3 peu;
uniform vec3 profond;
uniform vec3 ecume;
uniform vec3 soleil;
uniform float nuit;
varying vec3 vMonde;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(cross(dFdx(vMonde), dFdy(vMonde)));
  if (n.y < 0.0) n = -n;
  float d = texture2D(rivage, vUv).r * 24.0;
  vec3 c = mix(lagon, peu, smoothstep(0.0, 2.5, d));
  c = mix(c, profond, smoothstep(2.5, 16.0, d));
  // écume au bord, qui avance et recule
  float va = sin(temps * 0.9) * 0.18;
  float bord = smoothstep(0.45 + va, 0.0, d);
  // lignes de houle parallèles à la côte, qui avancent vers elle
  float houle = sin(d * 3.2 + temps * 1.6);
  float lignes = smoothstep(0.82, 0.98, houle) * smoothstep(5.0, 0.6, d) * (0.55 + 0.45 * sin(vMonde.x * 0.6 + vMonde.z * 0.4));
  c = mix(c, ecume, clamp(bord * 0.95 + lignes * 0.55, 0.0, 1.0));
  // petits reflets du soleil qui scintillent au large
  vec2 cellule = floor(vMonde.xz * 5.0);
  vec2 dans = fract(vMonde.xz * 5.0) - 0.5;
  float paillette = step(0.992, h(cellule + floor(temps * 2.0))) * step(length(dans), 0.22) * smoothstep(1.5, 4.0, d);
  float lumiere = 0.78 + 0.32 * max(dot(n, normalize(soleil)), 0.0);
  c = c * lumiere + paillette * 0.5 * (1.0 - nuit);
  c *= mix(1.0, 0.42, nuit);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Eau {
  readonly mesh: THREE.Mesh;
  private readonly matiere: THREE.ShaderMaterial;

  /** `distance` : distance signée au rivage ; l'eau couvre un carré de `taille` autour de `centre`. */
  constructor(distance: (x: number, z: number) => number, centre: THREE.Vector2, taille: number) {
    const g = new THREE.PlaneGeometry(taille, taille, 140, 140);
    g.rotateX(-Math.PI / 2);
    this.matiere = new THREE.ShaderMaterial({
      vertexShader: sommets,
      fragmentShader: fragments,
      uniforms: {
        temps: { value: 0 },
        rivage: { value: Eau.texture(distance, centre, taille) },
        lagon: { value: new THREE.Color("#8ff0e0") },
        peu: { value: new THREE.Color("#4fd0e0") },
        profond: { value: new THREE.Color("#3a9fd8") },
        ecume: { value: new THREE.Color("#ffffff") },
        soleil: { value: new THREE.Vector3(-12, 20, 14) },
        nuit: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(g, this.matiere);
    this.mesh.position.set(centre.x, -0.08, centre.y);
  }

  private static texture(distance: (x: number, z: number) => number, centre: THREE.Vector2, taille: number): THREE.DataTexture {
    const data = new Uint8Array(RESOLUTION * RESOLUTION * 4);
    for (let j = 0; j < RESOLUTION; j++) {
      for (let i = 0; i < RESOLUTION; i++) {
        const x = centre.x + (i / (RESOLUTION - 1) - 0.5) * taille;
        const z = centre.y + (0.5 - j / (RESOLUTION - 1)) * taille;
        const d = Math.max(0, distance(x, z)) / 24;
        const k = (j * RESOLUTION + i) * 4;
        data[k] = Math.min(255, Math.round(d * 255));
        data[k + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(data, RESOLUTION, RESOLUTION);
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  animer(t: number, nuit: number): void {
    this.matiere.uniforms.temps!.value = t / 1000;
    this.matiere.uniforms.nuit!.value = nuit;
  }
}

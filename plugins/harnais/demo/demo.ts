// Démo de l'île sans le cerveau : décor, chantier et personnages, pour voir le rendu (pas livré dans l'appli).
// Glisser pour se déplacer, molette pour zoomer, survoler un bâtiment pour voir dedans. ?nuit pour la nuit, ?zoom=2.
import { habitant } from "../../../packages/commun/src/habitants";
import { Monde } from "../src/ile/monde";
import { Personnage } from "../src/ile/personnages";

const params = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const monde = new Monde(canvas);
const taille = () => {
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  monde.redimensionner(innerWidth, innerHeight);
};
addEventListener("resize", taille);
taille();
monde.majChantiers([{ id: 1, titre: "Étude chaudronnerie", avancement: 50 }]);
monde.majHeure(new Date(2026, 9, 25, params.has("nuit") ? 23 : 15, 0), true);
monde.majCentrale(true);
monde.majPanneau(["#e86a4f", "#3f9d6a", "#5d7fc4", "#3f9d6a", "#e86a4f"]);
if (params.has("zoom")) monde.zoomer(Number(params.get("zoom")));
if (params.has("x")) monde.deplacer(Number(params.get("x")), Number(params.get("y") ?? 0));
if (params.has("ouvert")) monde.transparence(params.get("ouvert"));

const max = new Personnage(habitant("max")!, monde.porte("poste"));
max.faire("trie", "trie 12 mails");
const claude = new Personnage(habitant("claude-code-pc")!, monde.porte("atelier"));
claude.faire("ecrit", "code Hameau");
monde.scene.add(max.groupe, claude.groupe);

let glisse: { x: number; y: number } | null = null;
canvas.addEventListener("pointerdown", (e) => (glisse = { x: e.clientX, y: e.clientY }));
addEventListener("pointerup", () => (glisse = null));
canvas.addEventListener("pointermove", (e) => {
  if (glisse) {
    monde.deplacer(e.clientX - glisse.x, e.clientY - glisse.y);
    glisse = { x: e.clientX, y: e.clientY };
  } else monde.transparence(monde.viser(e.clientX, e.clientY));
});
canvas.addEventListener("wheel", (e) => (e.preventDefault(), monde.zoomer(Math.exp(-e.deltaY * 0.0015))), { passive: false });

const labels = document.getElementById("labels")!;
function etiquettes(): void {
  labels.innerHTML = "";
  for (const b of monde.batiments.values()) {
    const p = monde.projeter(b.groupe.position.clone().setY(b.groupe.position.y + b.c.hauteur + 0.4));
    labels.insertAdjacentHTML("beforeend", `<div class="etiq" style="left:${p.x}px;top:${p.y}px">${b.emoji} ${b.nom}</div>`);
  }
  for (const p of [max, claude]) {
    const q = monde.projeter(p.tete().setY(p.tete().y + 0.6));
    labels.insertAdjacentHTML("beforeend", `<div class="bulle" style="left:${q.x}px;top:${q.y}px">${p.qui.nom} ${p.texte}</div>`);
  }
}
function boucle(t: number): void {
  max.animer(t);
  claude.animer(t);
  monde.animer(t);
  monde.rendre();
  etiquettes();
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);

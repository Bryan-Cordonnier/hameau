// Vérification du bureau vivant avec un faux journal (sans moteur ni cerveau).
import type { Evenement } from "@hameau/commun";
import { Vivant } from "../src/bureau/vivant";

const v = new Vivant(document.getElementById("c") as HTMLCanvasElement);
v.suivi("max");
const faux: [string, string, string, string][] = [
  ["max", "mail.read", "mail/1", "lit un mail"],
  ["claude-code-pc", "library.write", "projets/hameau", "écrit la fiche Hameau"],
  ["max", "library.read", "projets/max", ""],
  ["claude-code-pc", "project.update", "chantier/2", "avance le chantier"],
  ["max", "task.create", "tache/9", "crée une tâche"],
];
let id = 0;
setInterval(() => {
  const [agent, action, cible, resume] = faux[id % faux.length]!;
  id++;
  v.jouer([{ id, quand: Date.now() / 1000, agent, action, cible, resume, resultat: "ok" } as Evenement]);
}, 2500);
(window as unknown as { v: Vivant }).v = v;

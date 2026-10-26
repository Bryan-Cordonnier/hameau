// Démo de l'accueil avec le faux moteur : un faux journal fait bouger Max et Claude.
import { mount } from "svelte";
import App from "../apps/ile/App.svelte";
import { pousser } from "./faux-sdk";

mount(App, { target: document.getElementById("app")! });
const faux: [string, string, string, string][] = [
  ["max", "mail.read", "mail/1", "lit un mail de l'agence"],
  ["claude-code-pc", "library.write", "projets/agl", "écrit la fiche AGL"],
  ["max", "library.read", "projets/max", "relit tes notes"],
  ["claude-code-pc", "project.update", "chantier/2", "avance le chantier"],
  ["max", "task.create", "tache/9", "crée une tâche"],
  ["claude-code-pc", "hameau.write", "x", "met à jour le tableau"],
];
let i = 0;
setInterval(() => pousser(...faux[i++ % faux.length]!), 2600);

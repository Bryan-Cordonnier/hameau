<script lang="ts">
  // Accueil de Hameau : le bureau des IA, vu de haut. Les agents rejouent ce que le journal du cerveau note (lire un mail,
  // écrire une fiche, avancer un chantier…). Survoler montre les noms, cliquer une zone ouvre sa fiche.
  import { connect } from "@etabli/sdk";
  import { cerveau, ilYa, type EtatServeur, type Evenement, type Rapport, type Tache } from "@hameau/commun";
  import type { Piece } from "../../src/bureau/bureau";
  import { Vivant, type Survol } from "../../src/bureau/vivant";

  let toile: HTMLCanvasElement;
  let vivant = $state.raw<Vivant | null>(null);
  let survol = $state<Survol | null>(null);
  let choisie = $state<Piece | null>(null);
  let taches = $state<Tache[]>([]);
  let courrier = $state<Rapport[]>([]);
  let serveur = $state<EtatServeur | null>(null);
  let erreur = $state("");
  let dernier = 0;
  // ce qui s'est passé depuis la dernière visite, à rejouer en accéléré si Bryan le veut
  let absence = $state<Evenement[]>([]);
  const CLE = "hameau-derniere-action";
  const lireVu = () => {
    try {
      return Number(localStorage.getItem(CLE)) || 0;
    } catch {
      return 0;
    }
  };
  const noterVu = (id: number) => {
    try {
      localStorage.setItem(CLE, String(id));
    } catch {
      /* stockage indisponible : on rejouera simplement moins */
    }
  };

  const enCours = $derived(taches.filter((t) => t.actif && t.en_cours));
  const questions = $derived(courrier.reduce((n, r) => n + r.questions.filter((q) => q.r === null).length, 0));

  async function etat(): Promise<void> {
    try {
      [taches, courrier, serveur] = await Promise.all([cerveau.taches(), cerveau.rapports(), cerveau.serveur()]);
      if (vivant) vivant.modeleAllume = serveur.en_ligne;
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function journal(): Promise<void> {
    try {
      // au démarrage, les dix dernières actions (et ce qui a eu lieu depuis ta dernière visite) ; ensuite, les nouvelles
      const premier = dernier === 0;
      const evs = await cerveau.evenements(dernier || -10);
      if (evs.length) dernier = Math.max(dernier, ...evs.map((e) => e.id));
      if (premier) {
        const vu = lireVu();
        if (vu && dernier > vu + 10) absence = await cerveau.evenements(vu, 200);
      }
      if (dernier) noterVu(dernier);
      vivant?.jouer(evs);
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  $effect(() => {
    const v = new Vivant(toile);
    vivant = v;
    v.suivi("max");
    v.onSurvol = (s) => (survol = s);
    v.onChoix = (p) => (choisie = p);
    let arret = () => {};
    void connect().then((e) => {
      v.theme(document.documentElement.style.colorScheme === "light" ? "clair" : "sombre");
      arret = e.onThemeChange((_t, s) => v.theme(s === "light" ? "clair" : "sombre"));
    });
    void etat().then(journal);
    const t1 = setInterval(() => void journal(), 3000);
    const t2 = setInterval(() => void etat(), 15000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      arret();
      v.detruire();
    };
  });

  const presents = $derived(choisie && vivant ? vivant.presents(choisie.id) : []);
</script>

<div class="accueil">
  <canvas bind:this={toile}></canvas>

  <div class="etat">
    <span title="Tâches en cours">📌 {enCours.length}</span>
    <span title="Questions sans réponse dans le courrier">📮 {questions}</span>
    <span title="Serveur du modèle">{serveur?.en_ligne ? "⚡ Modèle en ligne" : "💤 Modèle coupé"}</span>
  </div>
  <div class="outils">
    <button title="Zoomer" onclick={() => vivant?.zoomer(0.75)}>＋</button>
    <button title="Dézoomer" onclick={() => vivant?.zoomer(1.33)}>－</button>
    <button title="Recentrer" onclick={() => vivant?.recentrer()}>◎</button>
  </div>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}
  {#if absence.length}
    <div class="absence">
      <span>Pendant ton absence : <b>{absence.length} actions</b> depuis {ilYa(absence[0]!.quand)}</span>
      <button onclick={() => (vivant?.jouer(absence), (absence = []))}>▶ Rejouer</button>
      <button onclick={() => (absence = [])}>Ignorer</button>
    </div>
  {/if}

  {#if survol}
    <div class="tag" class:agent={survol.agent} style="left:{survol.x}px;top:{survol.y}px">{survol.texte}</div>
  {/if}

  {#if choisie}
    <aside class="fiche">
      <h3>{choisie.emoji} {choisie.nom}</h3>
      {#if choisie.id === "taches"}
        {#each enCours as t (t.id)}<p>{t.titre}<small> — {t.poste}</small></p>{:else}<p><small>Rien en cours.</small></p>{/each}
      {:else if choisie.id === "secretariat"}
        <p>{courrier.length} rapport(s) à classer, {questions} question(s) sans réponse.</p>
      {:else if choisie.id === "serveur"}
        <p>{serveur?.en_ligne ? `En ligne${serveur.modele?.fichier ? ` — ${serveur.modele.fichier}` : ""}` : "Hors ligne : Max dort."}</p>
      {/if}
      <p class="presents">Présents : <b>{presents.join(", ") || "personne"}</b></p>
      <button onclick={() => vivant?.choisir(null)}>Fermer</button>
    </aside>
  {/if}
</div>

<style>
  .accueil { position: relative; height: max(560px, 100vh); overflow: hidden; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
  .etat, .outils, .fiche { position: absolute; background: var(--surface, rgba(30, 30, 34, 0.85)); border: 1px solid var(--border, rgba(255, 255, 255, 0.08)); border-radius: 12px; backdrop-filter: blur(12px); }
  .etat { top: 12px; left: 12px; display: flex; gap: 12px; padding: 7px 12px; font-weight: 600; }
  .outils { top: 12px; right: 12px; display: grid; padding: 4px; }
  .outils button { width: 30px; height: 30px; border: 0; background: none; color: inherit; cursor: pointer; border-radius: 8px; }
  .fiche { top: 12px; right: 58px; width: 280px; padding: 12px 14px; }
  .fiche h3 { margin: 0 0 8px; }
  .fiche p { margin: 4px 0; }
  .fiche small, .presents { opacity: 0.75; }
  .tag { position: absolute; transform: translate(-50%, -100%); pointer-events: none; padding: 3px 9px; border-radius: 999px; background: var(--surface, #1e1e22); border: 1px solid var(--border, rgba(255, 255, 255, 0.1)); font-size: 12px; font-weight: 700; white-space: nowrap; }
  .tag.agent { background: var(--accent, #c98bff); color: #fff; border-color: transparent; }
  .absence { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface, rgba(30, 30, 34, 0.9)); border: 1px solid var(--border, rgba(255, 255, 255, 0.08)); border-radius: 12px; }
  .absence button { border: 1px solid var(--border, rgba(255, 255, 255, 0.12)); background: none; color: inherit; border-radius: 8px; padding: 5px 10px; cursor: pointer; font: inherit; }
  .erreur { position: absolute; bottom: 12px; left: 12px; color: #e25c4a; margin: 0; }
</style>

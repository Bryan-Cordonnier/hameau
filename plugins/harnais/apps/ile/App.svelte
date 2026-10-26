<script lang="ts">
  // Accueil d'AGL : le bureau fixe où l'on voit les agents travailler. Ils rejouent ce que note le journal du cerveau
  // (lire un mail, écrire une fiche, avancer un chantier…). Au survol d'un agent : sa carte avec des raccourcis.
  import { connect } from "@etabli/sdk";
  import { cerveau, ilYa, nomDe, type ChantierResume, type EtatServeur, type Evenement, type Rapport, type Tache } from "@hameau/commun";
  import Bureau from "../../src/bureau2d/Bureau.svelte";
  import { EMOJI, Troupe, type Acteur } from "../../src/bureau2d/troupe.svelte";

  const troupe = new Troupe();
  troupe.acteur("max");
  let taches = $state<Tache[]>([]);
  let courrier = $state<Rapport[]>([]);
  let chantiers = $state<ChantierResume[]>([]);
  let serveur = $state<EtatServeur | null>(null);
  let erreur = $state("");
  let carte = $state<{ a: Acteur; x: number; y: number } | null>(null);
  let message = $state("");
  let envoye = $state("");
  let dernier = 0;
  let premier = true;
  let absence = $state<Evenement[]>([]);
  let etabli: Awaited<ReturnType<typeof connect>> | null = null;
  let fermeture = 0;

  const enCours = $derived(taches.filter((t) => t.statut === "en_cours"));
  const bloquees = $derived(taches.filter((t) => t.statut === "bloque"));
  const questions = $derived(courrier.reduce((n, r) => n + r.questions.filter((q) => q.r === null).length, 0));
  const tacheDe = (id: string) => taches.find((t) => t.poste === id && t.statut === "en_cours") ?? null;

  const CLE = "agl-derniere-action";
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

  async function etat(): Promise<void> {
    try {
      [taches, courrier, serveur, chantiers] = await Promise.all([cerveau.taches(), cerveau.rapports(), cerveau.serveur(), cerveau.chantiers()]);
      troupe.modeleAllume = serveur.en_ligne;
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function journal(): Promise<void> {
    try {
      const evs = await cerveau.evenements(premier ? -10 : dernier);
      if (evs.length) dernier = Math.max(dernier, ...evs.map((e) => e.id));
      if (premier) {
        premier = false;
        const vu = lireVu();
        if (vu && dernier > vu + 10) absence = await cerveau.evenements(vu, 200);
      }
      if (dernier) noterVu(dernier);
      troupe.jouer(evs);
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  $effect(() => {
    void connect().then((e) => (etabli = e));
    void etat().then(journal);
    const t1 = setInterval(() => void journal(), 3000);
    const t2 = setInterval(() => void etat(), 15000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      troupe.detruire();
    };
  });

  function survol(a: Acteur | null, ecran: { x: number; y: number } | null): void {
    clearTimeout(fermeture);
    if (a && ecran) {
      if (carte?.a !== a) (message = ""), (envoye = "");
      carte = { a, x: ecran.x, y: ecran.y };
    }
  }
  const fermerBientot = () => (fermeture = window.setTimeout(() => (carte = null), 350));

  /** Écrire à un agent : le message va dans son fil « Petit mot » (un chantier de discussion). */
  async function ecrire(): Promise<void> {
    const texte = message.trim();
    if (!texte || !carte) return;
    try {
      const titre = "Petit mot";
      let c = (await cerveau.chantiers()).find((x) => x.titre === titre);
      if (!c) {
        await cerveau.creerChantier(titre, "Questions rapides à Max.");
        c = (await cerveau.chantiers()).find((x) => x.titre === titre);
      }
      if (c) await cerveau.ecrireChantier(c.id, texte);
      message = "";
      envoye = "Envoyé ✔";
    } catch (e) {
      envoye = (e as Error).message;
    }
  }
</script>

<div class="accueil">
  <div class="scene" role="presentation" onmouseleave={fermerBientot}>
    <Bureau {troupe} onSurvol={survol} />
  </div>

  <aside class="etat">
    <div class="ligne"><span>⚙️ En cours</span><b>{enCours.length}</b></div>
    <div class="ligne" class:alerte={bloquees.length}><span>⛔ Bloquées</span><b>{bloquees.length}</b></div>
    <div class="ligne"><span>📮 Questions</span><b>{questions}</b></div>
    <div class="ligne"><span>🏗️ Chantiers</span><b>{chantiers.filter((c) => c.actif && c.titre !== "Petit mot").length}</b></div>
    <div class="ligne"><span>{serveur?.en_ligne ? "⚡ Modèle" : "💤 Modèle"}</span><b>{serveur?.en_ligne ? "en ligne" : "coupé"}</b></div>
  </aside>

  {#if erreur}<p class="erreur">{erreur}</p>{/if}

  {#if absence.length}
    <div class="absence">
      <span>Pendant ton absence : <b>{absence.length} actions</b> depuis {ilYa(absence[0]!.quand)}</span>
      <button onclick={() => (troupe.jouer(absence), (absence = []))}>▶ Rejouer</button>
      <button onclick={() => (absence = [])}>Ignorer</button>
    </div>
  {/if}

  {#if carte}
    {@const t = tacheDe(carte.a.id)}
    <div class="carte" style="left:{carte.x}px; top:{carte.y}px; --c:{carte.a.couleur}" role="dialog" tabindex="-1" aria-label={carte.a.nom}
      onmouseenter={() => clearTimeout(fermeture)} onmouseleave={fermerBientot}>
      <header><span class="pastille"></span><b>{carte.a.nom}</b><small>{carte.a.marche ? "en route" : carte.a.texte || "disponible"} {EMOJI[carte.a.geste]}</small></header>
      {#if t}
        <p class="tache">📌 {t.titre}{#if t.avancement !== null}<span class="barre"><i style="width:{t.avancement}%"></i></span>{/if}</p>
      {:else}
        <p class="tache vide">Pas de tâche en cours.</p>
      {/if}
      <div class="raccourcis">
        <button onclick={() => etabli?.send("agent", { id: carte!.a.id })}>👤 Profil</button>
        <button onclick={() => etabli?.send("taches", { agent: carte!.a.id })}>📋 Tâches</button>
      </div>
      <form class="ecrire" onsubmit={(e) => (e.preventDefault(), void ecrire())}>
        <input bind:value={message} placeholder="💬 Écrire à {nomDe(carte.a.id)}…" />
      </form>
      {#if envoye}<small class="envoye">{envoye}</small>{/if}
    </div>
  {/if}
</div>

<style>
  .accueil { position: relative; height: max(560px, 100vh); overflow: hidden; background: var(--page); }
  .scene { position: absolute; inset: 0 210px 0 0; display: grid; place-items: center; padding: 24px; }
  .etat { position: absolute; top: 16px; right: 16px; width: 180px; display: grid; gap: 2px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; font-size: 13px; }
  .ligne { display: flex; justify-content: space-between; padding: 4px 0; color: var(--muted); }
  .ligne b { color: var(--text); font-variant-numeric: tabular-nums; font-family: ui-monospace, Consolas, monospace; }
  .ligne.alerte b { color: #d9534f; }
  .absence { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  button, input { font: inherit; color: var(--text); }
  button { border: 1px solid var(--border); background: var(--surface-2); border-radius: 7px; padding: 5px 10px; cursor: pointer; }
  button:hover { background: var(--field); }
  .carte { position: fixed; transform: translate(-50%, calc(-100% - 8px)); width: 250px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-top: 3px solid var(--c); border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); display: grid; gap: 8px; z-index: 5; }
  .carte header { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; }
  .carte header small { grid-column: 2; color: var(--muted); }
  .pastille { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .tache { margin: 0; font-size: 13px; display: grid; gap: 5px; }
  .tache.vide { color: var(--muted); }
  .barre { height: 4px; background: var(--border); border-radius: 4px; overflow: hidden; }
  .barre i { display: block; height: 100%; background: var(--c); }
  .raccourcis { display: flex; gap: 6px; }
  .ecrire input { width: 100%; box-sizing: border-box; padding: 6px 9px; border: 1px solid var(--border); border-radius: 7px; background: var(--field); }
  .envoye { color: var(--muted); }
  .erreur { position: absolute; bottom: 16px; left: 16px; margin: 0; color: #d9534f; }
</style>

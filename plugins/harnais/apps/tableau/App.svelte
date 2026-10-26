<script lang="ts">
  // Les tâches d'AGL : une ligne par groupe ou projet (en arbre), une colonne par statut. Les cartes montrent l'agent,
  // l'avancement, l'échéance et les blocages ; une tâche se découpe en sous-tâches. À droite, la fiche de la carte choisie.
  import { connect } from "@etabli/sdk";
  import { cerveau, habitant, nomDe, type Agent, type ChantierResume, type Groupe, type Tache } from "@hameau/commun";
  import { COLONNES, echeance, lignes, type Carte } from "../../src/tableau";

  let taches = $state<Tache[]>([]);
  let groupes = $state<Groupe[]>([]);
  let chantiers = $state<ChantierResume[]>([]);
  let agents = $state<Agent[]>([]);
  let erreur = $state("");
  let choisie = $state<{ genre: Carte["genre"]; id: number } | null>(null);
  let ouverts = $state<Record<number, boolean>>({});
  let formulaire = $state<"tache" | "groupe" | null>(null);

  // nouvelle tâche
  let fTitre = $state("");
  let fConsigne = $state("");
  let fAgent = $state("max");
  let fGroupe = $state(0);
  let fParent = $state(0);
  let fEcheance = $state("");
  let fNotifier = $state<"non" | "quotidien" | "max">("quotidien");
  let fRapport = $state(true);
  // nouveau groupe
  let gNom = $state("");
  let gEmoji = $state("");
  let gParent = $state(0);
  let gAgent = $state("");

  // ouverte depuis l'accueil (« 📋 Tâches » sur un agent) : seulement ses tâches, jusqu'à ce qu'on enlève le filtre
  let filtreAgent = $state("");
  void connect().then((e) => {
    if (e.incoming?.kind === "taches") filtreAgent = (e.incoming.data as { agent?: string }).agent ?? "";
  });
  const tableau = $derived(lignes(groupes, filtreAgent ? taches.filter((t) => t.poste === filtreAgent) : taches, filtreAgent ? chantiers.filter((c) => c.agent === filtreAgent) : chantiers));
  const vraisAgents = $derived(agents.filter((a) => a.actif && habitant(a.nom)));
  const tache = $derived(choisie?.genre === "tache" ? (taches.find((t) => t.id === choisie!.id) ?? null) : null);
  const chantier = $derived(choisie?.genre === "chantier" ? (chantiers.find((c) => c.id === choisie!.id) ?? null) : null);
  const imposeNouvelle = $derived(imposeDe(fGroupe));

  function imposeDe(groupe: number): string {
    let g = groupes.find((x) => x.id === groupe);
    for (let i = 0; g && i < 20; i++) {
      if (g.agent_seul) return g.agent_seul;
      g = groupes.find((x) => x.id === g!.parent);
    }
    return "";
  }

  async function charger(): Promise<void> {
    try {
      [taches, groupes, chantiers, agents] = await Promise.all([cerveau.taches(), cerveau.groupes(), cerveau.chantiers(), cerveau.agents()]);
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  $effect(() => {
    const t = setInterval(() => void charger(), 20000);
    return () => clearInterval(t);
  });

  async function agir(f: () => Promise<unknown>): Promise<void> {
    try {
      await f();
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  function nouvelleTache(groupe = 0, parent = 0): void {
    fGroupe = groupe;
    fParent = parent;
    fAgent = imposeDe(groupe) || "max";
    formulaire = "tache";
  }

  async function creerTache(): Promise<void> {
    if (!fTitre.trim()) return;
    await agir(() =>
      cerveau.creerTache({
        post: imposeNouvelle || fAgent,
        title: fTitre.trim(),
        instructions: fConsigne.trim() || fTitre.trim(),
        ...(fGroupe ? { group: fGroupe } : {}),
        ...(fParent ? { parent: fParent } : {}),
        ...(fEcheance ? { due: fEcheance } : {}),
        notify: fNotifier,
        report_in_app: fRapport,
      }),
    );
    if (!erreur) (formulaire = null), (fTitre = fConsigne = fEcheance = "");
  }

  async function creerGroupe(): Promise<void> {
    if (!gNom.trim()) return;
    await agir(() => cerveau.creerGroupe({ name: gNom.trim(), emoji: gEmoji.trim(), ...(gParent ? { parent: gParent } : {}), ...(gAgent ? { only_agent: gAgent } : {}) }));
    if (!erreur) (formulaire = null), (gNom = gEmoji = gAgent = ""), (gParent = 0);
  }

  const couleur = (agent: string) => habitant(agent)?.couleurs[1] ?? "var(--muted)";
  const dateSaisie = (ts: number | null) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : "");
</script>

<div class="page" class:avec-fiche={choisie}>
  <header>
    <h1>📋 Tâches</h1>
    <div class="actions">
      {#if filtreAgent}<button onclick={() => (filtreAgent = "")}>✕ Seulement {nomDe(filtreAgent)}</button>{/if}
      <button onclick={() => (formulaire = "groupe")}>➕ Groupe</button>
      <button class="principal" onclick={() => nouvelleTache()}>➕ Tâche</button>
    </div>
  </header>
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

  <div class="grille">
    <div class="entete"></div>
    {#each COLONNES as c}<div class="entete">{c.emoji} {c.nom}</div>{/each}

    {#each tableau as l (l.groupe?.id ?? "sans")}
      <div class="ligne" style="padding-left:{12 + l.profondeur * 18}px">
        <b>{l.groupe?.emoji || (l.profondeur ? "↳" : "📁")} {l.groupe?.nom ?? "Sans groupe"}</b>
        {#if l.agentImpose}<small>🔒 uniquement {nomDe(l.agentImpose)}</small>{/if}
        {#if l.groupe}<button class="mini" title="Nouvelle tâche dans ce groupe" onclick={() => nouvelleTache(l.groupe!.id)}>➕</button>{/if}
      </div>
      {#each COLONNES as c}
        <div class="case">
          {#each l.cases[c.id] as k (k.genre + k.id)}
            {@const e = echeance(k.echeance)}
            <button class="carte" class:bloquee={k.statut === "bloque"} class:choisie={choisie?.id === k.id && choisie.genre === k.genre}
              onclick={() => (choisie = { genre: k.genre, id: k.id })}>
              <span class="titre">{k.genre === "chantier" ? "🏗️" : ""} {k.titre}</span>
              <span class="meta">
                <span class="agent" style="--c:{couleur(k.agent)}">{nomDe(k.agent)}</span>
                {#if e}<span class="date {e.urgence}">📅 {e.texte}</span>{/if}
                {#if k.rapport}<span title="Rapport dans AGL">📮</span>{/if}
              </span>
              {#if k.avancement !== null && k.statut !== "termine"}<span class="barre"><i style="width:{k.avancement}%"></i></span>{/if}
              {#if k.statut === "bloque" && k.blocage}<span class="blocage">⛔ {k.blocage}</span>{/if}
              {#if k.enfants.length}
                <span class="sous" role="presentation" onclick={(ev) => (ev.stopPropagation(), (ouverts[k.id] = !ouverts[k.id]))}>
                  {ouverts[k.id] ? "▾" : "▸"} {k.enfants.filter((x) => x.statut === "termine").length}/{k.enfants.length} sous-tâches
                </span>
                {#if ouverts[k.id]}
                  {#each k.enfants as s (s.id)}
                    <span class="enfant" class:fait={s.statut === "termine"} role="presentation" onclick={(ev) => (ev.stopPropagation(), (choisie = { genre: "tache", id: s.id }))}>
                      {COLONNES.find((x) => x.id === s.statut)?.emoji} {s.titre}
                    </span>
                  {/each}
                {/if}
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    {:else}
      <p class="vide">Aucune tâche. Commence par un groupe (« Quotidien de Bryan », « Retux »…), puis ajoute des tâches dedans.</p>
    {/each}
  </div>

  {#if tache}
    <aside class="fiche">
      <button class="fermer" onclick={() => (choisie = null)} aria-label="Fermer">✕</button>
      <h2>{tache.titre}</h2>
      <p class="consigne">{tache.consigne}</p>
      <label>Statut
        <select value={tache.statut} onchange={(e) => agir(() => cerveau.modifierTache(tache.id, { status: e.currentTarget.value }))}>
          {#each COLONNES as c}<option value={c.id}>{c.emoji} {c.nom}</option>{/each}
        </select></label>
      {#if tache.statut === "bloque"}
        <label>Pourquoi c'est bloqué
          <input value={tache.blocage} onchange={(e) => agir(() => cerveau.modifierTache(tache.id, { blocked_reason: e.currentTarget.value }))} /></label>
      {/if}
      <label>Agent
        <select value={tache.poste} onchange={(e) => agir(() => cerveau.modifierTache(tache.id, { preferred: e.currentTarget.value }))}>
          {#each vraisAgents as a}<option value={a.nom}>{nomDe(a.nom)}</option>{/each}
        </select></label>
      <label>Échéance
        <input type="date" value={dateSaisie(tache.echeance)} onchange={(e) => agir(() => cerveau.modifierTache(tache.id, { due: e.currentTarget.value }))} /></label>
      <label>Avancement {tache.avancement ?? 0} %
        <input type="range" min="0" max="100" step="5" value={tache.avancement ?? 0} onchange={(e) => agir(() => cerveau.modifierTache(tache.id, { progress: Number(e.currentTarget.value) }))} /></label>
      <label>Me prévenir à la fin
        <select value={tache.notifier} onchange={(e) => agir(() => cerveau.modifierTache(tache.id, { notify: e.currentTarget.value }))}>
          <option value="non">Non</option><option value="quotidien">Par Quotidien</option><option value="max">Par Max</option>
        </select></label>
      <label class="coche"><input type="checkbox" checked={tache.rapport_agl} onchange={(e) => agir(() => cerveau.modifierTache(tache.id, { report_in_app: e.currentTarget.checked }))} /> Rapport dans AGL</label>
      <button onclick={() => nouvelleTache(tache.groupe ?? 0, tache.id)}>➕ Sous-tâche</button>
      {#if tache.rapport}
        <h3>📮 Rapport</h3>
        <p class="rapport">{tache.rapport}</p>
      {/if}
    </aside>
  {:else if chantier}
    <aside class="fiche">
      <button class="fermer" onclick={() => (choisie = null)} aria-label="Fermer">✕</button>
      <h2>🏗️ {chantier.titre}</h2>
      <p class="consigne">Chantier de {nomDe(chantier.agent)} · {chantier.messages} message(s) dans sa discussion.</p>
      <label>Statut
        <select value={chantier.statut} onchange={(e) => agir(() => cerveau.modifierChantier(chantier.id, { status: e.currentTarget.value }))}>
          {#each COLONNES as c}<option value={c.id}>{c.emoji} {c.nom}</option>{/each}
        </select></label>
      <label>Groupe
        <select value={chantier.groupe ?? 0} onchange={(e) => agir(() => cerveau.modifierChantier(chantier.id, { group: Number(e.currentTarget.value) }))}>
          <option value={0}>Sans groupe</option>
          {#each groupes as g}<option value={g.id}>{g.emoji} {g.nom}</option>{/each}
        </select></label>
      <label>Échéance
        <input type="date" value={dateSaisie(chantier.echeance)} onchange={(e) => agir(() => cerveau.modifierChantier(chantier.id, { due: e.currentTarget.value }))} /></label>
      <p class="petit">Le document et la discussion sont dans 🏗️ Chantiers.</p>
    </aside>
  {/if}

  {#if formulaire}
    <div class="voile" role="presentation" onclick={() => (formulaire = null)}></div>
    <form class="dialogue" onsubmit={(e) => (e.preventDefault(), formulaire === "tache" ? creerTache() : creerGroupe())}>
      {#if formulaire === "tache"}
        <h2>➕ {fParent ? "Sous-tâche" : "Nouvelle tâche"}</h2>
        <label>Titre<input bind:value={fTitre} required placeholder="Trouver des entreprises chez qui postuler" /></label>
        <label>Consigne pour l'agent<textarea bind:value={fConsigne} rows="4" placeholder="Ce qu'il doit faire, précisément (sinon le titre suffit)"></textarea></label>
        <label>Groupe
          <select bind:value={fGroupe}>
            <option value={0}>Sans groupe</option>
            {#each groupes as g}<option value={g.id}>{g.emoji} {g.nom}</option>{/each}
          </select></label>
        <label>Agent
          {#if imposeNouvelle}<input value="🔒 {nomDe(imposeNouvelle)} (imposé par le groupe)" disabled />
          {:else}<select bind:value={fAgent}>{#each vraisAgents as a}<option value={a.nom}>{nomDe(a.nom)}</option>{/each}</select>{/if}</label>
        <label>Échéance<input type="date" bind:value={fEcheance} /></label>
        <label>Me prévenir à la fin
          <select bind:value={fNotifier}><option value="non">Non</option><option value="quotidien">Par Quotidien</option><option value="max">Par Max</option></select></label>
        <label class="coche"><input type="checkbox" bind:checked={fRapport} /> Rapport dans AGL (je pourrai y répondre)</label>
      {:else}
        <h2>➕ Nouveau groupe</h2>
        <label>Nom<input bind:value={gNom} required placeholder="Retux" /></label>
        <label>Émoji<input bind:value={gEmoji} maxlength="4" placeholder="🏭" /></label>
        <label>Dans le groupe
          <select bind:value={gParent}><option value={0}>Aucun (ligne principale)</option>{#each groupes as g}<option value={g.id}>{g.emoji} {g.nom}</option>{/each}</select></label>
        <label>Réservé à
          <select bind:value={gAgent}><option value="">N'importe quel agent</option>{#each vraisAgents as a}<option value={a.nom}>Uniquement {nomDe(a.nom)}</option>{/each}</select></label>
      {/if}
      <div class="boutons"><button type="button" onclick={() => (formulaire = null)}>Annuler</button><button class="principal" type="submit">Créer</button></div>
    </form>
  {/if}
</div>

<style>
  .page { padding: 18px 20px; display: grid; gap: 12px; }
  .page.avec-fiche { padding-right: 340px; }
  header { display: flex; justify-content: space-between; align-items: center; }
  h1 { margin: 0; font-size: 20px; }
  .actions { display: flex; gap: 8px; }
  button, input, select, textarea { font: inherit; color: var(--text); }
  button { border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 6px 12px; cursor: pointer; }
  button:hover { background: var(--surface-2); }
  .principal { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  .principal:hover { background: var(--accent); opacity: 0.9; }
  input, select, textarea { width: 100%; box-sizing: border-box; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--field); }
  .grille { display: grid; grid-template-columns: minmax(170px, 220px) repeat(4, minmax(170px, 1fr)); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
  .grille > * { border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); }
  .entete { padding: 8px 12px; font-size: 12px; font-weight: 700; color: var(--muted); background: var(--surface-2); text-transform: uppercase; letter-spacing: 0.04em; }
  .ligne { padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
  .ligne small { color: var(--muted); font-size: 11.5px; }
  .mini { padding: 1px 7px; font-size: 11px; margin-top: 4px; }
  .case { padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 52px; }
  .carte { text-align: left; display: flex; flex-direction: column; gap: 5px; padding: 8px 10px; background: var(--surface-2); }
  .carte.choisie { outline: 2px solid var(--accent); }
  .carte.bloquee { border-color: #d9534f; box-shadow: inset 3px 0 0 #d9534f; }
  .titre { font-weight: 600; font-size: 13px; }
  .meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 11.5px; color: var(--muted); }
  .agent::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--c); margin-right: 4px; }
  .date.depassee { color: #d9534f; font-weight: 700; }
  .date.proche { color: #d9a441; font-weight: 700; }
  .barre { height: 4px; border-radius: 4px; background: var(--border); overflow: hidden; }
  .barre i { display: block; height: 100%; background: var(--accent); }
  .blocage { font-size: 11.5px; color: #d9534f; }
  .sous { font-size: 11.5px; color: var(--muted); cursor: pointer; }
  .enfant { font-size: 12px; padding-left: 10px; cursor: pointer; }
  .enfant.fait { opacity: 0.55; text-decoration: line-through; }
  .vide { grid-column: 1 / -1; padding: 24px; color: var(--muted); border: 0; }
  .fiche { position: fixed; top: 0; right: 0; bottom: 0; width: 320px; padding: 18px; background: var(--surface); border-left: 1px solid var(--border); overflow: auto; display: flex; flex-direction: column; gap: 10px; }
  .fiche h2 { margin: 0 24px 0 0; font-size: 17px; }
  .fiche label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
  .coche { display: flex !important; gap: 8px; align-items: center; }
  .coche input { width: auto; }
  .fermer { position: absolute; top: 12px; right: 12px; padding: 2px 8px; }
  .consigne, .rapport { margin: 0; white-space: pre-wrap; font-size: 13px; }
  .rapport { padding: 10px; background: var(--surface-2); border-radius: 8px; }
  .petit { font-size: 12px; color: var(--muted); margin: 0; }
  .erreur { color: #d9534f; margin: 0; }
  .voile { position: fixed; inset: 0; background: var(--scrim); }
  .dialogue { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(460px, 92vw); padding: 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; display: grid; gap: 10px; }
  .dialogue h2 { margin: 0; font-size: 17px; }
  .dialogue label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
  .boutons { display: flex; justify-content: flex-end; gap: 8px; }
</style>

<script lang="ts">
  // Les projets : des cartes horizontales empilées (glissées pour l'ordre de priorité) ; la fiche d'un projet montre sa road map
  // (liste horizontale centrée sur le prochain objectif), ses règles, ses agents, ses tableaux, sa branche du cerveau.
  // Mettre un projet en pause met en pause ses automatisations, ses cartes et ses agents dédiés.
  import { connect } from "@etabli/sdk";
  import { agl, nomAffiche, Recherche, type EtatAgl, type EtatProjet, type Objectif, type Projet } from "@hameau/commun";
  import { avancementProjet, deplacer, prochainObjectif } from "../../src/outils";

  let etat = $state<EtatAgl | null>(null);
  let erreur = $state("");
  let choisi = $state<number | null>(null);
  let nouveau = $state<{ name: string; emoji: string; goal: string; parent: number } | null>(null);

  async function charger(): Promise<void> {
    try {
      etat = await agl.etat();
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  void connect().then((e) => {
    if (e.incoming?.kind === "projet") choisi = Number((e.incoming.data as { id?: number }).id) || null;
  });
  async function agir(f: () => Promise<unknown>): Promise<void> {
    try {
      await f();
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  const ETATS: Record<EtatProjet, string> = { actif: "🟢 Actif", pause: "⏸️ En pause", termine: "✅ Terminé", abandonne: "🗄️ Abandonné" };
  const racines = $derived((etat?.projets ?? []).filter((p) => p.parent === null));
  const enfants = (id: number) => (etat?.projets ?? []).filter((p) => p.parent === id);
  const projet = $derived(etat?.projets.find((p) => p.id === choisi) ?? null);
  const prochain = (p: Projet): Objectif | null => p.objectifs[prochainObjectif(p.objectifs)] ?? null;

  // ordre de priorité : glisser une carte de projet
  let tire = $state<number | null>(null);
  async function deposer(cible: number): Promise<void> {
    if (tire === null || tire === cible || !etat) return;
    const ids = racines.map((p) => p.id);
    const ordre = deplacer(ids, tire, ids.indexOf(cible));
    tire = null;
    await agir(() => agl.ordonner("projets", ordre));
  }

  // ---- fiche ----
  let edition = $state<{ name: string; emoji: string; color: string; goal: string; rules: string; agents: string[] } | null>(null);
  $effect(() => {
    if (projet && edition === null) edition = { name: projet.nom, emoji: projet.emoji, color: projet.couleur, goal: projet.objectif, rules: projet.regles, agents: [...projet.agents] };
  });
  function fermer(): void {
    choisi = null;
    edition = null;
  }
  let road = $state<HTMLDivElement>();
  $effect(() => {
    if (projet && road) {
      const i = prochainObjectif(projet.objectifs);
      const el = road.children[i] as HTMLElement | undefined;
      el?.scrollIntoView({ inline: "center", block: "nearest" });
    }
  });
  let nouvelObjectif = $state({ title: "", date: "" });
  async function ouvrirTableau(id: number): Promise<void> {
    (await connect()).send("carte", { tableau: id });
  }
</script>

<Recherche ouvrir={(g, id) => g === "projet" && (choisi = Number(id))} />
<div class="agl">
  <div class="entete">
    <h1>Projets</h1>
    <span class="sous">Glisse les projets pour les classer : celui du haut est ta priorité.</span>
    <span class="espace"></span>
    <button class="principal" onclick={() => (nouveau = { name: "", emoji: "📁", goal: "", parent: 0 })}>+ Nouveau projet</button>
  </div>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}

  {#if nouveau}
    <div class="formulaire">
      <div class="ligne">
        <input class="emoji" bind:value={nouveau.emoji} maxlength="4" aria-label="Émoji" />
        <input bind:value={nouveau.name} placeholder="Nom du projet" />
      </div>
      <input bind:value={nouveau.goal} placeholder="L'objectif en une phrase" />
      <label class="champ">Sous-projet de
        <select bind:value={nouveau.parent}>
          <option value={0}>— aucun (projet principal) —</option>
          {#each etat?.projets ?? [] as p}<option value={p.id}>{p.emoji} {p.nom}</option>{/each}
        </select>
      </label>
      <p class="sous">Sa branche du cerveau et son tableau de tâches sont créés tout seuls.</p>
      <div class="ligne">
        <button class="principal" disabled={!nouveau.name.trim()} onclick={() => { const n = nouveau!; nouveau = null; void agir(() => agl.projet({ name: n.name, emoji: n.emoji, goal: n.goal, parent: n.parent || undefined })); }}>Créer</button>
        <button onclick={() => (nouveau = null)}>Annuler</button>
      </div>
    </div>
  {/if}

  {#if etat}
    <div class="pile">
      {#each racines as p (p.id)}
        {@const o = prochain(p)}
        {@const av = avancementProjet(p)}
        <div
          class="carte-h projet"
          class:eteint={!p.actif_effectif}
          style="--c:{p.couleur || 'var(--accent)'}"
          draggable="true"
          role="button"
          tabindex="0"
          ondragstart={() => (tire = p.id)}
          ondragover={(e) => e.preventDefault()}
          ondrop={() => deposer(p.id)}
          onclick={() => (choisi = p.id)}
          onkeydown={(e) => e.key === "Enter" && (choisi = p.id)}
        >
          <span class="gros">{p.emoji}</span>
          <div class="milieu">
            <div class="ligne"><b>{p.nom}</b><span class="pastille">{ETATS[p.etat]}</span></div>
            <div class="sous">{p.objectif || "Pas encore d'objectif"}</div>
            {#if enfants(p.id).length}
              <div class="ligne sousprojets">{#each enfants(p.id) as e}<span class="pastille">{e.emoji} {e.nom}{e.etat !== "actif" ? ` · ${ETATS[e.etat]}` : ""}</span>{/each}</div>
            {/if}
          </div>
          <div class="droite">
            {#if o}<div class="sous">🎯 {o.titre}{o.date ? ` · ${o.date}` : ""}</div>{/if}
            {#if av !== null}<div class="barre"><div style="width:{av}%"></div></div>{/if}
          </div>
        </div>
      {:else}
        <p class="vide">Aucun projet pour l'instant.</p>
      {/each}
    </div>
  {/if}

  {#if projet && edition}
    <div class="voile" role="presentation" onclick={fermer}></div>
    <aside class="panneau">
      <div class="ligne">
        <input class="emoji" bind:value={edition.emoji} maxlength="4" aria-label="Émoji" />
        <input class="titre" bind:value={edition.name} aria-label="Nom" />
        <input type="color" class="couleur" bind:value={edition.color} aria-label="Couleur" />
        <button onclick={fermer}>✕</button>
      </div>
      <div class="ligne">
        {#each Object.entries(ETATS) as [e, n]}
          <button class:principal={projet.etat === e} onclick={() => agir(() => agl.projet({ id: projet.id, state: e }))}>{n}</button>
        {/each}
      </div>
      {#if !projet.actif_effectif && projet.etat === "actif"}<p class="sous">Son projet parent est en pause : il l'est aussi.</p>{/if}
      <label class="champ">Objectif<input bind:value={edition.goal} /></label>

      <div>
        <div class="ligne"><b>Road map</b><span class="sous">les objectifs à atteindre</span></div>
        <div class="road" bind:this={road}>
          {#each projet.objectifs as o (o.id)}
            <div class="objectif" class:atteint={o.etat === "atteint"} class:abandonne={o.etat === "abandonne"} class:encours={o.etat === "en_cours"}>
              <input class="otitre" value={o.titre} onchange={(e) => agir(() => agl.objectif({ id: o.id, project: projet.id, title: e.currentTarget.value }))} />
              <input type="date" value={o.date} onchange={(e) => agir(() => agl.objectif({ id: o.id, project: projet.id, date: e.currentTarget.value }))} />
              <select value={o.etat} onchange={(e) => agir(() => agl.objectif({ id: o.id, project: projet.id, state: e.currentTarget.value }))}>
                <option value="a_venir">À venir</option><option value="en_cours">En cours</option><option value="atteint">Atteint</option><option value="abandonne">Abandonné</option>
              </select>
              {#if o.avancement !== null}<div class="barre"><div style="width:{o.avancement}%"></div></div><span class="sous">{o.faites}/{o.cartes} cartes</span>{/if}
              <button class="petit danger" onclick={() => agir(() => agl.objectif({ id: o.id, project: projet.id, delete: true }))}>Retirer</button>
            </div>
          {/each}
          <div class="objectif nouveau">
            <input bind:value={nouvelObjectif.title} placeholder="Nouvel objectif" />
            <input type="date" bind:value={nouvelObjectif.date} />
            <button class="petit" disabled={!nouvelObjectif.title.trim()} onclick={() => { const n = { ...nouvelObjectif }; nouvelObjectif = { title: "", date: "" }; void agir(async () => { const r = await agl.objectif({ project: projet.id, title: n.title }); if (n.date) await agl.objectif({ id: r.id, project: projet.id, date: n.date }); }); }}>Ajouter</button>
          </div>
        </div>
      </div>

      <label class="champ">Règles du projet (données à tous ses agents)
        <textarea rows="5" bind:value={edition.rules} placeholder="Ex. : jamais de push sur main ; la production est gelée."></textarea>
      </label>
      <div>
        <b>Agents dédiés</b>
        <div class="ligne">
          {#each etat?.agents ?? [] as a}
            <label class="pastille"><input type="checkbox" checked={edition.agents.includes(a.nom)} onchange={(e) => (edition!.agents = e.currentTarget.checked ? [...edition!.agents, a.nom] : edition!.agents.filter((x) => x !== a.nom))} /> {a.emoji} {nomAffiche(a.nom)}</label>
          {/each}
        </div>
      </div>
      <div>
        <b>Tableaux</b>
        <div class="ligne">
          {#each etat?.tableaux.filter((t) => t.projet === projet.id) ?? [] as t}<button class="petit" onclick={() => ouvrirTableau(t.id)}>{t.emoji} {t.nom}</button>{/each}
          <button class="petit" onclick={() => agir(() => agl.tableau({ name: `${projet.nom} — nouveau`, project: projet.id }))}>+ Tableau</button>
        </div>
      </div>
      <div class="sous">🧠 Branche du cerveau : <code>{projet.branche || "—"}</code></div>
      {#if enfants(projet.id).length}
        <div><b>Sous-projets</b><div class="ligne">{#each enfants(projet.id) as e}<button class="petit" onclick={() => { edition = null; choisi = e.id; }}>{e.emoji} {e.nom}</button>{/each}</div></div>
      {/if}
      <div class="ligne">
        <button class="principal" onclick={() => agir(() => agl.projet({ id: projet.id, name: edition!.name, emoji: edition!.emoji, color: edition!.color, goal: edition!.goal, rules: edition!.rules, agents: edition!.agents }))}>Enregistrer</button>
        <button onclick={() => (nouveau = { name: "", emoji: "📁", goal: "", parent: projet.id })}>+ Sous-projet</button>
      </div>
    </aside>
  {/if}
</div>

<style>
  .formulaire {
    display: grid;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    margin-bottom: 14px;
    max-width: 620px;
  }
  .emoji {
    width: 56px !important;
    text-align: center;
    font-size: 18px;
  }
  .projet {
    border-left: 4px solid var(--c) !important;
  }
  .eteint {
    opacity: 0.55;
  }
  .gros {
    font-size: 28px;
  }
  .milieu {
    flex: 1;
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .droite {
    width: 240px;
    display: grid;
    gap: 6px;
  }
  .titre {
    flex: 1;
    font-size: 17px;
    font-weight: 700;
  }
  .couleur {
    width: 42px !important;
    padding: 2px !important;
  }
  .road {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 10px 2px;
    scroll-snap-type: x proximity;
  }
  .objectif {
    flex: none;
    width: 190px;
    display: grid;
    gap: 6px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    scroll-snap-align: center;
  }
  .objectif.encours {
    border-color: var(--accent);
  }
  .objectif.atteint {
    opacity: 0.6;
  }
  .objectif.abandonne {
    opacity: 0.4;
    text-decoration: line-through;
  }
  .otitre {
    font-weight: 600;
  }
  .nouveau {
    border-style: dashed;
  }
  code {
    font-size: 12px;
  }
</style>

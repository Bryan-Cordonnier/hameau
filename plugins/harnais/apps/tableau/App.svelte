<script lang="ts">
  // Le tableau : les tâches des agents épinglées sur du liège, une feuille par tâche (Mission, Routine, Expédition),
  // l'agent préféré et qui d'autre a le droit. À droite, ce qui est pour Bryan (ses notes Quotidien).
  import { appeler, cerveau, habitant, nomDe, Personnage, type Agent, type Tache, type TypeTache } from "@hameau/commun";
  import { autresTexte, avancement, recurrence, rythme, TYPES } from "../../src/taches";

  let taches = $state<Tache[]>([]);
  let agents = $state<Agent[]>([]);
  let notes = $state("");
  let erreur = $state("");
  let filtre = $state<"actives" | "toutes">("actives");
  let choisie = $state<Tache | null>(null);
  let nouvelle = $state(false);

  // formulaire de nouvelle tâche
  let fTitre = $state("");
  let fConsigne = $state("");
  let fAgent = $state("max");
  let fType = $state<TypeTache>("mission");
  let fHeure = $state("08:00");
  let fJours = $state(3);

  const visibles = $derived(taches.filter((t) => filtre === "toutes" || t.actif));
  const vraisAgents = $derived(agents.filter((a) => a.actif && habitant(a.nom)));

  async function charger(): Promise<void> {
    try {
      [taches, agents] = await Promise.all([cerveau.taches(), cerveau.agents()]);
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
    try {
      notes = String(await appeler("note_list", {}));
    } catch {
      notes = "";
    }
  }
  void charger();

  async function creer(): Promise<void> {
    if (!fTitre.trim() || !fConsigne.trim()) return;
    try {
      await cerveau.creerTache({
        post: fAgent,
        title: fTitre.trim(),
        instructions: fConsigne.trim(),
        recurrence: recurrence(fType, fHeure, null),
        ...(fType === "expedition" ? { end_days: fJours } : {}),
      });
      nouvelle = false;
      fTitre = fConsigne = "";
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function modifier(t: Tache, champs: Record<string, unknown>): Promise<void> {
    try {
      await cerveau.modifierTache(t.id, champs);
      await charger();
      choisie = taches.find((x) => x.id === t.id) ?? null;
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  // une légère rotation par feuille, stable d'un chargement à l'autre
  const rotation = (id: number) => ((id * 37) % 7) - 3;
  const lignesNotes = $derived(
    notes
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("-") || /^\[?n\d+/.test(l))
      .slice(0, 12),
  );
</script>

<div class="page">
  <header>
    <div>
      <h1>Tableau</h1>
      <p class="petit">Les tâches des agents. Clique une feuille pour la régler.</p>
    </div>
    <div class="actions-tete">
      <div class="seg" role="group" aria-label="Filtre">
        <button class:on={filtre === "actives"} onclick={() => (filtre = "actives")}>En cours</button>
        <button class:on={filtre === "toutes"} onclick={() => (filtre = "toutes")}>Toutes</button>
      </div>
      <button class="btn primary" onclick={() => (nouvelle = true)}>+ Nouvelle tâche</button>
    </div>
  </header>

  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

  <div class="colonnes">
    <section class="liege" aria-label="Tâches des agents">
      {#each visibles as t (t.id)}
        {@const type = TYPES[t.type]}
        {@const av = avancement(t)}
        <button class="feuille" class:eteinte={!t.actif} style="--r:{rotation(t.id)}deg;--punaise:{type.couleur}" onclick={() => (choisie = t)}>
          <span class="type" style="color:{type.couleur}">{type.emoji} {type.nom} · {rythme(t)}</span>
          <b class="titre">{t.titre}</b>
          {#if av !== null}<span class="barre" aria-label="Avancement {av} %"><i style="width:{av}%"></i></span>{/if}
          <span class="qui">
            <Personnage qui={habitant(t.poste)} taille={22} anime={t.en_cours} />
            <span>★ {nomDe(t.poste)}{t.en_cours ? " · en train" : ""}</span>
            <span class="chip">{autresTexte(t.autres, nomDe)}</span>
          </span>
        </button>
      {:else}
        <p class="vide-liege">Aucune tâche{filtre === "actives" ? " en cours" : ""}. Les agents attendent leur prochaine mission 💤</p>
      {/each}
    </section>

    <aside class="toi">
      <h2>📝 Pour toi</h2>
      {#if lignesNotes.length}
        {#each lignesNotes as l}<p class="note">{l.replace(/^[-\s]+/, "")}</p>{/each}
      {:else}
        <p class="petit">Rien à faire pour toi en ce moment (ou les notes de Quotidien ne sont pas accessibles).</p>
      {/if}
    </aside>
  </div>
</div>

{#if choisie}
  {@const t = choisie}
  <div class="voile" role="presentation" onclick={() => (choisie = null)}></div>
  <div class="fiche" role="dialog" aria-label={t.titre}>
    <span class="type" style="color:{TYPES[t.type].couleur}">{TYPES[t.type].emoji} {TYPES[t.type].nom} · {rythme(t)}</span>
    <h2>{t.titre}</h2>
    <p class="consigne">{t.consigne}</p>
    {#if t.rapport}<p class="petit"><b>Dernier compte rendu :</b> {t.rapport.slice(0, 400)}</p>{/if}
    <label
      >Agent préféré
      <select class="saisie" value={t.poste} onchange={(e) => modifier(t, { preferred: (e.currentTarget as HTMLSelectElement).value })}>
        {#each vraisAgents as a}<option value={a.nom}>{nomDe(a.nom)}</option>{/each}
      </select>
    </label>
    <label
      >Qui d'autre peut s'en charger
      <select
        class="saisie"
        value={t.autres.startsWith("liste:") ? "liste" : t.autres}
        onchange={(e) => {
          const v = (e.currentTarget as HTMLSelectElement).value;
          const autres = vraisAgents.map((a) => a.nom).filter((n) => n !== t.poste);
          void modifier(t, { others: v === "liste" ? (autres.length ? `liste:${autres.join(",")}` : "personne") : v });
        }}
      >
        <option value="tous">N'importe qui</option>
        <option value="liste">Les autres agents de l'équipe</option>
        <option value="personne">Personne d'autre</option>
      </select>
    </label>
    <div class="actions">
      <button class="btn" onclick={() => modifier(t, { active: !t.actif })}>{t.actif ? "Mettre en pause" : "Reprendre"}</button>
      <button class="btn" onclick={() => (choisie = null)}>Fermer</button>
    </div>
  </div>
{/if}

{#if nouvelle}
  <div class="voile" role="presentation" onclick={() => (nouvelle = false)}></div>
  <form class="fiche" aria-label="Nouvelle tâche" onsubmit={(e) => (e.preventDefault(), creer())}>
    <h2>Nouvelle tâche</h2>
    <div class="seg types" role="group" aria-label="Type de tâche">
      {#each Object.entries(TYPES) as [id, ty]}
        <button type="button" class:on={fType === id} onclick={() => (fType = id as TypeTache)} title={ty.aide}>{ty.emoji} {ty.nom}</button>
      {/each}
    </div>
    <label>Titre <input class="saisie" bind:value={fTitre} placeholder="Trier les mails" required /></label>
    <label>Consigne complète <textarea class="saisie" rows="4" bind:value={fConsigne} placeholder="Ce que l'agent doit faire, sans rien supposer" required></textarea></label>
    <label
      >Agent préféré
      <select class="saisie" bind:value={fAgent}>{#each vraisAgents as a}<option value={a.nom}>{nomDe(a.nom)}</option>{/each}</select>
    </label>
    {#if fType !== "mission"}<label>Chaque jour à <input class="saisie" type="time" bind:value={fHeure} /></label>{/if}
    {#if fType === "expedition"}<label>Pendant (jours) <input class="saisie" type="number" min="1" max="365" bind:value={fJours} /></label>{/if}
    <div class="actions"><button class="btn primary" type="submit">Épingler</button><button class="btn" type="button" onclick={() => (nouvelle = false)}>Annuler</button></div>
  </form>
{/if}

<style>
  .page {
    padding: 20px;
    display: grid;
    gap: 16px;
  }
  header {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  header > div:first-child {
    margin-right: auto;
  }
  h1 {
    margin: 0;
    font-size: 24px;
  }
  .actions-tete {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px;
    gap: 2px;
  }
  .seg button {
    border: 0;
    background: none;
    border-radius: 999px;
    padding: 5px 12px;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
  }
  .seg button.on {
    background: var(--accent-soft);
    color: var(--text);
  }
  .colonnes {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .liege {
    background: #caa477 radial-gradient(#b38d5f 1px, transparent 1.5px) 0 0 / 9px 9px;
    border-radius: 18px;
    padding: 22px 18px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 22px;
    min-height: 300px;
    align-content: start;
  }
  .feuille {
    all: unset;
    cursor: pointer;
    background: #fffdf6;
    color: #2b2620;
    border-radius: 4px;
    padding: 16px 14px 12px;
    box-shadow: 0 6px 12px #0003;
    position: relative;
    display: grid;
    gap: 8px;
    align-content: start;
    transform: rotate(var(--r));
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }
  .feuille:hover,
  .feuille:focus-visible {
    transform: rotate(0deg) translateY(-3px);
    box-shadow: 0 12px 20px #0003;
  }
  .feuille:focus-visible {
    outline: 2px solid var(--accent);
  }
  .feuille::before {
    content: "";
    position: absolute;
    top: -7px;
    left: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--punaise);
    transform: translateX(-50%);
    box-shadow: 0 2px 3px #0004;
  }
  .feuille.eteinte {
    opacity: 0.55;
  }
  .type {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .titre {
    font-size: 15px;
  }
  .barre {
    height: 7px;
    border-radius: 9px;
    background: #eee4d5;
    overflow: hidden;
  }
  .barre i {
    display: block;
    height: 100%;
    background: #5d7fc4;
  }
  .qui {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    font-size: 12px;
  }
  .chip {
    border-radius: 999px;
    padding: 2px 8px;
    background: #f1ebe0;
  }
  .vide-liege {
    grid-column: 1 / -1;
    color: #fffdf6;
    font-weight: 600;
    text-align: center;
  }
  .toi {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 14px;
    display: grid;
    gap: 8px;
  }
  .toi h2 {
    margin: 0;
    font-size: 16px;
  }
  .note {
    margin: 0;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--surface-2);
    font-size: 13.5px;
  }
  .voile {
    position: fixed;
    inset: 0;
    background: var(--scrim, #0004);
  }
  .fiche {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(480px, calc(100% - 32px));
    max-height: calc(100% - 40px);
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 18px;
    display: grid;
    gap: 12px;
    box-shadow: 0 20px 50px #0003;
  }
  .fiche h2 {
    margin: 0;
  }
  .fiche label {
    display: grid;
    gap: 4px;
    font-weight: 600;
    font-size: 13px;
  }
  .consigne {
    white-space: pre-wrap;
    margin: 0;
  }
  .types {
    justify-self: start;
  }
  .erreur {
    color: #c0392b;
    margin: 0;
  }
  @media (max-width: 860px) {
    .colonnes {
      grid-template-columns: 1fr;
    }
  }
</style>

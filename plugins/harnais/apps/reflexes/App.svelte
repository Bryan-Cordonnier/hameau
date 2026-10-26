<script lang="ts">
  // Les Réflexes : ce que Max (ou une API) refait tout seul, à heure fixe ou toutes les N minutes. On les crée surtout en
  // les décrivant à Max (il se les ajoute), ou depuis Claude ; un petit formulaire suffit pour le reste. Les réveils de
  // Claude, eux, restent dans Claude.
  import { cerveau, habitant, ilYa, nomDe, type Agent, type Tache } from "@hameau/commun";
  import { recurrence, rythme } from "../../src/taches";

  let taches = $state<Tache[]>([]);
  let agents = $state<Agent[]>([]);
  let erreur = $state("");
  let mode = $state<"liste" | "max" | "main">("liste");
  let choisi = $state<number | null>(null);
  // avec Max : la description envoyée dans son fil « Petit mot »
  let description = $state("");
  let envoye = $state(false);
  // à la main
  let fNom = $state("");
  let fConsigne = $state("");
  let fAgent = $state("max");
  let fQuand = $state<"heure" | "minutes">("heure");
  let fHeure = $state("08:00");
  let fMinutes = $state(60);

  const reflexes = $derived(taches.filter((t) => t.type !== "mission"));
  const reflexe = $derived(reflexes.find((t) => t.id === choisi) ?? null);
  const agentsLocaux = $derived(agents.filter((a) => a.actif && habitant(a.nom)?.genre === "habitant"));

  async function charger(): Promise<void> {
    try {
      [taches, agents] = await Promise.all([cerveau.taches(), cerveau.agents()]);
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();

  async function agir(f: () => Promise<unknown>): Promise<void> {
    try {
      await f();
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function avecMax(): Promise<void> {
    const texte = description.trim();
    if (!texte) return;
    await agir(async () => {
      const titre = "Petit mot";
      let c = (await cerveau.chantiers()).find((x) => x.titre === titre);
      if (!c) {
        await cerveau.creerChantier(titre, "Questions rapides à Max.");
        c = (await cerveau.chantiers()).find((x) => x.titre === titre);
      }
      if (c)
        await cerveau.ecrireChantier(
          c.id,
          `Nouveau réflexe à te créer (task_create avec une récurrence, pour toi). Une fois créé, confirme-moi en une phrase son nom et son rythme, puis oublie cette conversation sauf ce qui est vraiment utile. Ce que je veux : ${texte}`,
        );
      envoye = true;
      description = "";
    });
  }

  async function aLaMain(): Promise<void> {
    if (!fNom.trim() || !fConsigne.trim()) return;
    await agir(() =>
      cerveau.creerTache({
        post: fAgent,
        title: fNom.trim(),
        instructions: fConsigne.trim(),
        recurrence: recurrence("routine", fQuand === "heure" ? fHeure : "", fQuand === "minutes" ? fMinutes : null),
      }),
    );
    if (!erreur) (mode = "liste"), (fNom = fConsigne = "");
  }
</script>

<div class="page">
  <header>
    <h1>⚡ Réflexes</h1>
    <div class="actions">
      <button onclick={() => ((mode = "max"), (envoye = false))}>💬 Créer avec Max</button>
      <button onclick={() => (mode = "main")}>✍️ À la main</button>
    </div>
  </header>
  <p class="petit">Ce que Max refait tout seul, à heure fixe ou à intervalle régulier. Les réveils de Claude se règlent dans Claude.</p>
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

  {#if mode === "max"}
    <section class="boite">
      <h2>💬 Décris le réflexe à Max</h2>
      <p class="petit">Explique simplement ce qu'il doit faire et quand. Il se crée le réflexe, te le confirme, puis oublie la conversation.</p>
      <textarea bind:value={description} rows="5" placeholder="Tous les matins à 7 h, regarde mes mails et dis-moi s'il y a quelque chose d'urgent."></textarea>
      <div class="boutons"><button onclick={() => (mode = "liste")}>Fermer</button><button class="principal" onclick={avecMax}>Envoyer à Max</button></div>
      {#if envoye}<p class="petit">✔ Envoyé. Max te répond dans 💬 Petit mot dès son prochain tour (s'il est allumé).</p>{/if}
    </section>
  {:else if mode === "main"}
    <form class="boite" onsubmit={(e) => (e.preventDefault(), void aLaMain())}>
      <h2>✍️ Nouveau réflexe</h2>
      <label>Nom<input bind:value={fNom} placeholder="Tri des mails" /></label>
      <label>Ce qu'il fait<textarea bind:value={fConsigne} rows="4" placeholder="Consigne complète pour l'agent"></textarea></label>
      <label>Agent<select bind:value={fAgent}>{#each agentsLocaux as a}<option value={a.nom}>{nomDe(a.nom)}</option>{/each}</select></label>
      <div class="quand">
        <label class="radio"><input type="radio" bind:group={fQuand} value="heure" /> Tous les jours à</label>
        <input type="time" bind:value={fHeure} disabled={fQuand !== "heure"} />
        <label class="radio"><input type="radio" bind:group={fQuand} value="minutes" /> Toutes les</label>
        <input type="number" min="5" bind:value={fMinutes} disabled={fQuand !== "minutes"} /> <span>min</span>
      </div>
      <div class="boutons"><button type="button" onclick={() => (mode = "liste")}>Annuler</button><button class="principal" type="submit">Créer</button></div>
    </form>
  {/if}

  <div class="liste">
    {#each reflexes as r (r.id)}
      <button class="reflexe" class:eteint={!r.actif} aria-pressed={choisi === r.id} onclick={() => (choisi = choisi === r.id ? null : r.id)}>
        <span class="nom">{r.actif ? "⚡" : "⏸️"} {r.titre}</span>
        <span class="meta">{nomDe(r.poste)} · {rythme(r)}{r.derniere ? ` · dernier passage ${r.derniere}` : ""}</span>
      </button>
      {#if reflexe?.id === r.id}
        <div class="detail">
          <p class="consigne">{r.consigne}</p>
          {#if r.rapport}<p class="rapport">📮 {r.rapport}</p>{/if}
          <div class="boutons">
            <button onclick={() => agir(() => cerveau.modifierTache(r.id, { active: !r.actif }))}>{r.actif ? "⏸️ Mettre en pause" : "▶️ Reprendre"}</button>
          </div>
        </div>
      {/if}
    {:else}
      <p class="petit">Aucun réflexe pour l'instant. Le plus simple : « 💬 Créer avec Max ».</p>
    {/each}
  </div>
  {#if reflexes.length}<p class="petit">Mis à jour {ilYa(Date.now() / 1000)}.</p>{/if}
</div>

<style>
  .page { padding: 18px 20px; display: grid; gap: 12px; max-width: 900px; }
  header { display: flex; justify-content: space-between; align-items: center; }
  h1 { margin: 0; font-size: 20px; }
  h2 { margin: 0; font-size: 16px; }
  .actions, .boutons { display: flex; gap: 8px; }
  .boutons { justify-content: flex-end; }
  button, input, select, textarea { font: inherit; color: var(--text); }
  button { border: 1px solid var(--border); background: var(--surface); border-radius: 8px; padding: 6px 12px; cursor: pointer; }
  .principal { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
  input, select, textarea { box-sizing: border-box; width: 100%; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; background: var(--field); }
  .boite { display: grid; gap: 10px; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
  .boite label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
  .quand { display: grid; grid-template-columns: auto 120px auto 90px auto; gap: 8px; align-items: center; font-size: 13px; }
  .radio { display: flex !important; gap: 6px; align-items: center; }
  .radio input { width: auto; }
  .liste { display: grid; gap: 6px; }
  .reflexe { text-align: left; display: grid; gap: 3px; padding: 10px 12px; background: var(--surface); }
  .reflexe[aria-pressed="true"] { border-color: var(--accent); }
  .reflexe.eteint { opacity: 0.6; }
  .nom { font-weight: 600; }
  .meta, .petit { font-size: 12px; color: var(--muted); margin: 0; }
  .detail { padding: 10px 12px; margin: -4px 0 4px; border: 1px solid var(--border); border-top: 0; border-radius: 0 0 8px 8px; display: grid; gap: 8px; }
  .consigne, .rapport { margin: 0; white-space: pre-wrap; font-size: 13px; }
  .rapport { padding: 8px; background: var(--surface-2); border-radius: 8px; }
  .erreur { color: #d9534f; margin: 0; }
</style>

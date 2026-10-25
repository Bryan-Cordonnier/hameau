<script lang="ts">
  // Petit mot : une question rapide à un agent. L'échange vit dans un chantier « Petits mots » dédié (sa propre mémoire) ;
  // l'agent répond par le harnais. Quand le sujet grandit, il propose d'en faire un vrai chantier.
  import { cerveau, habitant, ilYa, nomDe, Personnage, type Chantier } from "@hameau/commun";

  const TITRE = "Petits mots";
  let fil = $state<Chantier | null>(null);
  let texte = $state("");
  let erreur = $state("");
  let envoi = $state(false);

  async function charger(): Promise<void> {
    try {
      const liste = await cerveau.chantiers();
      let c = liste.find((x) => x.titre === TITRE);
      if (!c) {
        await cerveau.creerChantier(TITRE, "Questions rapides à Max. Quand un sujet grandit, propose d'en faire un chantier.");
        c = (await cerveau.chantiers()).find((x) => x.titre === TITRE);
      }
      if (c) fil = await cerveau.chantier(c.id);
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  // les réponses de l'agent arrivent dans le fil : on le relit régulièrement
  $effect(() => {
    const t = setInterval(() => void (fil && cerveau.chantier(fil.id).then((c) => (fil = c)).catch(() => {})), 5000);
    return () => clearInterval(t);
  });

  async function envoyer(): Promise<void> {
    if (!texte.trim() || !fil) return;
    envoi = true;
    try {
      await cerveau.ecrireChantier(fil.id, texte.trim());
      texte = "";
      fil = await cerveau.chantier(fil.id);
    } catch (e) {
      erreur = (e as Error).message;
    }
    envoi = false;
  }

  const messages = $derived(fil?.messages ?? []);
</script>

<div class="page">
  <header>
    <Personnage qui={habitant("max")} taille={42} anime />
    <div>
      <h1>Petit mot</h1>
      <p class="petit">Une question rapide à Max. Si ça devient un vrai sujet, il te proposera un chantier.</p>
    </div>
  </header>
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
  <div class="fil" aria-live="polite">
    {#each messages as m (m.id)}
      <div class="bulle" class:moi={!habitant(m.auteur)}>
        <span>{m.texte}</span>
        <small>{nomDe(m.auteur)} · {ilYa(m.quand)}</small>
      </div>
    {:else}
      <p class="petit vide">Pose ta question 👇</p>
    {/each}
  </div>
  <form onsubmit={(e) => (e.preventDefault(), envoyer())}>
    <input class="saisie" bind:value={texte} placeholder="Une question rapide…" aria-label="Petit mot à Max" disabled={envoi} />
    <button class="btn primary" type="submit" disabled={envoi || !texte.trim()}>Envoyer</button>
  </form>
</div>

<style>
  .page {
    padding: 20px;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    gap: 12px;
    height: 100vh;
    box-sizing: border-box;
    max-width: 760px;
  }
  header {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  h1 {
    margin: 0;
    font-size: 22px;
  }
  .fil {
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px;
  }
  .bulle {
    max-width: 80%;
    padding: 9px 12px;
    border-radius: 14px;
    background: var(--surface-2);
    display: grid;
    gap: 2px;
    align-self: flex-start;
    white-space: pre-wrap;
  }
  .bulle.moi {
    align-self: flex-end;
    background: var(--accent-soft);
  }
  .bulle small {
    color: var(--muted);
    font-size: 11px;
  }
  form {
    display: flex;
    gap: 8px;
  }
  form input {
    flex: 1;
  }
  .vide {
    text-align: center;
  }
  .erreur {
    color: #c0392b;
    margin: 0;
  }
</style>

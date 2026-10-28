<script lang="ts">
  // L'accueil : une grille de blocs en pixel art, un par agent, qui montrent ce qu'il fait (Max en grand, en premier).
  // Sous chaque bloc : son nom et sa tâche en cours ; un clic ouvre sa fiche (page Agents).
  import { connect } from "@etabli/sdk";
  import { agl, nomAffiche, Pixel, Recherche, type Agent, type EtatAgl, type Scene } from "@hameau/commun";

  let etat = $state<EtatAgl | null>(null);
  let erreur = $state("");

  async function charger(): Promise<void> {
    try {
      etat = await agl.etat();
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  $effect(() => {
    const t = setInterval(() => void charger(), 8000);
    return () => clearInterval(t);
  });

  const scene = (a: Agent): Scene => (a.etat === "sans_credits" ? "sans_credits" : a.en_pause ? "dort" : a.activite.scene);
  const ligne = (a: Agent): string => {
    if (a.etat === "sans_credits") return "Plus de crédits d'API";
    if (a.en_pause) return etat?.tout_arrete ? "Tout est arrêté" : "En pause";
    if (a.activite.carte) return a.activite.carte.titre;
    if (a.activite.scene === "attend") return "Attend ta réponse";
    return a.activite.scene === "dort" ? "Rien en cours" : (a.activite.derniere?.resume ?? "Au travail");
  };
  async function ouvrir(a: Agent): Promise<void> {
    const e = await connect();
    e.send("agent", { nom: a.nom });
  }
  const enCours = $derived(etat?.cartes.filter((c) => c.statut === "en_cours").length ?? 0);
  const bloquees = $derived(etat?.cartes.filter((c) => c.statut === "bloque").length ?? 0);
</script>

<Recherche />
<div class="agl">
  <div class="entete">
    <h1>Accueil</h1>
    <span class="espace"></span>
    {#if etat}
      <span class="pastille">📋 {enCours} en cours</span>
      {#if bloquees}<span class="pastille bloque">✋ {bloquees} bloquée{bloquees > 1 ? "s" : ""}</span>{/if}
      {#if etat.tout_arrete}<span class="pastille">⏸️ Tout est arrêté</span>{/if}
      {#if !etat.cartes_actives}<span class="pastille" title="Réglable dans Paramètres AGL">Les agents ne prennent pas les cartes</span>{/if}
    {/if}
  </div>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}
  {#if etat}
    <div class="grille">
      {#each etat.agents as a (a.nom)}
        <button class="bloc" class:grand={a.principal} style="--c:{a.couleur}" onclick={() => ouvrir(a)} title="Ouvrir la fiche de {nomAffiche(a.nom)}">
          <div class="scene"><Pixel perso={a.perso} couleur={a.couleur} scene={scene(a)} taille={a.principal ? 168 : 112} /></div>
          <div class="nom">{a.emoji} {nomAffiche(a.nom, etat.agents)}</div>
          <div class="tache">{ligne(a)}</div>
        </button>
      {/each}
    </div>
    <p class="sous aide">Ctrl+K pour chercher partout.</p>
  {/if}
</div>

<style>
  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 14px;
  }
  .bloc {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 16px 12px 14px !important;
    border-radius: 16px !important;
    border: 1px solid var(--border);
    background: var(--surface);
    text-align: center;
  }
  .bloc:hover {
    border-color: var(--c) !important;
  }
  .grand {
    grid-column: span 2;
    grid-row: span 2;
    align-content: center;
  }
  .scene {
    display: grid;
    place-items: center;
    width: 100%;
    background: var(--surface-2);
    border-radius: 12px;
    padding: 8px 0;
    border-bottom: 3px solid var(--c);
  }
  .nom {
    font-weight: 700;
    font-size: 15px;
  }
  .tache {
    color: var(--muted);
    font-size: 12px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bloque {
    color: #d9534f;
  }
  .aide {
    margin-top: 18px;
  }
</style>

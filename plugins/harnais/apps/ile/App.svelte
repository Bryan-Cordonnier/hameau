<script lang="ts">
  // Accueil provisoire : l'état du hameau en un coup d'œil (agents, tâches en cours, courrier à traiter, serveur du modèle).
  // La vue illustrée (île ou quartier) viendra remplacer cette page une fois le style choisi par Bryan.
  import { cerveau, ilYa, type EtatServeur, type Rapport, type Tache } from "@hameau/commun";

  let taches = $state<Tache[]>([]);
  let courrier = $state<Rapport[]>([]);
  let serveur = $state<EtatServeur | null>(null);
  let erreur = $state("");

  const enCours = $derived(taches.filter((t) => t.actif && t.en_cours));
  const questions = $derived(courrier.reduce((n, r) => n + r.questions.filter((q) => q.r === null).length, 0));

  async function charger(): Promise<void> {
    try {
      [taches, courrier, serveur] = await Promise.all([cerveau.taches(), cerveau.rapports(), cerveau.serveur()]);
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  $effect(() => {
    const t = setInterval(() => void charger(), 15000);
    return () => clearInterval(t);
  });
</script>

<div class="page">
  <h1>Le hameau</h1>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}
  <section>
    <h2>Tâches en cours ({enCours.length})</h2>
    {#each enCours as t (t.id)}
      <p>{t.titre} <small>— {t.poste}{t.avancement !== null ? `, ${Math.round(t.avancement * 100)} %` : ""}</small></p>
    {:else}
      <p><small>Rien en cours.</small></p>
    {/each}
  </section>
  <section>
    <h2>Courrier</h2>
    <p>{courrier.length} rapport(s) à classer, {questions} question(s) sans réponse.
      {#if courrier[0]}<small>Dernier : {courrier[0].titre} ({ilYa(courrier[0].cree)})</small>{/if}</p>
  </section>
  <section>
    <h2>Serveur du modèle</h2>
    <p>{serveur?.en_ligne ? "En ligne" : "Hors ligne (Max dort)"}</p>
  </section>
</div>

<style>
  .page { padding: 20px; max-width: 760px; }
  section { margin-top: 16px; }
  small { opacity: 0.7; }
  .erreur { color: #e25c4a; }
</style>

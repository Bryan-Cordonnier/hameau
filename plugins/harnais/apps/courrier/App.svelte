<script lang="ts">
  // Le courrier : chaque rapport d'un agent arrive comme une lettre. Jaune : le rapport d'une tâche ; bleu : une décision
  // prise par l'agent ; vert : un bilan qui en résume plusieurs. On ouvre la lettre, on répond aux questions, on classe.
  import { cerveau, habitant, ilYa, nomDe, Personnage, type Rapport } from "@hameau/commun";

  const ENVELOPPES = {
    tache: { nom: "Rapport de tâche", tampon: "📦", fond: "#fff3d6" },
    decision: { nom: "Décision", tampon: "🧭", fond: "#e3ecff" },
    bilan: { nom: "Bilan", tampon: "🗞️", fond: "#e2f3e6" },
  } as const;

  let rapports = $state<Rapport[]>([]);
  let tous = $state(false);
  let ouvert = $state<Rapport | null>(null);
  let reponses = $state<Record<number, string>>({});
  let erreur = $state("");
  let info = $state("");

  async function charger(): Promise<void> {
    try {
      rapports = await cerveau.rapports(tous);
      if (ouvert) ouvert = rapports.find((r) => r.id === ouvert!.id) ?? null;
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  $effect(() => {
    void tous;
    void charger();
  });

  async function repondre(r: Rapport, i: number): Promise<void> {
    const texte = (reponses[i] ?? "").trim();
    if (!texte) return;
    try {
      info = await cerveau.repondre(r.id, i, texte);
      reponses[i] = "";
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function classer(r: Rapport, oui = true): Promise<void> {
    try {
      await cerveau.classer(r.id, oui);
      ouvert = null;
      info = oui ? "Classé ✓" : "Remis dans le courrier.";
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
</script>

<div class="page">
  <header>
    <div>
      <h1>Courrier</h1>
      <p class="petit">Les rapports des agents. Réponds aux questions : l'agent reprend aussitôt.</p>
    </div>
    <label class="bascule"><input type="checkbox" bind:checked={tous} /> Montrer les lettres classées</label>
  </header>
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
  {#if info}<p class="info" role="status">{info}</p>{/if}

  <div class="corps" class:lecture={ouvert}>
    <section class="lettres" aria-label="Lettres">
      {#each rapports as r (r.id)}
        {@const e = ENVELOPPES[r.genre] ?? ENVELOPPES.tache}
        {@const enAttente = r.questions.filter((q) => !q.r).length}
        <button class="enveloppe" class:choisie={ouvert?.id === r.id} class:classee={r.classe} style="--fond:{e.fond}" onclick={() => (ouvert = r)}>
          <span class="tampon" aria-hidden="true">{e.tampon}</span>
          <small>{e.nom}{enAttente ? ` · ${enAttente} question${enAttente > 1 ? "s" : ""}` : ""}</small>
          <b>{r.titre}</b>
          <span class="de"><Personnage qui={habitant(r.agent)} taille={20} /> {nomDe(r.agent)} · {ilYa(r.cree)}</span>
        </button>
      {:else}
        <p class="vide">📭 Boîte vide. Les prochains rapports des agents arriveront ici.</p>
      {/each}
    </section>

    {#if ouvert}
      {@const r = ouvert}
      <article class="lettre" aria-label={r.titre}>
        <header class="tete-lettre">
          <Personnage qui={habitant(r.agent)} taille={44} anime />
          <div>
            <h2>{r.titre}</h2>
            <p class="petit">{(ENVELOPPES[r.genre] ?? ENVELOPPES.tache).nom} de {nomDe(r.agent)} · {ilYa(r.cree)}{r.tache_id ? ` · tâche ${r.tache_id}` : ""}</p>
          </div>
          <button class="btn" aria-label="Fermer la lettre" onclick={() => (ouvert = null)}>✕</button>
        </header>
        {#if r.informations.length}
          <section><h3>ℹ️ Informations</h3><ul>{#each r.informations as x}<li>{x}</li>{/each}</ul></section>
        {/if}
        {#if r.problemes.length}
          <section><h3>⚠️ Problèmes</h3><ul>{#each r.problemes as x}<li>{x}</li>{/each}</ul></section>
        {/if}
        {#if r.questions.length}
          <section>
            <h3>❓ Questions</h3>
            {#each r.questions as q, i}
              <div class="question">
                <p>{q.q}</p>
                {#if q.r}
                  <p class="reponse">✓ {q.r}</p>
                {:else}
                  <form onsubmit={(e) => (e.preventDefault(), repondre(r, i))}>
                    <input class="saisie" bind:value={reponses[i]} placeholder="Ta réponse…" aria-label="Réponse à : {q.q}" />
                    <button class="btn primary" type="submit">Répondre</button>
                  </form>
                {/if}
              </div>
            {/each}
          </section>
        {/if}
        {#if r.manipulations.length}
          <section><h3>🧰 Manipulations à faire</h3><ul>{#each r.manipulations as x}<li>{x}</li>{/each}</ul><p class="petit">Ajoutées à tes notes dans Quotidien.</p></section>
        {/if}
        <div class="actions">
          {#if r.classe}
            <button class="btn" onclick={() => classer(r, false)}>Remettre dans le courrier</button>
          {:else}
            <button class="btn primary" onclick={() => classer(r)}>✓ Tout est ok, classer</button>
          {/if}
        </div>
      </article>
    {/if}
  </div>
</div>

<style>
  .page {
    padding: 20px;
    display: grid;
    gap: 14px;
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
  .bascule {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--muted);
    font-weight: 600;
  }
  .corps {
    display: grid;
    gap: 18px;
  }
  .corps.lecture {
    grid-template-columns: minmax(240px, 1fr) minmax(0, 1.6fr);
    align-items: start;
  }
  .lettres {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 16px;
    align-content: start;
  }
  .lecture .lettres {
    grid-template-columns: 1fr;
  }
  .enveloppe {
    all: unset;
    cursor: pointer;
    position: relative;
    border-radius: 12px;
    padding: 16px;
    min-height: 110px;
    display: grid;
    gap: 4px;
    align-content: end;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    transition: border-color 0.2s;
  }
  .enveloppe::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 52px;
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    background: var(--surface-2);
    border-radius: 12px 12px 0 0;
  }
  .enveloppe:hover,
  .enveloppe.choisie {
    border-color: var(--accent);
  }
  .enveloppe:focus-visible {
    outline: 2px solid var(--accent);
  }
  .enveloppe.classee {
    opacity: 0.6;
  }
  .tampon {
    position: absolute;
    top: 10px;
    right: 12px;
    font-size: 22px;
  }
  .enveloppe small,
  .de {
    color: var(--muted);
    font-size: 12px;
  }
  .de {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .lettre {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 18px;
    display: grid;
    gap: 14px;
    animation: ouvre 0.3s ease-out;
  }
  @keyframes ouvre {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }
  .tete-lettre {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .tete-lettre div {
    flex: 1;
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 14px;
  }
  ul {
    margin: 0;
    padding-left: 20px;
  }
  .question {
    display: grid;
    gap: 6px;
    margin-bottom: 10px;
  }
  .question p {
    margin: 0;
  }
  .question form {
    display: flex;
    gap: 8px;
  }
  .question input {
    flex: 1;
  }
  .reponse {
    color: #2e7d32;
    font-weight: 600;
  }
  .vide {
    color: var(--muted);
  }
  .erreur {
    color: #c0392b;
    margin: 0;
  }
  .info {
    color: #2e7d32;
    margin: 0;
  }
  @media (max-width: 860px) {
    .corps.lecture {
      grid-template-columns: 1fr;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lettre {
      animation: none;
    }
  }
</style>

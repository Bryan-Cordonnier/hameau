<script lang="ts">
  // Recherche partout (Ctrl+K), dans chaque page de l'AGL : le cerveau, les cartes, les conversations, les agents, les projets.
  // Un résultat s'ouvre ici même (fiche lue, carte, extrait) ; « Ouvrir » mène à sa page quand elle est dans ce plugin.
  import { agl, type Resultats } from "./agl";

  let { ouvrir }: { ouvrir?: (genre: "fiche" | "carte" | "conversation" | "agent" | "projet", id: string | number) => void } = $props();
  let visible = $state(false);
  let q = $state("");
  let res = $state<Resultats | null>(null);
  let apercu = $state<{ titre: string; texte: string } | null>(null);
  let champ = $state<HTMLInputElement>();
  let minuteur: ReturnType<typeof setTimeout> | undefined;

  function touche(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      visible = !visible;
      if (visible) setTimeout(() => champ?.focus(), 0);
    } else if (e.key === "Escape" && visible) {
      visible = false;
    }
  }
  $effect(() => {
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });
  function taper(): void {
    clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      res = q.trim().length < 2 ? null : await agl.chercher(q).catch(() => null);
    }, 250);
  }
  async function lireFiche(rel: string, titre: string): Promise<void> {
    apercu = { titre, texte: String(await agl.lire(rel).catch((e) => (e as Error).message)) };
  }
  const total = $derived(res ? res.fiches.length + res.cartes.length + res.messages.length + res.agents.length + res.projets.length : 0);
</script>

{#if visible}
  <div class="fond" role="presentation" onclick={() => (visible = false)}></div>
  <div class="boite" role="dialog" aria-label="Recherche">
    <input bind:this={champ} bind:value={q} oninput={taper} placeholder="Chercher partout… (Échap pour fermer)" />
    {#if apercu}
      <div class="apercu">
        <button class="lien" onclick={() => (apercu = null)}>← Résultats</button>
        <h3>{apercu.titre}</h3>
        <pre>{apercu.texte}</pre>
      </div>
    {:else if res}
      {#if total === 0}<p class="vide">Rien trouvé.</p>{/if}
      <div class="liste">
        {#each res.projets as p}<button onclick={() => ouvrir?.("projet", p.id)}><span>{p.emoji}</span> {p.nom}<small>Projet</small></button>{/each}
        {#each res.agents as a}<button onclick={() => ouvrir?.("agent", a.nom)}><span>{a.emoji}</span> {a.nom}<small>Agent</small></button>{/each}
        {#each res.cartes as c}<button onclick={() => ouvrir?.("carte", c.id)}><span>📋</span> {c.titre}<small>Carte</small></button>{/each}
        {#each res.messages as m}<button onclick={() => ouvrir?.("conversation", m.conv)}><span>💬</span> {m.extrait}<small>{m.auteur}</small></button>{/each}
        {#each res.fiches as f}<button onclick={() => lireFiche(f.rel, f.titre)}><span>📄</span> {f.titre}<small>{f.rel}</small></button>{/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .fond {
    position: fixed;
    inset: 0;
    background: var(--scrim, rgba(0, 0, 0, 0.4));
    z-index: 50;
  }
  .boite {
    position: fixed;
    left: 50%;
    top: 12vh;
    transform: translateX(-50%);
    width: min(640px, 92vw);
    max-height: 70vh;
    overflow: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    z-index: 51;
    padding: 12px;
  }
  input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--field);
    color: var(--text);
    font: inherit;
    font-size: 15px;
  }
  .liste {
    display: grid;
    gap: 2px;
    margin-top: 8px;
  }
  .liste button {
    display: flex;
    gap: 8px;
    align-items: center;
    text-align: left;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .liste button:hover {
    background: var(--surface-2);
  }
  small {
    margin-left: auto;
    color: var(--muted);
    font-size: 11px;
  }
  .vide {
    color: var(--muted);
    margin: 10px 4px;
  }
  .apercu pre {
    white-space: pre-wrap;
    font: inherit;
    font-size: 13px;
    line-height: 1.5;
  }
  .lien {
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
    font: inherit;
  }
</style>

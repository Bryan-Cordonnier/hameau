<script lang="ts">
  // Paramètres de l'AGL : le travail des agents (cartes, tout arrêter) et les connecteurs : un service branché une fois avec
  // sa clé, rangée dans le coffre du cerveau (chiffrée) ; les agents n'en voient jamais la clé, seulement le droit de s'en servir.
  import { agl, Recherche, type EtatAgl } from "@hameau/commun";

  let etat = $state<EtatAgl | null>(null);
  let erreur = $state("");
  let info = $state("");
  let nouveau = $state<{ name: string; kind: string; description: string; secret: string } | null>(null);

  async function charger(): Promise<void> {
    try {
      etat = await agl.etat();
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  async function agir(f: () => Promise<unknown>): Promise<void> {
    try {
      const r = await f();
      if (typeof r === "string") info = r;
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  const GENRES: Record<string, string> = { github: "GitHub", infomaniak: "Infomaniak", mail: "Boîte mail", api: "Autre API", autre: "Autre" };
</script>

<Recherche />
<div class="agl">
  <div class="entete"><h1>Paramètres AGL</h1></div>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}
  {#if info}<p class="sous">{info}</p>{/if}

  {#if etat}
    <section>
      <h2>Le travail des agents</h2>
      <label class="ligne"><input type="checkbox" checked={etat.cartes_actives} onchange={(e) => agir(() => agl.cartesActives(e.currentTarget.checked))} />
        <b>Les agents prennent les cartes des tableaux</b><span class="sous">— éteint : ils ne font que discuter</span></label>
      <label class="ligne"><input type="checkbox" checked={etat.tout_arrete} onchange={(e) => agir(() => agl.toutArreter(e.currentTarget.checked))} />
        <b>Tout arrêter</b><span class="sous">— agents et automatisations en pause, d'un coup</span></label>
    </section>

    <section>
      <div class="ligne"><h2>Connecteurs</h2><span class="espace"></span><button class="principal" onclick={() => (nouveau = { name: "", kind: "github", description: "", secret: "" })}>+ Brancher un service</button></div>
      <p class="sous">Pour qu'un agent s'en serve, donne-lui la permission « Utiliser un service branché » sur <code>service/&lt;nom&gt;</code>.</p>
      <div class="pile">
        {#each etat.connecteurs as c}
          <div class="carte-h">
            <b>{c.nom}</b><span class="pastille">{GENRES[c.genre] ?? c.genre}</span><span class="sous flex">{c.description}</span>
            <span class="pastille">{c.a_un_secret ? "🔒 clé au coffre" : "sans clé"}</span>
            <button class="petit danger" onclick={() => confirm(`Débrancher ${c.nom} ? Sa clé sera retirée du coffre.`) && agir(() => agl.connecteur({ name: c.nom, delete: true }))}>Débrancher</button>
          </div>
        {:else}
          <p class="vide">Aucun service branché. La boîte mail et le serveur sont déjà écoutés par le cerveau.</p>
        {/each}
      </div>
    </section>

    <section>
      <h2>Surveillance du serveur</h2>
      <p class="sous">Les événements du serveur (disque malade ou plein, chauffe, mémoire, redémarrage, service arrêté, sauvegarde ratée, connexion suspecte) viennent de la sonde installée sur Proxmox, sans IA. « Serveur injoignable » passe par Healthchecks.io : son mail d'alerte déclenche l'automatisation correspondante. Allume les automatisations voulues dans la page Automatisations.</p>
    </section>
  {/if}

  {#if nouveau}
    <div class="voile" role="presentation" onclick={() => (nouveau = null)}></div>
    <aside class="panneau">
      <h2>Brancher un service</h2>
      <label class="champ">Nom (sert dans les permissions : service/nom)<input bind:value={nouveau.name} placeholder="github" /></label>
      <label class="champ">Genre<select bind:value={nouveau.kind}>{#each Object.entries(GENRES) as [g, n]}<option value={g}>{n}</option>{/each}</select></label>
      <label class="champ">Description<input bind:value={nouveau.description} placeholder="Ex. : dépôts de Retux" /></label>
      <label class="champ">Clé ou mot de passe (va au coffre du cerveau, chiffré ; jamais réaffiché)<input type="password" autocomplete="off" bind:value={nouveau.secret} /></label>
      <div class="ligne">
        <button class="principal" disabled={!/^[a-z0-9_-]+$/i.test(nouveau.name)} onclick={() => { const n = nouveau!; nouveau = null; void agir(() => agl.connecteur(n)); }}>Brancher</button>
        <button onclick={() => (nouveau = null)}>Annuler</button>
      </div>
    </aside>
  {/if}
</div>

<style>
  section {
    display: grid;
    gap: 10px;
    padding: 18px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    margin-bottom: 16px;
    max-width: 900px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  .espace,
  .flex {
    flex: 1;
  }
</style>

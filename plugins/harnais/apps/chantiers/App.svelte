<script lang="ts">
  // Les chantiers : un projet long avec un agent. À gauche la discussion du chantier (sa propre mémoire), à droite le cahier
  // partagé. Quand l'agent modifie le cahier, ses modifications s'animent (barré puis écrit) et chacune s'annule.
  import { cerveau, habitant, ilYa, nomDe, Personnage, type Chantier, type ChantierResume } from "@hameau/commun";
  import { difference, type Morceau } from "../../src/diff";

  let liste = $state<ChantierResume[]>([]);
  let courant = $state<Chantier | null>(null);
  let doc = $state("");
  let message = $state("");
  let erreur = $state("");
  let etat = $state<"" | "enregistrement" | "enregistre">("");
  let modifs = $state<{ avant: string; morceaux: Morceau[]; par: string } | null>(null);
  let annulables = $state<string[]>([]);
  let nouveauTitre = $state("");
  let creation = $state(false);
  let derniereVersionVue = "";
  let frappe = 0;

  const ouverts = $derived(liste.filter((c) => c.actif && c.titre !== "Petits mots"));

  async function chargerListe(): Promise<void> {
    try {
      liste = await cerveau.chantiers();
      if (!courant && ouverts[0]) await ouvrir(ouverts[0].id);
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void chargerListe();

  async function ouvrir(id: number): Promise<void> {
    courant = await cerveau.chantier(id);
    doc = courant.doc;
    derniereVersionVue = courant.doc;
    modifs = null;
    annulables = [];
  }

  // relecture régulière : nouveaux messages, et modifications du cahier faites par l'agent
  $effect(() => {
    const t = setInterval(async () => {
      if (!courant) return;
      try {
        const c = await cerveau.chantier(courant.id);
        courant = { ...c, doc: courant.doc };
        if (c.doc !== derniereVersionVue && Date.now() - frappe > 3000) {
          modifs = { avant: doc, morceaux: difference(doc, c.doc), par: c.agent };
          annulables = [...annulables, doc];
          doc = c.doc;
          derniereVersionVue = c.doc;
          setTimeout(() => (modifs = null), 6000);
        }
      } catch {
        /* la prochaine relecture réessaiera */
      }
    }, 4000);
    return () => clearInterval(t);
  });

  // le cahier s'enregistre tout seul une seconde après la dernière frappe
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  function frapper(): void {
    frappe = Date.now();
    etat = "enregistrement";
    clearTimeout(minuterie);
    minuterie = setTimeout(async () => {
      if (!courant) return;
      try {
        await cerveau.modifierChantier(courant.id, { doc });
        derniereVersionVue = doc;
        etat = "enregistre";
      } catch (e) {
        erreur = (e as Error).message;
      }
    }, 1000);
  }

  async function annulerDerniere(): Promise<void> {
    const avant = annulables.pop();
    if (avant === undefined || !courant) return;
    annulables = [...annulables];
    doc = avant;
    modifs = null;
    await cerveau.modifierChantier(courant.id, { doc });
    derniereVersionVue = doc;
  }

  async function envoyer(texte = message): Promise<void> {
    if (!texte.trim() || !courant) return;
    try {
      await cerveau.ecrireChantier(courant.id, texte.trim());
      message = "";
      await ouvrir(courant.id);
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function creer(): Promise<void> {
    const titre = nouveauTitre.trim();
    if (!titre) return;
    try {
      await cerveau.creerChantier(titre, "");
      creation = false;
      nouveauTitre = "";
      liste = await cerveau.chantiers();
      const c = liste.find((x) => x.titre === titre) ?? liste[0];
      if (c) await ouvrir(c.id);
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function avancer(v: number): Promise<void> {
    if (!courant) return;
    courant.avancement = v;
    await cerveau.modifierChantier(courant.id, { progress: v });
  }
</script>

<div class="page">
  <header>
    <label class="choix">
      <span class="petit">Chantier</span>
      <select class="saisie" value={courant?.id ?? ""} onchange={(e) => ouvrir(Number((e.currentTarget as HTMLSelectElement).value))}>
        {#each ouverts as c}<option value={c.id}>🏗️ {c.titre} · {c.avancement} %</option>{/each}
      </select>
    </label>
    {#if courant}
      <label class="avancement">
        <span class="petit">Avancement {courant.avancement} %</span>
        <input type="range" min="0" max="100" value={courant.avancement} onchange={(e) => avancer(Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
    {/if}
    <button class="btn" onclick={() => (creation = !creation)}>+ Nouveau chantier</button>
  </header>
  {#if creation}
    <form class="creation" onsubmit={(e) => (e.preventDefault(), creer())}>
      <input class="saisie" bind:value={nouveauTitre} placeholder="Nom du chantier (ex. Étude chaudronnerie)" aria-label="Nom du nouveau chantier" />
      <button class="btn primary" type="submit">Ouvrir le chantier</button>
    </form>
  {/if}
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

  {#if courant}
    <div class="split">
      <section class="discu" aria-label="Discussion du chantier">
        <div class="msgs">
          {#each courant.messages as m (m.id)}
            <div class="msg" class:moi={!habitant(m.auteur)}>
              {#if habitant(m.auteur)}<Personnage qui={habitant(m.auteur)} taille={24} />{/if}
              <div><span>{m.texte}</span><small>{nomDe(m.auteur)} · {ilYa(m.quand)}</small></div>
            </div>
          {:else}
            <p class="petit">Parle à {nomDe(courant.agent)} ici : il garde le fil de ce chantier sans encombrer le reste.</p>
          {/each}
        </div>
        <form onsubmit={(e) => (e.preventDefault(), envoyer())}>
          <input class="saisie" bind:value={message} placeholder="Parler à {nomDe(courant.agent)} dans ce chantier…" aria-label="Message" />
          <button class="btn primary" type="submit">Envoyer</button>
        </form>
      </section>

      <section class="doc" aria-label="Cahier partagé">
        <div class="doc-tete">
          <b>📄 Cahier</b>
          <span class="petit">{etat === "enregistrement" ? "…" : etat === "enregistre" ? "Enregistré" : ""}</span>
          <button class="btn" onclick={() => envoyer("Remets de l'ordre dans le cahier : regroupe, reformule, garde toutes mes idées. Pose-moi tes questions ici.")}>✨ {nomDe(courant.agent)}, remets de l'ordre</button>
          <button class="btn" onclick={annulerDerniere} disabled={!annulables.length}>↶ Annuler sa modif</button>
        </div>
        {#if modifs}
          <div class="modifs" aria-live="polite">
            <div class="qui-modifie"><Personnage qui={habitant(modifs.par)} taille={22} anime /> {nomDe(modifs.par)} vient de modifier le cahier</div>
            <pre>{#each modifs.morceaux as m}{#if m.genre === "garde"}{m.texte}{:else if m.genre === "retire"}<del>{m.texte}</del>{:else}<ins>{m.texte}</ins>{/if}{/each}</pre>
          </div>
        {:else}
          <textarea class="cahier" bind:value={doc} oninput={frapper} placeholder="Vide ce que tu as en tête, même en vrac : {nomDe(courant.agent)} t'aidera à le ranger." aria-label="Cahier"></textarea>
        {/if}
      </section>
    </div>
  {:else}
    <div class="vide">
      <p>🏗️ Aucun chantier ouvert. Ouvre-en un, ou dis à Max en Petit mot : il te proposera d'en lancer un quand un sujet grandit.</p>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 20px;
    display: grid;
    grid-template-rows: auto auto auto 1fr;
    gap: 12px;
    height: 100vh;
    box-sizing: border-box;
  }
  header {
    display: flex;
    gap: 14px;
    align-items: end;
    flex-wrap: wrap;
  }
  .choix,
  .avancement {
    display: grid;
    gap: 2px;
  }
  .choix {
    margin-right: auto;
    min-width: 260px;
  }
  .creation {
    display: flex;
    gap: 8px;
  }
  .creation input {
    flex: 1;
  }
  .split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 16px;
    min-height: 0;
  }
  .discu,
  .doc {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    animation: entre 0.35s ease-out;
  }
  .doc {
    animation-delay: 0.08s;
    animation-fill-mode: both;
  }
  @keyframes entre {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
  }
  .msgs {
    flex: 1;
    overflow: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .msg {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    max-width: 88%;
  }
  .msg > div {
    padding: 8px 11px;
    border-radius: 12px;
    background: var(--surface-2);
    display: grid;
    gap: 2px;
    white-space: pre-wrap;
  }
  .msg.moi {
    align-self: flex-end;
  }
  .msg.moi > div {
    background: var(--accent-soft);
  }
  .msg small {
    color: var(--muted);
    font-size: 11px;
  }
  form {
    display: flex;
    gap: 8px;
    padding: 10px;
    border-top: 1px solid var(--border);
  }
  form input {
    flex: 1;
  }
  .creation {
    border-top: 0;
    padding: 0;
  }
  .doc-tete {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .doc-tete b {
    margin-right: auto;
  }
  .cahier {
    flex: 1;
    border: 0;
    resize: none;
    padding: 16px 18px;
    font: 15px/1.7 ui-monospace, "Cascadia Code", Consolas, monospace;
    background: transparent;
    color: var(--text);
    outline: none;
  }
  .modifs {
    flex: 1;
    overflow: auto;
    padding: 12px 18px;
  }
  .qui-modifie {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 600;
    margin-bottom: 8px;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    font: 15px/1.7 ui-monospace, "Cascadia Code", Consolas, monospace;
  }
  del {
    color: #c4493a;
    text-decoration-thickness: 2px;
    animation: efface 1.6s ease-in forwards;
    animation-delay: 1.2s;
  }
  ins {
    background: #d8f2df;
    color: #1f5a35;
    text-decoration: none;
    border-radius: 3px;
    animation: ecrit 0.8s ease-out both;
  }
  @keyframes efface {
    to {
      opacity: 0.25;
    }
  }
  @keyframes ecrit {
    from {
      background: #9fe0b4;
      opacity: 0;
    }
  }
  .vide {
    display: grid;
    place-items: center;
    color: var(--muted);
    text-align: center;
  }
  .erreur {
    color: #c0392b;
    margin: 0;
  }
  @media (max-width: 900px) {
    .split {
      grid-template-columns: 1fr;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .discu,
    .doc,
    del,
    ins {
      animation: none;
    }
  }
</style>

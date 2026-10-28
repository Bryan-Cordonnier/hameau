<script lang="ts">
  // Les tâches, façon Trello : des tableaux empilés (Automatisations tout en haut), chacun avec ses agents et 4 colonnes.
  // Une carte : son titre ; en cours, une barre d'avancement ; bloquée ou terminée, « Voir le rapport ». Clic : la carte s'agrandit.
  // Bryan range les cartes en hauteur (la plus haute = la plus urgente) ; seuls les agents les changent de colonne.
  import { connect } from "@etabli/sdk";
  import { agl, ilYa, nomAffiche, NOMS_STATUT, Recherche, type Carte, type EtatAgl, type Statut, type Tableau } from "@hameau/commun";
  import { colonnes, COLONNES, deplacer } from "../../src/outils";

  let etat = $state<EtatAgl | null>(null);
  let archives = $state<Carte[] | null>(null);
  let erreur = $state("");
  let ouverte = $state<number | null>(null);
  let nouvelle = $state<{ board: number; title: string; instructions: string; due: string; agents: string[]; objective: number } | null>(null);
  let reglage = $state<{ id?: number; name: string; emoji: string; tous: boolean; agents: string[] } | null>(null);
  let reponse = $state("");

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
    const t = setInterval(() => void charger(), 15000);
    return () => clearInterval(t);
  });
  void connect().then((e) => {
    const d = e.incoming?.data as { id?: number; tableau?: number } | undefined;
    if (e.incoming?.kind === "carte" && d?.id) ouverte = d.id;
    if (e.incoming?.kind === "carte" && d?.tableau) setTimeout(() => document.getElementById(`t${d.tableau}`)?.scrollIntoView(), 300);
  });
  async function agir(f: () => Promise<unknown>): Promise<void> {
    try {
      await f();
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  const carte = $derived(etat?.cartes.find((c) => c.id === ouverte) ?? archives?.find((c) => c.id === ouverte) ?? null);
  const agentsDe = (t: Tableau) => (t.agents.length ? t.agents : (etat?.agents.map((a) => a.nom) ?? []));
  const objectifsDe = (t: Tableau) => etat?.projets.find((p) => p.id === t.projet)?.objectifs ?? [];
  const date = (s: number | null) => (s ? new Date(s * 1000).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  // ranger une carte en hauteur dans sa colonne
  let tire = $state<Carte | null>(null);
  async function deposer(cible: Carte, cols: Record<Statut, Carte[]>): Promise<void> {
    const t = tire;
    tire = null;
    if (!t || t.id === cible.id || t.statut !== cible.statut || t.tableau !== cible.tableau) return;
    const ids = cols[t.statut].map((c) => c.id);
    await agir(() => agl.ordonnerCartes(deplacer(ids, t.id, ids.indexOf(cible.id))));
  }
  function nouvelleCarte(t: Tableau): void {
    nouvelle = { board: t.id, title: "", instructions: "", due: "", agents: [], objective: 0 };
  }
  async function creer(): Promise<void> {
    const n = nouvelle!;
    nouvelle = null;
    await agir(() => agl.creerCarte({ board: n.board, title: n.title, instructions: n.instructions, due: n.due || undefined, agents: n.agents, objective: n.objective || undefined }));
  }
  async function voirArchives(): Promise<void> {
    archives = archives ? null : await agl.cartesArchivees().catch(() => []);
  }
</script>

<Recherche ouvrir={(g, id) => g === "carte" && (ouverte = Number(id))} />
<div class="agl">
  <div class="entete">
    <h1>Tâches</h1>
    <span class="espace"></span>
    <button onclick={voirArchives}>{archives ? "Masquer les archives" : "🗄️ Archives"}</button>
    <button class="principal" onclick={() => (reglage = { name: "", emoji: "📋", tous: true, agents: [] })}>+ Tableau</button>
  </div>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}

  {#if archives}
    <div class="archives">
      <b>Cartes archivées</b>
      {#each archives as c}<button class="ligne-archive" onclick={() => (ouverte = c.id)}>{c.titre}<span class="sous">{NOMS_STATUT[c.statut]} · {date(c.fin ?? c.cree)}</span></button>{:else}<p class="vide">Aucune.</p>{/each}
    </div>
  {/if}

  {#if etat}
    {#each etat.tableaux as t (t.id)}
      {@const cols = colonnes(etat.cartes, t.id)}
      {@const projet = etat.projets.find((p) => p.id === t.projet)}
      <section class="tableau" id="t{t.id}" class:eteint={projet && !projet.actif_effectif}>
        <div class="ligne tete">
          <span class="gros">{t.emoji}</span><b>{t.nom}</b>
          {#if projet && !projet.actif_effectif}<span class="pastille">⏸️ projet en pause</span>{/if}
          <span class="pastille">{t.agents.length ? t.agents.map((a) => nomAffiche(a)).join(", ") : "Tous les agents"}</span>
          {#if t.special !== "automatisations"}<button class="petit" onclick={() => (reglage = { id: t.id, name: t.nom, emoji: t.emoji, tous: !t.agents.length, agents: [...t.agents] })}>Régler</button>{/if}
        </div>
        <div class="colonnes">
          {#each COLONNES as s}
            <div class="colonne">
              <div class="ligne titre-col"><span>{NOMS_STATUT[s]}</span><span class="sous">{cols[s].length}</span>
                {#if s === "a_faire" && t.special !== "automatisations"}<button class="petit plus" onclick={() => nouvelleCarte(t)} title="Nouvelle carte">+</button>{/if}
              </div>
              {#each cols[s] as c (c.id)}
                <div
                  class="carte"
                  role="button"
                  tabindex="0"
                  draggable="true"
                  ondragstart={() => (tire = c)}
                  ondragover={(e) => e.preventDefault()}
                  ondrop={() => deposer(c, cols)}
                  onclick={() => (ouverte = c.id)}
                  onkeydown={(e) => e.key === "Enter" && (ouverte = c.id)}
                >
                  <div class="ctitre">{c.titre}</div>
                  {#if s === "en_cours"}<div class="barre"><div style="width:{c.avancement ?? 5}%"></div></div>{/if}
                  {#if s === "bloque" || s === "termine"}<span class="rapport">Voir le rapport</span>{/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}

  {#if nouvelle}
    {@const t = etat?.tableaux.find((x) => x.id === nouvelle?.board)}
    <div class="voile" role="presentation" onclick={() => (nouvelle = null)}></div>
    <aside class="panneau">
      <h2>Nouvelle carte · {t?.emoji} {t?.nom}</h2>
      <label class="champ">Titre<input bind:value={nouvelle.title} placeholder="Ex. : Lot 10 - Site Retux" /></label>
      <label class="champ">Consigne (ce qu'il faut faire, en détail)<textarea rows="8" bind:value={nouvelle.instructions}></textarea></label>
      <label class="champ">Échéance (facultative)<input type="date" bind:value={nouvelle.due} /></label>
      {#if t && objectifsDe(t).length}
        <label class="champ">Objectif de la road map<select bind:value={nouvelle.objective}><option value={0}>— aucun —</option>{#each objectifsDe(t) as o}<option value={o.id}>{o.titre}</option>{/each}</select></label>
      {/if}
      <div>
        <div class="sous">Qui la fait : n'importe quel agent du tableau, ou ceux que tu choisis (dans l'ordre de priorité).</div>
        <div class="ligne">
          {#each t ? agentsDe(t) : [] as a}
            {@const pos = nouvelle.agents.indexOf(a)}
            <button class="petit" class:principal={pos >= 0} onclick={() => (nouvelle!.agents = pos >= 0 ? nouvelle!.agents.filter((x) => x !== a) : [...nouvelle!.agents, a])}>{pos >= 0 ? `${pos + 1}. ` : ""}{nomAffiche(a)}</button>
          {/each}
        </div>
      </div>
      <div class="ligne">
        <button class="principal" disabled={!nouvelle.title.trim() || !nouvelle.instructions.trim()} onclick={creer}>Créer</button>
        <button onclick={() => (nouvelle = null)}>Annuler</button>
      </div>
    </aside>
  {/if}

  {#if reglage}
    <div class="voile" role="presentation" onclick={() => (reglage = null)}></div>
    <aside class="panneau">
      <h2>{reglage.id ? "Régler le tableau" : "Nouveau tableau"}</h2>
      <div class="ligne"><input class="emoji" bind:value={reglage.emoji} maxlength="4" /><input bind:value={reglage.name} placeholder="Nom du tableau" /></div>
      <label class="ligne"><input type="radio" checked={reglage.tous} onchange={() => (reglage!.tous = true)} /> Tous les agents y ont accès</label>
      <label class="ligne"><input type="radio" checked={!reglage.tous} onchange={() => (reglage!.tous = false)} /> Seulement :</label>
      {#if !reglage.tous}
        <div class="ligne">
          {#each etat?.agents ?? [] as a}<label class="pastille"><input type="checkbox" checked={reglage.agents.includes(a.nom)} onchange={(e) => (reglage!.agents = e.currentTarget.checked ? [...reglage!.agents, a.nom] : reglage!.agents.filter((x) => x !== a.nom))} /> {a.emoji} {nomAffiche(a.nom)}</label>{/each}
        </div>
      {/if}
      <div class="ligne">
        <button class="principal" disabled={!reglage.name.trim()} onclick={() => { const r = reglage!; reglage = null; void agir(() => agl.tableau({ id: r.id, name: r.name, emoji: r.emoji, agents: r.tous ? [] : r.agents })); }}>Enregistrer</button>
        {#if reglage.id}<button class="danger" onclick={() => { const id = reglage!.id; reglage = null; void agir(() => agl.tableau({ id, archived: true })); }}>Archiver le tableau</button>{/if}
      </div>
    </aside>
  {/if}

  {#if carte}
    <div class="voile" role="presentation" onclick={() => (ouverte = null)}></div>
    <aside class="panneau">
      <div class="ligne"><h2 class="flex">{carte.titre}</h2><span class="pastille">{NOMS_STATUT[carte.statut]}</span><button onclick={() => (ouverte = null)}>✕</button></div>
      <div class="infos">
        <span class="sous">Qui s'en occupe</span><span>{carte.agent ? nomAffiche(carte.agent) : carte.agents.length ? `${carte.agents.map((a) => nomAffiche(a)).join(" → ")} (par priorité)` : "N'importe quel agent du tableau"}</span>
        <span class="sous">Créée</span><span>{date(carte.cree)} {carte.cree_par ? `par ${nomAffiche(carte.cree_par)}` : ""}</span>
        <span class="sous">Échéance</span><span>{carte.echeance || "—"}</span>
        {#if carte.debut}<span class="sous">Commencée</span><span>{date(carte.debut)}</span>{/if}
        {#if carte.fin}<span class="sous">Finie</span><span>{date(carte.fin)}</span>{/if}
      </div>
      {#if carte.statut === "en_cours"}<div class="barre"><div style="width:{carte.avancement ?? 5}%"></div></div>{/if}
      {#if carte.rapport}
        <div class="bloc-rapport" class:bloque={carte.statut === "bloque"}>
          <b>{carte.statut === "bloque" ? "✋ Bloquée — le rapport" : "Rapport"}</b>
          <pre class="texte">{carte.rapport}</pre>
        </div>
      {/if}
      {#if carte.statut === "bloque" && !carte.archive}
        <label class="champ">Ta réponse (la suite repart dans « À faire » : « {carte.titre.split(" #")[0]} #{carte.numero + 1} »)
          <textarea rows="7" bind:value={reponse}></textarea>
        </label>
        <button class="principal" disabled={!reponse.trim()} onclick={() => { const r = reponse; reponse = ""; const id = carte.id; ouverte = null; void agir(() => agl.repondreCarte(id, r)); }}>Envoyer la réponse</button>
      {/if}
      {#if carte.etapes.length}
        <div><b>Étapes</b><ol class="etapes">{#each carte.etapes as e}<li>{e.texte} <span class="sous">{ilYa(e.quand)}</span></li>{/each}</ol></div>
      {/if}
      <details><summary>Consigne</summary><pre class="texte">{carte.consigne}</pre></details>
      {#if carte.statut === "a_faire" && !carte.archive}
        <div class="ligne">
          <button class="petit danger" onclick={() => { const id = carte.id; ouverte = null; void agir(() => agl.modifierCarte(id, { archived: true })); }}>Retirer la carte</button>
        </div>
      {/if}
    </aside>
  {/if}
</div>

<style>
  .tableau {
    margin-bottom: 26px;
  }
  .tete {
    margin-bottom: 10px;
  }
  .gros {
    font-size: 20px;
  }
  .eteint {
    opacity: 0.55;
  }
  .colonnes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .colonne {
    background: var(--surface-2);
    border-radius: 12px;
    padding: 10px;
    display: grid;
    gap: 8px;
    align-content: start;
    min-height: 90px;
  }
  .titre-col {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .plus {
    margin-left: auto;
  }
  .carte {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid transparent;
    cursor: pointer;
    display: grid;
    gap: 8px;
  }
  .carte:hover {
    border-color: var(--muted);
  }
  .ctitre {
    font-weight: 600;
    font-size: 13px;
  }
  .rapport {
    font-size: 12px;
    color: var(--muted);
    text-decoration: underline;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .flex {
    flex: 1;
  }
  .infos {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 6px 10px;
  }
  .bloc-rapport {
    padding: 12px;
    border-radius: 12px;
    background: var(--surface-2);
    display: grid;
    gap: 6px;
  }
  .bloc-rapport.bloque {
    border: 1px solid #d9534f;
  }
  .etapes {
    margin: 6px 0;
    padding-left: 20px;
    display: grid;
    gap: 4px;
  }
  .emoji {
    width: 56px !important;
    text-align: center;
  }
  .archives {
    display: grid;
    gap: 4px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 18px;
    max-height: 260px;
    overflow: auto;
  }
  .ligne-archive {
    display: flex !important;
    justify-content: space-between;
    border: 0 !important;
    text-align: left;
  }
</style>

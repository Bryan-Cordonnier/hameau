<script lang="ts">
  // Les automatisations : chacune crée une carte dans le tableau « Automatisations » quand son déclencheur arrive (une heure,
  // ou un événement écouté par un programme sans IA). Créées éteintes ; l'interrupteur les allume.
  import { agl, ilYa, nomAffiche, Recherche, type Automatisation, type Condition, type Declencheur, type EtatAgl } from "@hameau/commun";
  import { CATALOGUE, enMots } from "../../src/outils";

  let etat = $state<EtatAgl | null>(null);
  let erreur = $state("");
  let ed = $state<{
    id?: number;
    name: string;
    agent: string;
    project: number;
    trigger: Declencheur;
    instructions: string;
    boxed: boolean;
    garde: boolean;
    calls: number;
    period: string;
  } | null>(null);

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
      await f();
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const OPS: Record<string, string> = { contient: "contient", ne_contient_pas: "ne contient pas", egal: "est", different: "n'est pas", sup: ">", inf: "<", vrai: "oui", faux: "non" };
  const date = (s: number | null) => (s ? new Date(s * 1000).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const ETATS_DECL: Record<string, string> = { lance: "lancée", reporte: "reportée (garde-fou)", attente_credits: "en attente de crédits", en_attente: "en attente" };

  function editer(a?: Automatisation): void {
    ed = a
      ? { id: a.id, name: a.nom, agent: a.agent, project: a.projet ?? 0, trigger: structuredClone($state.snapshot(a.declencheur)) as Declencheur, instructions: a.consigne, boxed: a.emboite, garde: !!a.garde.calls, calls: a.garde.calls ?? 5, period: a.garde.period ?? "jour" }
      : { name: "", agent: "max", project: 0, trigger: { type: "temps", times: ["08:00"], days: [] }, instructions: "", boxed: false, garde: false, calls: 5, period: "jour" };
    if (ed.trigger.type === "evenement" && !ed.trigger.filters?.conditions) ed.trigger.filters = { mode: "et", conditions: ed.trigger.filters?.field ? [ed.trigger.filters] : [] };
  }
  function changerType(t: "temps" | "evenement"): void {
    ed!.trigger = t === "temps" ? { type: "temps", times: ["08:00"], days: [] } : { type: "evenement", source: "mail", event: "mail_recu", filters: { mode: "et", conditions: [] } };
  }
  const champs = $derived(ed?.trigger.type === "evenement" ? (CATALOGUE[ed.trigger.source ?? "mail"]?.evenements[ed.trigger.event ?? ""] ?? []) : []);
  async function enregistrer(): Promise<void> {
    const e = ed!;
    const c = { name: e.name, agent: e.agent, project: e.project || null, trigger: e.trigger, instructions: e.instructions, boxed: e.boxed, guard: e.garde ? { calls: e.calls, period: e.period } : null };
    ed = null;
    await agir(() => agl.automatisation({ id: e.id, ...c }));
  }
</script>

{#snippet groupe(g: Condition, profondeur: number)}
  <div class="groupe-cond" class:sous={profondeur > 0}>
    <div class="ligne">
      <select class="mode" bind:value={g.mode}><option value="et">Toutes ces conditions (ET)</option><option value="ou">Une de ces conditions (OU)</option></select>
    </div>
    {#each g.conditions ?? [] as c, i}
      {#if c.conditions}
        {@render groupe(c, profondeur + 1)}
      {:else}
        <div class="ligne cond">
          <select bind:value={c.field}>{#each champs as ch}<option value={ch.champ}>{ch.nom}</option>{/each}</select>
          <select bind:value={c.op}>
            {#each Object.entries(OPS).filter(([o]) => { const g2 = champs.find((x) => x.champ === c.field)?.genre; return g2 === "oui" ? o === "vrai" || o === "faux" : g2 === "nombre" ? ["egal", "different", "sup", "inf"].includes(o) : !["sup", "inf", "vrai", "faux"].includes(o); }) as [o, n]}<option value={o}>{n}</option>{/each}
          </select>
          {#if c.op !== "vrai" && c.op !== "faux"}<input bind:value={c.value} placeholder="valeur" />{/if}
          <button class="petit" onclick={() => g.conditions!.splice(i, 1)}>✕</button>
        </div>
      {/if}
    {/each}
    <div class="ligne">
      <button class="petit" disabled={!champs.length} onclick={() => (g.conditions = [...(g.conditions ?? []), { field: champs[0]?.champ, op: champs[0]?.genre === "oui" ? "vrai" : "contient", value: "" }])}>+ Condition</button>
      {#if profondeur < 2}<button class="petit" onclick={() => (g.conditions = [...(g.conditions ?? []), { mode: g.mode === "et" ? "ou" : "et", conditions: [] }])}>+ Groupe {g.mode === "et" ? "OU" : "ET"}</button>{/if}
    </div>
  </div>
{/snippet}

<Recherche />
<div class="agl">
  <div class="entete">
    <h1>Automatisations</h1>
    <span class="sous">Chacune crée une carte dans le tableau « Automatisations ». Une nouvelle automatisation est créée éteinte.</span>
    <span class="espace"></span>
    <button class="principal" onclick={() => editer()}>+ Automatisation</button>
  </div>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}
  {#if etat?.tout_arrete}<p class="pastille">⏸️ Tout est arrêté (Paramètres AGL) : aucune automatisation ne part.</p>{/if}
  <div class="pile">
    {#each etat?.automatisations ?? [] as a (a.id)}
      {@const ag = etat?.agents.find((x) => x.nom === a.agent)}
      <div class="carte-h" role="button" tabindex="0" onclick={() => editer(a)} onkeydown={(e) => e.key === "Enter" && editer(a)}>
        <span class="gros">{a.declencheur.type === "temps" ? "⏰" : "⚡"}</span>
        <div class="milieu">
          <b>{a.nom}</b>
          <div class="sous">{enMots(a.declencheur)}{a.emboite ? " · emboîtée" : ""}{a.garde.calls ? ` · max ${a.garde.calls} par ${a.garde.period}` : ""}</div>
        </div>
        <div class="infos">
          <span class="sous">{ag ? `${ag.emoji} ${nomAffiche(ag.nom)}` : "N'importe quel agent"}{ag?.etat === "sans_credits" ? " · 🪫 plus de crédits" : ""}</span>
          <span class="sous">{a.actif && a.prochaine ? `Prochaine : ${date(a.prochaine)}` : a.actif ? "Attend un événement" : "Éteinte"}</span>
          {#if a.dernier_resultat}<span class="sous resultat" title={a.dernier_resultat}>Dernier : {a.dernier_resultat}</span>{/if}
        </div>
        <label class="interrupteur" title={a.actif ? "Éteindre" : "Allumer"}>
          <input type="checkbox" checked={a.actif} onclick={(e) => e.stopPropagation()} onchange={(e) => agir(() => agl.automatisation({ id: a.id, active: e.currentTarget.checked }))} />
          <span></span>
        </label>
      </div>
    {:else}
      <p class="vide">Aucune automatisation.</p>
    {/each}
  </div>

  {#if ed}
    <div class="voile" role="presentation" onclick={() => (ed = null)}></div>
    <aside class="panneau">
      <h2>{ed.id ? "Automatisation" : "Nouvelle automatisation"}</h2>
      <label class="champ">Nom<input bind:value={ed.name} /></label>
      <div class="ligne">
        <label class="champ flex">Agent<select bind:value={ed.agent}><option value="">N'importe lequel</option>{#each etat?.agents ?? [] as ag}<option value={ag.nom}>{ag.emoji} {nomAffiche(ag.nom)}</option>{/each}</select></label>
        <label class="champ flex">Projet<select bind:value={ed.project}><option value={0}>— aucun —</option>{#each etat?.projets ?? [] as p}<option value={p.id}>{p.emoji} {p.nom}</option>{/each}</select></label>
      </div>
      <div class="ligne">
        <button class:principal={ed.trigger.type === "temps"} onclick={() => changerType("temps")}>⏰ À l'heure</button>
        <button class:principal={ed.trigger.type === "evenement"} onclick={() => changerType("evenement")}>⚡ Sur un événement</button>
      </div>
      {#if ed.trigger.type === "temps"}
        <div class="ligne">
          <label class="ligne"><input type="radio" checked={!ed.trigger.every_minutes} onchange={() => { ed!.trigger = { type: "temps", times: ["08:00"], days: [] }; }} /> À des heures</label>
          <label class="ligne"><input type="radio" checked={!!ed.trigger.every_minutes} onchange={() => { ed!.trigger = { type: "temps", every_minutes: 60 }; }} /> Toutes les…</label>
        </div>
        {#if ed.trigger.every_minutes}
          <label class="champ">Minutes entre deux passages<input type="number" min="1" bind:value={ed.trigger.every_minutes} /></label>
        {:else}
          <div class="ligne">
            {#each ed.trigger.times ?? [] as _, i}<input type="time" class="heure" bind:value={ed.trigger.times![i]} /><button class="petit" onclick={() => ed!.trigger.times!.splice(i, 1)}>✕</button>{/each}
            <button class="petit" onclick={() => (ed!.trigger.times = [...(ed!.trigger.times ?? []), "12:00"])}>+ Heure</button>
          </div>
          <div class="ligne">
            {#each JOURS as j, i}
              {@const n = i + 1}
              <button class="petit" class:principal={ed.trigger.days?.includes(n)} onclick={() => (ed!.trigger.days = ed!.trigger.days?.includes(n) ? ed!.trigger.days.filter((x) => x !== n) : [...(ed!.trigger.days ?? []), n])}>{j}</button>
            {/each}
            <span class="sous">{ed.trigger.days?.length ? "" : "tous les jours"}</span>
          </div>
        {/if}
      {:else}
        <div class="ligne">
          <label class="champ flex">Connecteur
            <select bind:value={ed.trigger.source} onchange={() => { ed!.trigger.event = Object.keys(CATALOGUE[ed!.trigger.source ?? "mail"]!.evenements)[0]; ed!.trigger.filters = { mode: "et", conditions: [] }; }}>
              {#each Object.entries(CATALOGUE) as [s, c]}<option value={s}>{c.nom}</option>{/each}
            </select>
          </label>
          <label class="champ flex">Événement
            <select bind:value={ed.trigger.event} onchange={() => (ed!.trigger.filters = { mode: "et", conditions: [] })}>
              {#each Object.keys(CATALOGUE[ed.trigger.source ?? "mail"]?.evenements ?? {}) as ev}<option value={ev}>{enMots({ type: "evenement", event: ev })}</option>{/each}
            </select>
          </label>
        </div>
        {#if champs.length}
          <div><b>Filtres</b><span class="sous"> — sans filtre, chaque événement de ce type déclenche</span></div>
          {@render groupe(ed.trigger.filters!, 0)}
        {/if}
        <label class="ligne"><input type="checkbox" bind:checked={ed.boxed} /> <b>Emboîter l'événement</b> <span class="sous">l'IA reçoit seulement le contenu de l'événement, sans autre accès</span></label>
      {/if}
      <label class="champ">Consigne donnée à l'agent<textarea rows="7" bind:value={ed.instructions}></textarea></label>
      <label class="ligne"><input type="checkbox" bind:checked={ed.garde} /> Garde-fou</label>
      {#if ed.garde}
        <div class="ligne">
          <input type="number" min="1" class="court" bind:value={ed.calls} /> <span>appels au plus par</span>
          <select class="court2" bind:value={ed.period}><option value="heure">heure</option><option value="jour">jour</option><option value="semaine">semaine</option><option value="mois">mois</option></select>
          <span class="sous">au-delà : reporté à la période suivante</span>
        </div>
      {/if}
      <div class="ligne">
        <button class="principal" disabled={!ed.name.trim() || !ed.instructions.trim()} onclick={enregistrer}>Enregistrer</button>
        {#if ed.id}<button class="danger" onclick={() => { const id = ed!.id; ed = null; void agir(() => agl.automatisation({ id, delete: true })); }}>Supprimer</button>{/if}
      </div>
      {#if ed.id}
        {@const a = etat?.automatisations.find((x) => x.id === ed?.id)}
        {#if a?.historique.length}
          <details><summary class="sous">Historique</summary>
            <ul class="histo">{#each a.historique as h}<li class="sous">{ilYa(h.quand)} — {ETATS_DECL[h.etat] ?? h.etat}{h.carte ? ` (carte ${h.carte})` : ""}</li>{/each}</ul>
          </details>
        {/if}
      {/if}
    </aside>
  {/if}
</div>

<style>
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .gros {
    font-size: 24px;
  }
  .milieu {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .infos {
    width: 280px;
    display: grid;
    gap: 2px;
  }
  .resultat {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .flex {
    flex: 1;
  }
  .heure {
    width: 110px !important;
  }
  .court {
    width: 70px !important;
  }
  .court2 {
    width: 120px !important;
  }
  .groupe-cond {
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .groupe-cond.sous {
    margin-left: 14px;
    background: var(--surface-2);
  }
  .cond select {
    width: auto;
  }
  .cond input {
    flex: 1;
    width: auto;
  }
  .mode {
    width: auto !important;
  }
  .interrupteur {
    position: relative;
    width: 44px;
    height: 24px;
    flex: none;
  }
  .interrupteur input {
    position: absolute;
    opacity: 0;
    inset: 0;
    cursor: pointer;
    z-index: 1;
    margin: 0;
  }
  .interrupteur span {
    position: absolute;
    inset: 0;
    border-radius: 99px;
    background: var(--field);
    border: 1px solid var(--border);
  }
  .interrupteur span::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--muted);
    transition: left 0.15s;
  }
  .interrupteur input:checked + span {
    background: var(--accent);
  }
  .interrupteur input:checked + span::after {
    left: 23px;
    background: var(--accent-text);
  }
  .histo {
    margin: 6px 0;
    padding-left: 18px;
  }
</style>

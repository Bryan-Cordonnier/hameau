<script lang="ts">
  // Les agents : des cartes horizontales empilées (nom, rôle, moteur ; état, dernière activité ; avatar), un interrupteur
  // pause / reprise et « Tout arrêter ». La fiche : identité, rôle (versionné), permissions, moteur, carnet, activité.
  // Créer un agent : nom et émoji → rôle → moteur ; pour un accès externe, la clé s'affiche une seule fois à la fin.
  import { connect } from "@etabli/sdk";
  import { ACTIONS, agl, ilYa, nomAffiche, Pixel, Recherche, type Agent, type Droit, type EtatAgl, type Moteur } from "@hameau/commun";

  let etat = $state<EtatAgl | null>(null);
  let erreur = $state("");
  let choisi = $state<string | null>(null);
  let onglet = $state<"identite" | "role" | "permissions" | "moteur" | "carnet" | "activite">("identite");
  let cle = $state<{ agent: string; cle: string } | null>(null);
  let creation = $state<{ etape: 1 | 2 | 3; name: string; emoji: string; role: string; droits: Droit[]; moteur: Moteur } | null>(null);

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
    const t = setInterval(() => void charger(), 10000);
    return () => clearInterval(t);
  });
  void connect().then((e) => {
    if (e.incoming?.kind === "agent") choisi = String((e.incoming.data as { nom?: string }).nom ?? "") || null;
  });
  async function agir(f: () => Promise<unknown>): Promise<void> {
    try {
      await f();
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  const agent = $derived(etat?.agents.find((a) => a.nom === choisi) ?? null);
  const roleCourt = (a: Agent) => (a.consigne.split(/[.!\n]/)[0] ?? "").slice(0, 90) || "Pas encore de rôle";
  const moteurCourt = (m: Moteur) => (m.type === "api" ? `${m.modele ?? "claude-haiku-5-5"} · API` : m.type === "local" ? "Modèle local" : m.type === "externe" ? "Accès externe" : "—");
  const ETAT: Record<string, string> = { actif: "🟢 Actif", pause: "⏸️ En pause", sans_credits: "🪫 Plus de crédits" };
  const etatDe = (a: Agent) => (a.etat !== "actif" ? ETAT[a.etat] : a.en_pause ? "⏸️ En pause (projet ou tout arrêté)" : ETAT.actif);
  const sceneDe = (a: Agent) => (a.etat === "sans_credits" ? "sans_credits" : a.en_pause ? "dort" : a.activite.scene);

  // ---- fiche ----
  let ed = $state<{ emoji: string; color: string; sprite: string; role: string; droits: Droit[]; moteur: Moteur; silence: string } | null>(null);
  let carnet = $state("");
  let versions = $state<{ version: number; consigne: string; droits: Droit[]; quand: number }[]>([]);
  $effect(() => {
    if (agent && ed === null) {
      ed = { emoji: agent.emoji, color: agent.couleur, sprite: agent.perso, role: agent.consigne, droits: agent.droits.map((d) => ({ ...d })), moteur: { ...agent.moteur }, silence: agent.silence };
      carnet = agent.carnet;
      void agl.versionsRole(agent.nom).then((v) => (versions = v)).catch(() => (versions = []));
    }
  });
  function fermer(): void {
    choisi = null;
    ed = null;
    onglet = "identite";
  }
  async function enregistrer(): Promise<void> {
    if (!agent || !ed) return;
    const e = ed;
    await agir(() => agl.agent({ name: agent.nom, emoji: e.emoji, color: e.color, sprite: e.sprite, role: e.role, permissions: e.droits, engine: e.moteur, silence: e.silence }));
    versions = await agl.versionsRole(agent.nom).catch(() => versions);
  }

  async function creer(): Promise<void> {
    const c = creation!;
    try {
      const r = await agl.agent({ name: c.name, emoji: c.emoji, role: c.role, permissions: c.droits, engine: c.moteur });
      creation = null;
      if (r.cle && c.moteur.type === "externe") cle = { agent: c.name, cle: r.cle };
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  const droitsDeBase = (): Droit[] => [
    { action: "library.read", ressource: "*", niveau: "autorise" },
    { action: "hameau.read", ressource: "*", niveau: "autorise" },
    { action: "hameau.write", ressource: "*", niveau: "autorise" },
    { action: "report.write", ressource: "*", niveau: "autorise" },
  ];
</script>

{#snippet permissions(droits: Droit[])}
  <div class="droits">
    {#each droits as d, i}
      <div class="droit">
        <select bind:value={d.action}>{#if !ACTIONS.some((a) => a.action === d.action)}<option value={d.action}>{d.action}</option>{/if}{#each ACTIONS as a}<option value={a.action}>{a.nom}</option>{/each}</select>
        <input class="res" bind:value={d.ressource} title="* = tout ; un dossier du cerveau (retux/) ; mail/<boîte> ; poste/<agent> ; service/<nom>" />
        <select class="niv" bind:value={d.niveau}><option value="autorise">Oui</option><option value="confirmation">Avec ton accord</option><option value="interdit">Non</option></select>
        <button class="petit" onclick={() => droits.splice(i, 1)}>✕</button>
      </div>
    {/each}
    <button class="petit" onclick={() => droits.push({ action: "library.read", ressource: "*", niveau: "autorise" })}>+ Permission</button>
    <p class="sous">Ressource : <code>*</code> pour tout, un dossier du cerveau (<code>retux/</code>), une boîte (<code>mail/perso-infomaniak</code>), un agent pour la délégation (<code>poste/max</code> ; <code>*</code> = tous), un service branché (<code>service/github</code>).</p>
  </div>
{/snippet}

{#snippet moteur(m: Moteur)}
  <div class="ligne">
    {#each [["api", "API (Claude)"], ["local", "Modèle local"], ["externe", "Accès externe"]] as [t, n]}
      <button class:principal={m.type === t} onclick={() => (m.type = t as Moteur["type"])}>{n}</button>
    {/each}
  </div>
  {#if m.type === "api"}
    <label class="champ">Modèle<select bind:value={m.modele}><option value="claude-haiku-5-5">Claude Haiku 5.5 (le moins cher)</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option><option value="claude-opus-5-5">Claude Opus 5.5</option></select></label>
    <p class="sous">La limite de dépense se règle chez Anthropic : si les crédits sont épuisés, l'agent passe en « plus de crédits » et ses automatisations attendent.</p>
  {:else if m.type === "local"}
    <label class="champ">Adresse du serveur du modèle<input bind:value={m.url} placeholder="http://127.0.0.1:8080/v1/chat/completions" /></label>
  {:else if m.type === "externe"}
    <p class="sous">Une IA d'un abonnement externe (Claude Code…) : elle se connecte au cerveau avec une clé que l'AGL génère, et ses permissions s'appliquent.</p>
  {/if}
{/snippet}

<Recherche ouvrir={(g, id) => g === "agent" && (choisi = String(id))} />
<div class="agl">
  <div class="entete">
    <h1>Agents</h1>
    <span class="espace"></span>
    {#if etat}
      <button class:danger={!etat.tout_arrete} onclick={() => agir(() => agl.toutArreter(!etat!.tout_arrete))}>{etat.tout_arrete ? "▶️ Tout relancer" : "⏹️ Tout arrêter"}</button>
    {/if}
    <button class="principal" onclick={() => (creation = { etape: 1, name: "", emoji: "🤖", role: "", droits: droitsDeBase(), moteur: { type: "api", modele: "claude-haiku-5-5" } })}>+ Nouvel agent</button>
  </div>
  {#if erreur}<p class="erreur">{erreur}</p>{/if}

  {#if cle}
    <div class="cle">
      <b>Clé d'accès de {cle.agent}</b> — copie-la maintenant, elle ne sera plus affichée :
      <code>{cle.cle}</code>
      <div class="ligne"><button onclick={() => connect().then((e) => e.clipboard.copy(cle!.cle))}>Copier</button><button onclick={() => (cle = null)}>J'ai noté</button></div>
    </div>
  {/if}

  <div class="pile">
    {#each etat?.agents ?? [] as a (a.nom)}
      <div class="carte-h agent" style="--c:{a.couleur}" role="button" tabindex="0" onclick={() => (choisi = a.nom)} onkeydown={(e) => e.key === "Enter" && (choisi = a.nom)}>
        <div class="gauche">
          <b>{a.emoji} {nomAffiche(a.nom, etat?.agents)}{a.principal ? " · ton assistant" : ""}</b>
          <span class="sous">{roleCourt(a)}</span>
          <span class="sous">{moteurCourt(a.moteur)}</span>
        </div>
        <div class="milieu">
          <span>{etatDe(a)}</span>
          <span class="sous">{a.activite.derniere ? `${ilYa(a.activite.derniere.quand)} : ${a.activite.derniere.resume}` : "Aucune activité"}</span>
        </div>
        <label class="interrupteur" title={a.etat === "actif" ? "Mettre en pause" : "Reprendre"}>
          <input type="checkbox" checked={a.etat === "actif"} onclick={(e) => e.stopPropagation()} onchange={(e) => agir(() => agl.etatAgent(a.nom, e.currentTarget.checked ? "actif" : "pause"))} />
          <span></span>
        </label>
        <Pixel perso={a.perso} couleur={a.couleur} scene={sceneDe(a)} taille={64} />
      </div>
    {/each}
  </div>

  {#if agent && ed}
    <div class="voile" role="presentation" onclick={fermer}></div>
    <aside class="panneau">
      <div class="ligne"><Pixel perso={ed.sprite} couleur={ed.color} scene={sceneDe(agent)} taille={56} /><h2 class="flex">{agent.emoji} {nomAffiche(agent.nom)}</h2><button onclick={fermer}>✕</button></div>
      <div class="ligne onglets">
        {#each [["identite", "Identité"], ["role", "Rôle"], ["permissions", "Permissions"], ["moteur", "Moteur"], ["carnet", "Carnet"], ["activite", "Activité"]] as [o, n]}
          <button class:principal={onglet === o} onclick={() => (onglet = o as typeof onglet)}>{n}</button>
        {/each}
      </div>
      {#if onglet === "identite"}
        <div class="ligne"><label class="champ">Émoji<input class="emoji" bind:value={ed.emoji} maxlength="4" /></label><label class="champ">Couleur<input type="color" bind:value={ed.color} /></label></div>
        <label class="champ">Personnage
          <select bind:value={ed.sprite}><option value="">Petit robot</option><option value="costume">En costume</option><option value="claude">Mascotte de Claude</option></select>
        </label>
        <label class="champ">Heures de silence (HH:MM-HH:MM)<input bind:value={ed.silence} placeholder="00:00-07:00" /></label>
      {:else if onglet === "role"}
        <label class="champ">Ce que fait l'agent (sa consigne, qui s'enrichit avec le temps)<textarea rows="16" bind:value={ed.role}></textarea></label>
        {#if versions.length}
          <details><summary class="sous">Versions du rôle ({versions.length})</summary>
            <div class="pile">
              {#each versions as v}
                <div class="version"><div class="ligne"><b>Version {v.version}</b><span class="sous">{ilYa(v.quand)}</span><span class="espace"></span>
                  {#if v.version !== agent.version_role}<button class="petit" onclick={() => agir(() => agl.restaurerRole(agent.nom, v.version)).then(() => { ed = null; })}>Revenir à celle-ci</button>{/if}</div>
                  <pre class="texte petit">{v.consigne.slice(0, 600)}{v.consigne.length > 600 ? "…" : ""}</pre></div>
              {/each}
            </div>
          </details>
        {/if}
      {:else if onglet === "permissions"}
        {@render permissions(ed.droits)}
      {:else if onglet === "moteur"}
        {@render moteur(ed.moteur)}
        {#if ed.moteur.type === "externe"}
          <div class="ligne">
            <button onclick={() => agir(async () => { const r = await agl.nouvelleCle(agent.nom); cle = { agent: agent.nom, cle: r.cle }; })}>🔑 Nouvelle clé</button>
            <button class="danger" onclick={() => agir(() => agl.revoquer(agent.nom))}>Révoquer l'accès</button>
            <span class="sous">{agent.acces_actif ? "Accès actif" : "Accès révoqué"}{agent.cle_expire ? ` · expire ${new Date(agent.cle_expire * 1000).toLocaleDateString("fr-FR")}` : ""}</span>
          </div>
        {/if}
      {:else if onglet === "carnet"}
        <label class="champ">La mémoire de l'agent (gardée par l'AGL, pas dans le cerveau)<textarea rows="16" bind:value={carnet}></textarea></label>
        <button onclick={() => agir(() => agl.carnet(agent.nom, carnet))}>Enregistrer le carnet</button>
      {:else}
        <div class="infos">
          <span class="sous">État</span><span>{etatDe(agent)}</span>
          <span class="sous">En ce moment</span><span>{agent.activite.carte ? `📋 ${agent.activite.carte.titre}` : "—"}</span>
          <span class="sous">Dernière action</span><span>{agent.activite.derniere ? `${ilYa(agent.activite.derniere.quand)} — ${agent.activite.derniere.resume}` : "—"}</span>
          <span class="sous">Projets</span><span>{agent.projets.map((p) => etat?.projets.find((x) => x.id === p)?.nom).filter(Boolean).join(", ") || "—"}</span>
          <span class="sous">Coût</span><span>{agent.moteur.type === "api" ? "Suivi dans la console Anthropic (Usage)" : "Gratuit (local ou abonnement externe)"}</span>
        </div>
        {#if agent.etat === "sans_credits"}<button onclick={() => agir(() => agl.etatAgent(agent.nom, "actif"))}>J'ai rechargé les crédits : relancer</button>{/if}
      {/if}
      {#if onglet !== "carnet" && onglet !== "activite"}<button class="principal" onclick={enregistrer}>Enregistrer</button>{/if}
    </aside>
  {/if}

  {#if creation}
    <div class="voile" role="presentation" onclick={() => (creation = null)}></div>
    <aside class="panneau">
      <h2>Nouvel agent · étape {creation.etape} sur 3</h2>
      {#if creation.etape === 1}
        <div class="ligne"><input class="emoji" bind:value={creation.emoji} maxlength="4" /><input bind:value={creation.name} placeholder="nom (lettres, chiffres, -)" /></div>
        <button class="principal" disabled={!/^[a-z0-9_-]{2,40}$/i.test(creation.name)} onclick={() => (creation!.etape = 2)}>Suivant</button>
      {:else if creation.etape === 2}
        <label class="champ">Son rôle : ce qu'il fait, pour toi<textarea rows="8" bind:value={creation.role} placeholder="Ex. : Tu gères les mails de Retux et le SAV…"></textarea></label>
        <b>Ses permissions</b>
        {@render permissions(creation.droits)}
        <div class="ligne"><button onclick={() => (creation!.etape = 1)}>Retour</button><button class="principal" disabled={!creation.role.trim()} onclick={() => (creation!.etape = 3)}>Suivant</button></div>
      {:else}
        <b>Son moteur</b>
        {@render moteur(creation.moteur)}
        <div class="ligne"><button onclick={() => (creation!.etape = 2)}>Retour</button><button class="principal" onclick={creer}>Créer l'agent</button></div>
      {/if}
    </aside>
  {/if}
</div>

<style>
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .flex,
  .espace {
    flex: 1;
  }
  .agent {
    border-left: 4px solid var(--c) !important;
  }
  .gauche {
    flex: 1.3;
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .milieu {
    flex: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .milieu .sous,
  .gauche .sous {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .emoji {
    width: 60px !important;
    text-align: center;
  }
  .onglets button {
    padding: 5px 10px;
  }
  .droit {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1.2fr) auto;
    gap: 6px;
    align-items: center;
  }
  .droits {
    display: grid;
    gap: 6px;
  }
  .infos {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 8px 10px;
  }
  .version {
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .texte.petit {
    font-size: 12px;
    color: var(--muted);
  }
  .cle {
    display: grid;
    gap: 8px;
    padding: 14px;
    border: 1px solid var(--accent);
    border-radius: 12px;
    margin-bottom: 14px;
  }
  .cle code {
    user-select: all;
    word-break: break-all;
    padding: 8px;
    background: var(--field);
    border-radius: 8px;
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
</style>

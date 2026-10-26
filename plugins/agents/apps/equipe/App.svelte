<script lang="ts">
  // L'équipe : les agents du cerveau. À gauche la liste (habitants de l'île, visiteurs, autres accès), au centre les réglages
  // de l'agent choisi (identité, permissions, modèle, serveur), à droite sa fiche « inventaire ».
  import { connect } from "@etabli/sdk";
  import { cerveau, habitant, nomDe, Personnage, type Agent, type EtatServeur } from "@hameau/commun";

  const ACTIONS: Record<string, { emoji: string; nom: string }> = {
    "library.read": { emoji: "🧠", nom: "Lire le cerveau" },
    "library.write": { emoji: "✍️", nom: "Écrire dans le cerveau" },
    "mail.read": { emoji: "✉️", nom: "Lire les mails" },
    "mail.state": { emoji: "🗂️", nom: "Trier les mails" },
    "mail.draft": { emoji: "📝", nom: "Préparer des brouillons" },
    "task.create": { emoji: "📌", nom: "Créer des tâches" },
    "quotidien.read": { emoji: "📅", nom: "Lire Quotidien" },
    "quotidien.write": { emoji: "🗓️", nom: "Écrire dans Quotidien" },
    "ia.use": { emoji: "🤖", nom: "Utiliser le modèle local" },
    "web.search": { emoji: "🌐", nom: "Chercher sur le web" },
    "harness.use": { emoji: "⚙️", nom: "Piloter le harnais" },
    "presence.read": { emoji: "📱", nom: "Voir ta présence (téléphone)" },
    "presence.write": { emoji: "📡", nom: "Envoyer ta présence" },
    "report.write": { emoji: "📮", nom: "Déposer des rapports" },
    "hameau.read": { emoji: "🏝️", nom: "Voir le hameau" },
    "hameau.write": { emoji: "🏗️", nom: "Agir dans le hameau" },
  };
  const NIVEAUX: Record<string, string> = { autorise: "autorisé", confirmation: "avec ta confirmation", interdit: "interdit" };
  const ONGLETS = [
    ["identite", "Identité"],
    ["permissions", "Permissions"],
    ["modele", "Modèle"],
    ["serveur", "Serveur"],
  ] as const;

  let agents = $state<Agent[]>([]);
  let choisi = $state("max");
  let onglet = $state<(typeof ONGLETS)[number][0]>("identite");
  let serveur = $state<EtatServeur | null>(null);
  let erreur = $state("");
  let reglages = $state<Record<string, string>>({});
  // brouillon des champs modifiés, enregistré d'un coup
  let brouillon = $state<Record<string, string>>({});
  let message = $state("");
  // vue du centre : un agent, les configurations de modèles, un nouvel agent, ou le tutoriel « connecter Claude »
  let vue = $state<"agent" | "configs" | "nouveau" | "claude">("agent");
  let nNom = $state("");
  let nMoteur = $state("claude:sonnet");
  let cree = $state<{ agent: string; cle: string } | null>(null);
  const URL_CERVEAU = "https://vm-cerveau2.tail11578e.ts.net/mcp";
  const commandeClaude = (cle: string) => `claude mcp add --scope user --transport http cerveau ${URL_CERVEAU} --header "Authorization: Bearer ${cle}"`;

  interface ModeleLocal {
    fichier: string;
    contexte?: number;
    emplacements?: number;
  }
  interface Config {
    id: string;
    nom: string;
    modeles: ModeleLocal[];
  }
  const configs = $derived.by<Config[]>(() => {
    try {
      return JSON.parse(reglages.configs_modeles || "[]") as Config[];
    } catch {
      return [];
    }
  });
  let cBrouillon = $state<Config[] | null>(null);
  const FICHIERS = ["Qwen3.8-27B-IQ4_XS_4BPW.gguf", "LFM2.5-24B-A2B-QAD-Q4_0.gguf"];
  /** Le brouillon des configurations, créé à la première modification. */
  const brouillonConfigs = (): Config[] => (cBrouillon ??= structuredClone($state.snapshot(configs)));
  const idDe = (c: Config) => c.id || c.nom.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "config";

  async function enregistrerConfigs(active: string): Promise<void> {
    try {
      if (cBrouillon) await cerveau.regler("configs_modeles", JSON.stringify(cBrouillon.map((c) => ({ ...c, id: idDe(c) }))));
      if (active !== (reglages.config_active ?? "")) await cerveau.regler("config_active", active);
      reglages = await cerveau.reglages();
      cBrouillon = null;
      message = "Configurations enregistrées." + (active ? " Le modèle redémarre avec la configuration active." : "");
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  async function creerAgent(): Promise<void> {
    try {
      cree = await cerveau.creerAgent(nNom.trim(), nMoteur);
      await charger();
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  const copier = (t: string) => void navigator.clipboard?.writeText(t).catch(() => {});

  async function charger(): Promise<void> {
    try {
      [agents, serveur, reglages] = await Promise.all([cerveau.agents(), cerveau.serveur(), cerveau.reglages()]);
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  // ouverte depuis l'accueil (« 👤 Profil » sur un agent) : on montre cet agent
  void connect().then((e) => {
    const id = (e.incoming?.kind === "agent" && (e.incoming.data as { id?: string }).id) || "";
    if (id) choisi = id;
  });

  const valeur = (cle: string) => brouillon[cle] ?? reglages[cle] ?? "";
  const changes = $derived(Object.keys(brouillon).filter((c) => brouillon[c] !== (reglages[c] ?? "")));

  async function enregistrer(): Promise<void> {
    const modele = changes.some((c) => c.startsWith("llm_"));
    try {
      for (const c of changes) await cerveau.regler(c, brouillon[c]!);
      brouillon = {};
      reglages = await cerveau.reglages();
      message = modele ? "Enregistré. Le modèle redémarre avec ces réglages (quelques minutes)." : "Enregistré. Max s'en sert dès son prochain tour.";
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  const habitants = $derived(agents.filter((a) => habitant(a.nom)?.genre === "habitant"));
  const visiteurs = $derived(agents.filter((a) => habitant(a.nom)?.genre === "visiteur"));
  const autres = $derived(agents.filter((a) => !habitant(a.nom)));
  const agent = $derived(agents.find((a) => a.nom === choisi) ?? null);
  const perso = $derived(habitant(choisi));
  const estLocal = $derived(perso?.genre === "habitant");
  const outils = $derived(
    [...new Set((agent?.droits ?? []).filter((d) => d.niveau !== "interdit").map((d) => d.action))].map((a) => ACTIONS[a] ?? { emoji: "•", nom: a }),
  );
</script>

<div class="page">
  <aside class="liste">
    <h1>Équipe</h1>
    {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
    <p class="groupe">🏝️ Habitants (sur ton serveur)</p>
    {#each habitants as a}
      <button class="ag" aria-pressed={choisi === a.nom} onclick={() => ((choisi = a.nom), (vue = "agent"))}>
        <Personnage qui={habitant(a.nom)} taille={34} /><span><b>{nomDe(a.nom)}</b><small>{habitant(a.nom)?.role}</small></span>
      </button>
    {/each}
    <p class="groupe">🚉 Visiteurs (de l'extérieur)</p>
    {#each visiteurs as a}
      <button class="ag" aria-pressed={choisi === a.nom} onclick={() => ((choisi = a.nom), (vue = "agent"))}>
        <Personnage qui={habitant(a.nom)} taille={34} /><span><b>{nomDe(a.nom)}</b><small>{a.nom}</small></span>
      </button>
    {/each}
    <button class="ag ajout" aria-pressed={vue === "nouveau"} onclick={() => ((vue = "nouveau"), (cree = null), (nNom = ""))}>
      <span class="plus">➕</span><span><b>Nouvel agent</b><small>local, Claude ou API</small></span>
    </button>
    <p class="groupe">⚙️ Réglages</p>
    <button class="ag petit-ag" aria-pressed={vue === "configs"} onclick={() => (vue = "configs")}><span class="plus">🧩</span><span><b>Configurations de modèles</b><small>{reglages.config_active || "aucune active"}</small></span></button>
    <button class="ag petit-ag" aria-pressed={vue === "claude"} onclick={() => ((vue = "claude"), (cree = null), (nNom = "claude-pc2"), (nMoteur = "claude:sonnet"))}><span class="plus">🔌</span><span><b>Connecter Claude</b><small>tutoriel en 3 étapes</small></span></button>
    {#if autres.length}
      <p class="groupe">🔑 Autres accès au cerveau</p>
      {#each autres as a}
        <button class="ag petit-ag" aria-pressed={choisi === a.nom} onclick={() => ((choisi = a.nom), (vue = "agent"))}><span class="plus">🔑</span><span><b>{a.nom}</b><small>{a.actif ? "actif" : "révoqué"}</small></span></button>
      {/each}
    {/if}
  </aside>

  <main class="reglages">
    {#if vue === "configs"}
      {@const liste = cBrouillon ?? configs}
      <h2>🧩 Configurations de modèles</h2>
      <p class="petit">Chaque configuration dit quels modèles le serveur fait tourner (par exemple « Max seul » avec le 27B, ou « Duo » avec deux petits modèles). Une seule est active ; la changer redémarre le modèle. Pour l'instant, seul le premier modèle d'une configuration est lancé.</p>
      {#each liste as c, i}
        <div class="config">
          <label class="radio"><input type="radio" name="active" checked={(reglages.config_active ?? "") === c.id} disabled={!c.id} onchange={() => enregistrerConfigs(c.id)} /> Active</label>
          <input value={c.nom} placeholder="Nom (ex. Max seul)" oninput={(e) => (brouillonConfigs()[i]!.nom = e.currentTarget.value)} />
          {#each c.modeles as m, j}
            <div class="modele">
              <input list="fichiers" value={m.fichier} placeholder="fichier .gguf" oninput={(e) => (brouillonConfigs()[i]!.modeles[j]!.fichier = e.currentTarget.value)} />
              <input type="number" value={m.contexte ?? 32768} title="Contexte (jetons)" oninput={(e) => (brouillonConfigs()[i]!.modeles[j]!.contexte = Number(e.currentTarget.value))} />
              <input type="number" min="1" max="4" value={m.emplacements ?? 1} title="Conversations en parallèle" oninput={(e) => (brouillonConfigs()[i]!.modeles[j]!.emplacements = Number(e.currentTarget.value))} />
            </div>
          {/each}
          <div class="boutons-config">
            <button onclick={() => brouillonConfigs()[i]!.modeles.push({ fichier: "", contexte: 16384, emplacements: 1 })}>➕ Modèle</button>
            <button onclick={() => brouillonConfigs().splice(i, 1)}>🗑️ Supprimer</button>
          </div>
        </div>
      {/each}
      <datalist id="fichiers">{#each FICHIERS as f}<option value={f}></option>{/each}</datalist>
      <div class="enregistrer">
        <button onclick={() => brouillonConfigs().push({ id: "", nom: "", modeles: [{ fichier: FICHIERS[0]!, contexte: 65536, emplacements: 1 }] })}>➕ Configuration</button>
        {#if cBrouillon}<button class="principal" onclick={() => enregistrerConfigs(reglages.config_active ?? "")}>Enregistrer</button><button onclick={() => (cBrouillon = null)}>Annuler</button>{/if}
      </div>
      {#if message}<p class="petit" role="status">{message}</p>{/if}
    {:else if vue === "nouveau" || vue === "claude"}
      {#if vue === "claude"}
        <h2>🔌 Connecter Claude au cerveau</h2>
        <ol class="etapes">
          <li><b>Crée un accès pour ce Claude</b> (un par ordinateur) : choisis son nom et le modèle qu'il utilise d'habitude.</li>
          <li><b>Copie la commande</b> qui s'affiche, et lance-la une fois dans un terminal sur cet ordinateur.</li>
          <li><b>Vérifie</b> : dans Claude Code, demande « lis mes tâches dans le cerveau ». Il voit le tableau d'AGL, et ses rapports arrivent dans 📮 Courrier.</li>
        </ol>
      {:else}
        <h2>➕ Nouvel agent</h2>
        <p class="petit">Un agent est un accès au cerveau avec un moteur : un modèle local (selon la configuration), Claude (par ton abonnement) ou une API.</p>
      {/if}
      {#if !cree}
        <label class="champ"><span>Nom (identifiant)</span><input bind:value={nNom} placeholder="claude-portable" /></label>
        <label class="champ"><span>Moteur</span>
          <select bind:value={nMoteur}>
            <option value="claude:opus">Claude Opus (tâches difficiles)</option>
            <option value="claude:sonnet">Claude Sonnet (intermédiaire)</option>
            <option value="claude:haiku">Claude Haiku (simple et rapide)</option>
            {#each configs as c}<option value="local:{c.id}">Local : {c.nom || c.id}</option>{/each}
          </select></label>
        <div class="enregistrer"><button class="principal" disabled={!nNom.trim()} onclick={creerAgent}>Créer l'accès</button></div>
      {:else}
        <p>✅ Agent <b>{cree.agent}</b> créé. Sa clé n'est montrée qu'une fois :</p>
        {#if nMoteur.startsWith("claude:")}
          <p class="petit">Commande à lancer dans un terminal, sur l'ordinateur de ce Claude :</p>
          <code class="commande">{commandeClaude(cree.cle)}</code>
          <div class="enregistrer"><button onclick={() => copier(commandeClaude(cree!.cle))}>📋 Copier la commande</button></div>
        {:else}
          <code class="commande">{cree.cle}</code>
          <div class="enregistrer"><button onclick={() => copier(cree!.cle)}>📋 Copier la clé</button></div>
        {/if}
      {/if}
    {:else if agent}
      <div class="onglets" role="tablist">
        {#each ONGLETS as [id, nom]}
          {#if (id !== "modele" && id !== "serveur") || estLocal}
            <button role="tab" aria-selected={onglet === id} onclick={() => (onglet = id)}>{nom}</button>
          {/if}
        {/each}
      </div>

      {#if onglet === "identite"}
        <section class="grille">
          <div class="champ"><span>Nom</span><b>{nomDe(agent.nom)}</b></div>
          <div class="champ"><span>Identifiant dans le cerveau</span><code>{agent.nom}</code></div>
          <div class="champ"><span>Rôle</span><b>{perso?.role ?? "Accès au cerveau"}</b></div>
          <div class="champ"><span>Depuis</span><b>{agent.cree}</b></div>
          <div class="champ"><span>Dernière action</span><b>{agent.derniere_action ?? "jamais"}</b></div>
          <div class="champ"><span>État</span><b>{agent.actif ? "actif" : "révoqué"}</b></div>
          <label class="champ"><span>Moteur</span>
            <select value={valeur(`moteur_${agent.nom}`)} onchange={(e) => (brouillon[`moteur_${agent.nom}`] = e.currentTarget.value)}>
              <option value="">Non précisé</option>
              <option value="claude:opus">Claude Opus</option><option value="claude:sonnet">Claude Sonnet</option><option value="claude:haiku">Claude Haiku</option>
              {#each configs as c}<option value="local:{c.id}">Local : {c.nom || c.id}</option>{/each}
            </select></label>
          {#if estLocal}
            <label class="champ large">
              <span>Personnalité et consigne</span>
              <textarea rows="12" value={valeur(`personnalite_${agent.nom}`)} oninput={(e) => (brouillon[`personnalite_${agent.nom}`] = e.currentTarget.value)}
                placeholder="Vide : la consigne d'origine du harnais. Écris ici comment {nomDe(agent.nom)} doit parler et se comporter."></textarea>
            </label>
            <label class="champ"><span>Heures de silence</span>
              <input value={valeur("silence")} placeholder="00:00-07:00" oninput={(e) => (brouillon.silence = e.currentTarget.value)} /></label>
            <label class="champ"><span>Fin de conversation après (minutes)</span>
              <input type="number" min="5" max="720" value={valeur("session_minutes")} oninput={(e) => (brouillon.session_minutes = e.currentTarget.value)} /></label>
          {/if}
        </section>
      {:else if onglet === "permissions"}
        <section class="droits">
          {#each agent.droits as d}
            {@const a = ACTIONS[d.action] ?? { emoji: "•", nom: d.action }}
            <div class="droit" class:interdit={d.niveau === "interdit"}>
              <span class="em">{a.emoji}</span>
              <span class="nom">{a.nom}<small>{d.ressource === "*" ? "partout" : d.ressource}</small></span>
              <span class="niveau niveau-{d.niveau}">{NIVEAUX[d.niveau] ?? d.niveau}</span>
            </div>
          {:else}
            <p class="petit">Aucun droit : cet accès ne peut rien faire.</p>
          {/each}
          <p class="petit">Les droits se modifient pour l'instant en ligne de commande sur le serveur (cerveau grant). Jamais la banque, jamais un mot de passe hors de ta conversation avec Max.</p>
        </section>
      {:else if onglet === "modele"}
        <section class="grille">
          {#if serveur?.modele}
            <div class="champ"><span>Fichier du modèle</span><b>{serveur.modele.fichier}</b></div>
            <div class="champ"><span>Contexte</span><b>{serveur.modele.contexte?.toLocaleString("fr-FR")} jetons</b></div>
            <div class="champ"><span>Température</span><b>{serveur.modele.temperature}</b></div>
            <div class="champ"><span>Conversations en parallèle</span><b>{serveur.modele.emplacements}</b></div>
          {:else}
            <p class="petit large">😴 Le modèle ne tourne pas : pas de carte graphique en ce moment. Max dort.</p>
          {/if}
          <label class="champ"><span>Contexte (jetons)</span>
            <select value={valeur("llm_contexte")} onchange={(e) => (brouillon.llm_contexte = e.currentTarget.value)}>
              {#each ["8192", "16384", "32768", "65536", "98304", "131072"] as c}<option value={c}>{Number(c).toLocaleString("fr-FR")}</option>{/each}
            </select></label>
          <label class="champ"><span>Conversations en parallèle</span>
            <select value={valeur("llm_emplacements")} onchange={(e) => (brouillon.llm_emplacements = e.currentTarget.value)}>
              {#each ["1", "2", "3", "4"] as c}<option value={c}>{c}</option>{/each}
            </select></label>
          <label class="champ"><span>Température (vide : celle du modèle)</span>
            <input type="number" min="0" max="2" step="0.05" value={valeur("llm_temperature")} oninput={(e) => (brouillon.llm_temperature = e.currentTarget.value)} /></label>
          <label class="champ"><span>Réflexion avant de répondre</span>
            <select value={valeur("llm_reflexion")} onchange={(e) => (brouillon.llm_reflexion = e.currentTarget.value)}>
              <option value="off">Non (plus rapide)</option><option value="on">Oui (plus réfléchi, plus lent)</option>
            </select></label>
          <label class="champ"><span>Mémoire de conversation (cache)</span>
            <select value={valeur("llm_cache")} onchange={(e) => (brouillon.llm_cache = e.currentTarget.value)}>
              <option value="q4_0">Compacte (q4)</option><option value="q8_0">Précise (q8)</option><option value="f16">Pleine (f16, beaucoup de mémoire)</option>
            </select></label>
          <p class="petit large">Enregistrer un de ces réglages redémarre le modèle : Max est indisponible quelques minutes.</p>
        </section>
      {:else}
        <section class="grille">
          {#each serveur?.cartes ?? [] as c}
            <div class="carte-gpu">
              <b>🎮 {c.nom}</b>
              <span>🌡️ {c.temperature ?? "?"} °C</span>
              <span>⚡ {c.charge ?? "?"} %</span>
              <span>🧠 {c.memoire_mo ?? "?"} / {c.memoire_totale_mo ?? "?"} Mo</span>
            </div>
          {:else}
            <p class="petit large">Aucune carte graphique visible (ou pas de carte NVIDIA). Le modèle est {serveur?.en_ligne ? "en ligne" : "coupé"}.</p>
          {/each}
        </section>
      {/if}
      {#if changes.length}
        <div class="enregistrer"><button class="principal" onclick={enregistrer}>Enregistrer ({changes.length})</button><button onclick={() => (brouillon = {})}>Annuler</button></div>
      {/if}
      {#if message}<p class="petit" role="status">{message}</p>{/if}
    {/if}
  </main>

  <aside class="inventaire" style="--c1:{perso?.couleurs[0] ?? '#ddd'};--c2:{perso?.couleurs[1] ?? '#bbb'}">
    {#if perso}
      <Personnage qui={perso} taille={150} anime />
      <h2>{perso.nom}</h2>
      <p class="sous">{perso.genre === "habitant" ? "Habite le hameau" : "Visiteur"}{estLocal ? (serveur?.en_ligne ? " · réveillé" : " · endormi 💤") : ""}</p>
      <div class="slots">
        {#if estLocal}<div class="slot"><b>🧠</b>{serveur?.modele?.fichier?.split("-").slice(0, 2).join(" ") ?? "aucun modèle"}</div>{/if}
        {#each outils.slice(0, estLocal ? 8 : 9) as o}<div class="slot"><b>{o.emoji}</b>{o.nom}</div>{/each}
      </div>
    {:else if agent}
      <span class="cle">🔑</span>
      <h2>{agent.nom}</h2>
      <p class="sous">Un accès au cerveau, pas un agent</p>
    {/if}
  </aside>
</div>

<style>
  h2 { margin: 0 0 8px; font-size: 18px; }
  .config { display: grid; gap: 6px; padding: 10px; margin: 8px 0; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .modele { display: grid; grid-template-columns: 1fr 110px 70px; gap: 6px; }
  .radio { display: flex; gap: 6px; align-items: center; font-size: 13px; }
  .radio input { width: auto; }
  .boutons-config { display: flex; gap: 6px; }
  .boutons-config button { padding: 4px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); cursor: pointer; font: inherit; }
  .etapes { display: grid; gap: 8px; padding-left: 20px; }
  .commande { display: block; padding: 10px; border-radius: 8px; background: var(--field); font-family: ui-monospace, Consolas, monospace; font-size: 12px; word-break: break-all; user-select: all; }
  textarea, input, select { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; }
  textarea { resize: vertical; line-height: 1.45; }
  .enregistrer { display: flex; gap: 8px; margin-top: 14px; }
  .enregistrer button { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; font: inherit; font-weight: 600; }
  .enregistrer .principal { background: var(--accent); border-color: var(--accent); color: #fff; }
  .page {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr) 280px;
    gap: 18px;
    padding: 20px;
    align-items: start;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 24px;
  }
  .liste {
    display: grid;
    gap: 8px;
  }
  .groupe {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
  }
  .ag {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 9px 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    color: var(--text);
  }
  .ag[aria-pressed="true"] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .ag small {
    display: block;
    color: var(--muted);
    font-size: 12px;
  }
  .ajout {
    border-style: dashed;
    opacity: 0.7;
    cursor: default;
  }
  .plus {
    width: 34px;
    text-align: center;
    font-size: 20px;
  }
  .petit-ag {
    padding: 6px 10px;
  }
  .reglages {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px;
    display: grid;
    gap: 16px;
  }
  .onglets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .onglets button {
    border: 1px solid var(--border);
    background: none;
    border-radius: 999px;
    padding: 5px 12px;
    cursor: pointer;
    font-weight: 600;
    color: var(--text);
  }
  .onglets button[aria-selected="true"] {
    background: var(--text);
    color: var(--surface);
    border-color: var(--text);
  }
  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  .champ {
    display: grid;
    gap: 3px;
  }
  .champ > span {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .large {
    grid-column: 1 / -1;
  }
  .droits {
    display: grid;
    gap: 8px;
  }
  .droit {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .droit.interdit {
    opacity: 0.55;
  }
  .em {
    font-size: 18px;
  }
  .nom {
    flex: 1;
    display: grid;
  }
  .nom small {
    color: var(--muted);
  }
  .niveau {
    font-size: 12px;
    font-weight: 700;
    border-radius: 999px;
    padding: 2px 9px;
  }
  .niveau-autorise {
    background: #d8f2df;
    color: #1f5a35;
  }
  .niveau-confirmation {
    background: #fff0cc;
    color: #7a5200;
  }
  .niveau-interdit {
    background: #f7d9d4;
    color: #8a2a1d;
  }
  .carte-gpu {
    display: grid;
    gap: 4px;
    padding: 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }
  .inventaire {
    background: linear-gradient(180deg, color-mix(in srgb, var(--c1) 30%, var(--surface)), color-mix(in srgb, var(--c2) 35%, var(--surface)));
    border-radius: 20px;
    padding: 18px;
    display: grid;
    gap: 10px;
    justify-items: center;
    text-align: center;
  }
  .inventaire h2 {
    margin: 0;
  }
  .sous {
    margin: 0;
    color: var(--muted);
  }
  .cle {
    font-size: 64px;
  }
  .slots {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    width: 100%;
  }
  .slot {
    background: color-mix(in srgb, var(--surface) 70%, transparent);
    border-radius: 12px;
    padding: 8px 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .slot b {
    display: block;
    font-size: 20px;
  }
  .erreur {
    color: #c0392b;
    margin: 0;
  }
  @media (max-width: 1100px) {
    .page {
      grid-template-columns: 1fr;
    }
  }
</style>

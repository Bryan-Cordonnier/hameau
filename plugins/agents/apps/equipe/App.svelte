<script lang="ts">
  // L'équipe : les agents du cerveau. À gauche la liste (habitants de l'île, visiteurs, autres accès), au centre les réglages
  // de l'agent choisi (identité, permissions, modèle, serveur), à droite sa fiche « inventaire ».
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

  async function charger(): Promise<void> {
    try {
      [agents, serveur] = await Promise.all([cerveau.agents(), cerveau.serveur()]);
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();

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
      <button class="ag" aria-pressed={choisi === a.nom} onclick={() => (choisi = a.nom)}>
        <Personnage qui={habitant(a.nom)} taille={34} /><span><b>{nomDe(a.nom)}</b><small>{habitant(a.nom)?.role}</small></span>
      </button>
    {/each}
    <p class="groupe">🚉 Visiteurs (de l'extérieur)</p>
    {#each visiteurs as a}
      <button class="ag" aria-pressed={choisi === a.nom} onclick={() => (choisi = a.nom)}>
        <Personnage qui={habitant(a.nom)} taille={34} /><span><b>{nomDe(a.nom)}</b><small>{a.nom}</small></span>
      </button>
    {/each}
    <button class="ag ajout" disabled title="Plus tard : une API, un deuxième modèle sur d'autres cartes graphiques">
      <span class="plus">＋</span><span><b>Nouvel agent</b><small>API, 2ᵉ modèle… bientôt</small></span>
    </button>
    {#if autres.length}
      <p class="groupe">🔑 Autres accès au cerveau</p>
      {#each autres as a}
        <button class="ag petit-ag" aria-pressed={choisi === a.nom} onclick={() => (choisi = a.nom)}><span class="plus">🔑</span><span><b>{a.nom}</b><small>{a.actif ? "actif" : "révoqué"}</small></span></button>
      {/each}
    {/if}
  </aside>

  <main class="reglages">
    {#if agent}
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
          {#if estLocal}
            <div class="champ large">
              <span>Personnalité et consigne</span>
              <p class="petit">Se règle encore dans le harnais (fichier postes.json). Ici dans la prochaine version : nom, personnalité, rôle, heures de silence et rapport du soir, modifiables.</p>
            </div>
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
          <div class="champ large">
            <span>Réglages de llama.cpp</span>
            <p class="petit">Prochaine version : tous les réglages (fichier, contexte, couches sur la carte, répartition sur plusieurs cartes, cache, décodage spéculatif, threads, lots, échantillonnage) avec redémarrage du modèle depuis ici.</p>
          </div>
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

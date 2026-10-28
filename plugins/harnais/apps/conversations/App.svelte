<script lang="ts">
  // Parler aux agents : Max épinglé en haut (la même conversation que sur Element), les conversations avec un agent, puis
  // celles à plusieurs (tour par tour, « Passer mon tour »). Les agents posent leurs questions avec un menu, demandent une
  // approbation avec des boutons. En bas : « + » (fichier, accès à un dossier, ajouter un agent), micro, et les petits blocs
  // mode / contexte / prix.
  import { connect } from "@etabli/sdk";
  import { agl, ilYa, nomAffiche, NOMS_MODE, Recherche, type Conversation, type ConversationResume, type EtatAgl, type Message, type Mode } from "@hameau/commun";

  let etat = $state<EtatAgl | null>(null);
  let conv = $state<Conversation | null>(null);
  let choisie = $state<number | null>(null);
  let texte = $state("");
  let erreur = $state("");
  let nouvelle = $state<string[] | null>(null);
  let menuPlus = $state(false);
  let reponses = $state<Record<number, string[]>>({});
  let fil = $state<HTMLDivElement>();

  async function charger(): Promise<void> {
    try {
      etat = await agl.etat();
      if (choisie === null) choisie = etat.conversations.find((c) => c.element)?.id ?? etat.conversations[0]?.id ?? null;
      if (choisie !== null) {
        const avant = conv?.messages.length ?? 0;
        conv = await agl.conversation(choisie);
        if (conv.messages.length !== avant) setTimeout(() => fil?.scrollTo({ top: fil.scrollHeight, behavior: "smooth" }), 30);
      }
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void connect().then((e) => {
    if (e.incoming?.kind === "conversation") choisie = Number((e.incoming.data as { id?: number }).id) || null;
    void charger();
  });
  $effect(() => {
    const t = setInterval(() => void charger(), 3000);
    return () => clearInterval(t);
  });
  async function agir(f: () => Promise<unknown>): Promise<void> {
    try {
      await f();
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  function choisir(id: number): void {
    choisie = id;
    conv = null;
    void charger();
  }

  const agents = $derived(etat?.agents ?? []);
  const emoji = (n: string) => agents.find((a) => a.nom === n)?.emoji ?? "🤖";
  const max = $derived(etat?.conversations.find((c) => c.element) ?? null);
  const seules = $derived(etat?.conversations.filter((c) => !c.element && c.agents.length === 1) ?? []);
  const groupes = $derived(etat?.conversations.filter((c) => c.agents.length > 1) ?? []);
  const titre = (c: ConversationResume) => c.titre || c.agents.map((a) => nomAffiche(a, agents)).join(", ");
  const monTour = $derived(conv?.tour === "bryan");
  const attente = $derived(conv?.messages.some((m) => m.etat === "attente") ?? false);
  // jauge de contexte : à peu près 3 caractères par token, sur 200 000 tokens
  const contexte = $derived(conv ? Math.min(100, Math.round((conv.messages.reduce((s, m) => s + m.texte.length, 0) / 3 / 200_000) * 100)) : 0);
  const moteurs = $derived(conv?.agents.map((a) => agents.find((x) => x.nom === a)?.moteur) ?? []);
  const payant = $derived(moteurs.some((m) => m?.type === "api"));
  // prix estimé (Haiku 5.5 : 0,10 $ / M en entrée) : chaque réponse relit toute la conversation
  const prix = $derived(conv ? (conv.messages.filter((m) => m.auteur !== "bryan").length * (conv.messages.reduce((s, m) => s + m.texte.length, 0) / 3) * 0.1) / 1e6 : 0);

  async function envoyer(): Promise<void> {
    const t = texte.trim();
    if (!t || !conv) return;
    texte = "";
    await agir(() => agl.dire(conv!.id, t));
  }
  function touche(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void envoyer();
    }
  }
  async function repondreQuestions(m: Message): Promise<void> {
    const r = reponses[m.id] ?? [];
    await agir(() => agl.repondre(m.id, { answers: (m.donnees.questions ?? []).map((_, i) => r[i] ?? "") }));
  }

  // ---- « + » : fichier, dossier, agent ----
  let fichier = $state<HTMLInputElement>();
  async function joindre(e: Event): Promise<void> {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    menuPlus = false;
    if (f.size > 200_000 || !(f.type.startsWith("text") || /\.(md|txt|csv|json|log)$/i.test(f.name))) {
      erreur = "Pour l'instant, on joint des fichiers texte (md, txt, csv, json) de moins de 200 ko.";
      return;
    }
    texte = `${texte}\n\n--- Fichier joint : ${f.name} ---\n${await f.text()}`.trim();
  }
  async function donnerAcces(): Promise<void> {
    menuPlus = false;
    const d = prompt("Dossier du PC à ouvrir à cette conversation (chemin complet) :");
    if (d?.trim() && conv) await agir(() => agl.reglerConversation(conv!.id, { grant_folder: d.trim() }));
  }

  // ---- micro : transcription locale (même modèle que les vocaux d'Element), puis relecture avant envoi ----
  let enregistreur: MediaRecorder | null = null;
  let micro = $state<"" | "ecoute" | "transcription">("");
  async function parler(): Promise<void> {
    if (micro === "ecoute") {
      enregistreur?.stop();
      return;
    }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const morceaux: Blob[] = [];
      enregistreur = new MediaRecorder(flux);
      enregistreur.ondataavailable = (e) => morceaux.push(e.data);
      enregistreur.onstop = async () => {
        flux.getTracks().forEach((t) => t.stop());
        micro = "transcription";
        const b64 = await new Promise<string>((ok) => {
          const r = new FileReader();
          r.onload = () => ok(String(r.result));
          r.readAsDataURL(new Blob(morceaux, { type: "audio/webm" }));
        });
        try {
          const { job } = await agl.transcrire(b64, "webm");
          for (let i = 0; i < 120; i++) {
            await new Promise((ok) => setTimeout(ok, 1000));
            const r = await agl.transcription(job);
            if (r.fini) {
              if (r.texte) texte = `${texte} ${r.texte}`.trim();
              if (r.erreur) erreur = `Transcription impossible : ${r.erreur}`;
              break;
            }
          }
        } catch (e) {
          erreur = (e as Error).message;
        }
        micro = "";
      };
      enregistreur.start();
      micro = "ecoute";
    } catch (e) {
      erreur = `Micro indisponible : ${(e as Error).message}`;
    }
  }
</script>

<Recherche ouvrir={(g, id) => g === "conversation" && choisir(Number(id))} />
<div class="agl page">
  <nav class="liste">
    <button class="principal nouvelle" onclick={() => (nouvelle = [])}>+ Nouvelle conversation</button>
    {#if max}
      <button class="conv epinglee" class:active={choisie === max.id} onclick={() => choisir(max.id)}>
        <span class="em">{emoji("max")}</span><span class="t"><b>Max</b><small>📌 Ton assistant · Element</small></span>
      </button>
    {/if}
    {#each seules as c (c.id)}
      <button class="conv" class:active={choisie === c.id} onclick={() => choisir(c.id)}>
        <span class="em">{emoji(c.agents[0] ?? "")}</span><span class="t"><b>{titre(c)}</b><small>{c.dernier ?? ""}</small></span>
      </button>
    {/each}
    {#if groupes.length}<div class="sous separation">À plusieurs</div>{/if}
    {#each groupes as c (c.id)}
      <button class="conv" class:active={choisie === c.id} onclick={() => choisir(c.id)}>
        <span class="em">{c.agents.map(emoji).join("")}</span><span class="t"><b>{titre(c)}</b><small>{c.tour === "bryan" ? "À toi" : `Au tour de ${nomAffiche(c.tour ?? "", agents)}`}</small></span>
      </button>
    {/each}
  </nav>

  <main>
    {#if erreur}<p class="erreur">{erreur} <button class="petit" onclick={() => (erreur = "")}>OK</button></p>{/if}
    {#if conv}
      <div class="ligne haut">
        <h2>{conv.element ? "Max" : titre(conv)}</h2>
        {#if conv.agents.length > 1}<span class="pastille">{conv.ordre.map((x) => (x === conv?.tour ? `▶ ${nomAffiche(x, agents)}` : nomAffiche(x, agents))).join(" · ")}</span>{/if}
        <span class="espace"></span>
        {#if !conv.element}<button class="petit danger" onclick={() => { const id = conv!.id; choisie = null; conv = null; void agir(() => agl.reglerConversation(id, { delete: true })); }}>Supprimer</button>{/if}
      </div>
      <div class="fil" bind:this={fil}>
        {#each conv.messages as m (m.id)}
          {@const moi = m.auteur === "bryan"}
          <div class="msg" class:moi class:systeme={m.auteur === "systeme"}>
            {#if !moi && m.auteur !== "systeme"}<div class="auteur">{emoji(m.auteur)} {nomAffiche(m.auteur, agents)}</div>{/if}
            <div class="bulle"><pre class="texte">{m.texte}</pre>
              {#if m.genre === "questions" && m.donnees.questions}
                <div class="questions">
                  {#each m.donnees.questions as q, i}
                    <div class="q"><b>{q.q}</b>
                      <div class="ligne">
                        {#each q.choix ?? [] as c}<button class="petit" class:principal={reponses[m.id]?.[i] === c} disabled={m.etat !== "attente"} onclick={() => { reponses[m.id] = [...(reponses[m.id] ?? [])]; reponses[m.id]![i] = c; }}>{c}</button>{/each}
                      </div>
                      {#if m.etat === "attente"}<input placeholder="Ou ta réponse" value={reponses[m.id]?.[i] ?? ""} oninput={(e) => { reponses[m.id] = [...(reponses[m.id] ?? [])]; reponses[m.id]![i] = e.currentTarget.value; }} />{/if}
                    </div>
                  {/each}
                  {#if m.etat === "attente"}<button class="principal" onclick={() => repondreQuestions(m)}>Répondre</button>{:else}<span class="sous">Répondu</span>{/if}
                </div>
              {:else if m.genre === "approbation"}
                <div class="ligne">
                  {#if m.etat === "attente"}
                    <button class="principal" onclick={() => agir(() => agl.repondre(m.id, { accept: true }))}>✅ Accepter</button>
                    <button onclick={() => agir(() => agl.repondre(m.id, { accept: false }))}>❌ Refuser</button>
                  {:else}<span class="sous">Décidé</span>{/if}
                </div>
              {/if}
            </div>
            <div class="quand">{ilYa(m.quand)}</div>
          </div>
        {:else}
          <p class="vide">Commence la conversation.</p>
        {/each}
        {#if conv.tour && conv.tour !== "bryan" && !attente}<p class="sous ecrit">{emoji(conv.tour)} {nomAffiche(conv.tour, agents)} écrit…</p>{/if}
      </div>

      <div class="saisie">
        {#if conv.agents.length > 1 && monTour && conv.messages.length}<button class="passer" onclick={() => agir(() => agl.passer(conv!.id))}>Passer mon tour</button>{/if}
        <div class="barre-saisie">
          <div class="plus-zone">
            <button class="rond" onclick={() => (menuPlus = !menuPlus)} title="Joindre, donner un accès, ajouter un agent">+</button>
            {#if menuPlus}
              <div class="menu">
                <button onclick={() => fichier?.click()}>📎 Joindre un fichier</button>
                <button onclick={donnerAcces}>📂 Donner accès à un dossier</button>
                {#if !conv.element}
                  {#each agents.filter((a) => !conv?.agents.includes(a.nom) && a.moteur.type !== "externe") as a}
                    <button onclick={() => { menuPlus = false; void agir(() => agl.reglerConversation(conv!.id, { add_agent: a.nom })); }}>➕ Ajouter {a.emoji} {nomAffiche(a.nom)}</button>
                  {/each}
                {/if}
              </div>
            {/if}
            <input type="file" bind:this={fichier} onchange={joindre} hidden />
          </div>
          <textarea rows="2" bind:value={texte} onkeydown={touche} placeholder={micro === "transcription" ? "Transcription…" : "Écris ton message (Entrée pour envoyer)"}></textarea>
          <button class="rond" class:ecoute={micro === "ecoute"} onclick={parler} disabled={micro === "transcription"} title="Parler">{micro === "ecoute" ? "⏹" : "🎙️"}</button>
        </div>
        <div class="ligne puces">
          <select class="puce" value={conv.mode} onchange={(e) => agir(() => agl.reglerConversation(conv!.id, { mode: e.currentTarget.value as Mode }))} title="Mode de la conversation">
            {#each Object.entries(NOMS_MODE) as [m, n]}<option value={m}>{n}</option>{/each}
          </select>
          <span class="puce" title="Contexte utilisé">Contexte {contexte} %<span class="jauge"><span style="width:{contexte}%"></span></span></span>
          {#if payant}<span class="puce" title="Estimation du coût de cette conversation">≈ {prix.toFixed(prix < 0.01 ? 4 : 2)} $</span>{/if}
          {#if conv.acces.length}<span class="puce" title={conv.acces.join("\n")}>📂 {conv.acces.length} dossier{conv.acces.length > 1 ? "s" : ""}</span>{/if}
        </div>
      </div>
    {:else}
      <p class="vide">Choisis une conversation.</p>
    {/if}
  </main>

  {#if nouvelle}
    <div class="voile" role="presentation" onclick={() => (nouvelle = null)}></div>
    <aside class="panneau">
      <h2>Nouvelle conversation</h2>
      <p class="sous">Choisis un agent, ou plusieurs pour une conversation tour par tour.</p>
      <div class="pile">
        {#each agents.filter((a) => a.moteur.type !== "externe") as a}
          <label class="ligne"><input type="checkbox" checked={nouvelle.includes(a.nom)} onchange={(e) => (nouvelle = e.currentTarget.checked ? [...nouvelle!, a.nom] : nouvelle!.filter((x) => x !== a.nom))} /> {a.emoji} {nomAffiche(a.nom)}</label>
        {/each}
      </div>
      <div class="ligne">
        <button class="principal" disabled={!nouvelle.length} onclick={() => { const n = nouvelle!; nouvelle = null; void agir(async () => { const r = await agl.nouvelleConversation(n); choisie = r.id; }); }}>Commencer</button>
        <button onclick={() => (nouvelle = null)}>Annuler</button>
      </div>
    </aside>
  {/if}
</div>

<style>
  .page {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: 18px;
    height: 100vh;
    box-sizing: border-box;
    padding-bottom: 14px !important;
  }
  .liste {
    display: grid;
    gap: 4px;
    align-content: start;
    overflow: auto;
  }
  .nouvelle {
    margin-bottom: 10px;
  }
  .conv {
    display: flex !important;
    gap: 10px;
    align-items: center;
    text-align: left;
    border: 1px solid transparent !important;
  }
  .conv.active {
    border-color: var(--border) !important;
    background: var(--surface-2) !important;
  }
  .epinglee {
    background: var(--surface-2) !important;
    margin-bottom: 8px;
  }
  .em {
    font-size: 20px;
  }
  .t {
    display: grid;
    min-width: 0;
  }
  .t small {
    color: var(--muted);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .separation {
    margin: 12px 4px 4px;
  }
  main {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
    height: 100%;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .espace {
    flex: 1;
  }
  .fil {
    overflow: auto;
    display: grid;
    gap: 12px;
    align-content: start;
    padding: 12px 4px;
  }
  .msg {
    max-width: 78%;
    display: grid;
    gap: 3px;
  }
  .msg.moi {
    justify-self: end;
  }
  .msg.systeme {
    justify-self: center;
    max-width: 90%;
    opacity: 0.8;
  }
  .auteur {
    font-size: 12px;
    color: var(--muted);
  }
  .bulle {
    padding: 10px 13px;
    border-radius: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    display: grid;
    gap: 8px;
  }
  .moi .bulle {
    background: var(--accent);
    color: var(--accent-text);
    border-color: var(--accent);
  }
  .quand {
    font-size: 10px;
    color: var(--faint);
  }
  .moi .quand {
    text-align: right;
  }
  .questions {
    display: grid;
    gap: 10px;
  }
  .q {
    display: grid;
    gap: 6px;
  }
  .ecrit {
    font-style: italic;
  }
  .saisie {
    display: grid;
    gap: 6px;
  }
  .passer {
    justify-self: center;
  }
  .barre-saisie {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 8px;
    background: var(--surface);
  }
  .barre-saisie textarea {
    flex: 1;
    border: 0 !important;
    background: transparent !important;
    resize: none;
  }
  .rond {
    width: 38px;
    height: 38px;
    border-radius: 50% !important;
    padding: 0 !important;
    font-size: 18px !important;
    flex: none;
  }
  .ecoute {
    background: #d9534f !important;
    color: #fff !important;
  }
  .plus-zone {
    position: relative;
  }
  .menu {
    position: absolute;
    bottom: 46px;
    left: 0;
    display: grid;
    gap: 2px;
    min-width: 240px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
    z-index: 5;
  }
  .menu button {
    border: 0 !important;
    text-align: left;
  }
  .puces {
    gap: 6px;
  }
  .puce {
    width: auto !important;
    padding: 3px 10px !important;
    border-radius: 999px !important;
    border: 1px solid var(--border);
    background: var(--surface-2) !important;
    font-size: 12px !important;
    color: var(--muted);
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
  .jauge {
    display: inline-block;
    width: 50px;
    height: 5px;
    border-radius: 9px;
    background: var(--field);
    overflow: hidden;
  }
  .jauge span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>

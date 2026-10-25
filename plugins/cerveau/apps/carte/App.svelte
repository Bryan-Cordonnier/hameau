<script lang="ts">
  // La carte du cerveau : lobes, aires et noyaux en pavés, reliés par des axones (parent → enfant) et des synapses (dossiers
  // qui se citent), avec un pont là où deux liens se croisent. On se promène (glisser, molette), on déplace les blocs, on ouvre
  // un bloc façon « aperçu » : sa description, son sommaire, ses neurones (fiches), qu'on lit et modifie.
  import { cerveau, type CarteCerveau, type NoeudArbre } from "@hameau/commun";
  import { blocs, croisements, iconeParDefaut, liens, NOMS_NIVEAUX, type Bloc } from "../../src/carte";

  const COULEURS = ["#6f8fd8", "#e0795f", "#5aa58a", "#c9963b", "#9a7bd1", "#d76c9a", "#6aa7b8", "#8a9a5b"];

  let donnees = $state<CarteCerveau | null>(null);
  let erreur = $state("");
  let vue = $state({ x: 0, y: 0, k: 0.6 });
  let survol = $state<string | null>(null);
  let ouvert = $state<NoeudArbre | null>(null);
  let neurone = $state<{ rel: string; texte: string; avant: string } | null>(null);
  let info = $state("");
  let svg = $state<SVGSVGElement>();
  let largeur = $state(1000);
  let hauteur = $state(700);

  async function charger(): Promise<void> {
    try {
      donnees = await cerveau.carte();
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();

  const positions = $derived(donnees?.disposition.positions ?? {});
  const icones = $derived(donnees?.disposition.icones ?? {});
  const liste = $derived(donnees ? blocs(donnees.arbre, positions) : []);
  const lobes = $derived(liste.filter((b) => b.niveau === 1).map((b) => b.rel));
  const couleur = (b: Bloc) => (b.niveau === 0 ? "#f2785a" : COULEURS[lobes.indexOf(b.lobe) % COULEURS.length]!);
  const traces = $derived(liens(liste, donnees?.synapses ?? []));
  const ponts = $derived(croisements(traces));
  const parRel = $derived(new Map(liste.map((b) => [b.rel, b])));
  const lie = (rel: string, l: { de: string; vers: string }) => l.de === rel || l.vers === rel;

  function trouver(n: NoeudArbre, rel: string): NoeudArbre | null {
    if (n.rel === rel) return n;
    for (const e of n.enfants) {
      const t = trouver(e, rel);
      if (t) return t;
    }
    return null;
  }

  // ---- déplacement de la vue et des blocs ----
  let glisse: { x: number; y: number; vx: number; vy: number } | null = null;
  let bloc: { rel: string; dx: number; dy: number; bouge: boolean } | null = null;
  const versMonde = (cx: number, cy: number) => {
    const r = svg!.getBoundingClientRect();
    return { x: (cx - r.left - vue.x) / vue.k, y: (cy - r.top - vue.y) / vue.k };
  };

  function bas(e: PointerEvent): void {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    glisse = { x: e.clientX, y: e.clientY, vx: vue.x, vy: vue.y };
  }
  function basBloc(e: PointerEvent, b: Bloc): void {
    e.stopPropagation();
    svg!.setPointerCapture(e.pointerId);
    const m = versMonde(e.clientX, e.clientY);
    bloc = { rel: b.rel, dx: m.x - b.x, dy: m.y - b.y, bouge: false };
  }
  function bouge(e: PointerEvent): void {
    if (bloc && donnees) {
      const m = versMonde(e.clientX, e.clientY);
      bloc.bouge = true;
      donnees.disposition = { ...donnees.disposition, positions: { ...positions, [bloc.rel]: [Math.round(m.x - bloc.dx), Math.round(m.y - bloc.dy)] } };
    } else if (glisse) {
      vue.x = glisse.vx + e.clientX - glisse.x;
      vue.y = glisse.vy + e.clientY - glisse.y;
    }
  }
  async function haut(): Promise<void> {
    if (bloc) {
      const b = bloc;
      bloc = null;
      if (!b.bouge) {
        ouvrir(b.rel);
      } else if (donnees) {
        await cerveau.disposer(donnees.disposition).catch((e) => (erreur = (e as Error).message));
      }
    }
    glisse = null;
  }
  function molette(e: WheelEvent): void {
    e.preventDefault();
    const r = svg!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const k = Math.min(2.4, Math.max(0.15, vue.k * Math.exp(-e.deltaY * 0.0014)));
    vue = { x: px - ((px - vue.x) * k) / vue.k, y: py - ((py - vue.y) * k) / vue.k, k };
  }
  function centrer(): void {
    vue = { x: largeur / 2, y: hauteur / 2, k: Math.min(largeur / 2300, hauteur / 1500, 0.9) };
  }
  $effect(() => {
    if (liste.length && vue.x === 0) centrer();
  });

  // ---- aperçu et édition ----
  function ouvrir(rel: string): void {
    if (!donnees) return;
    ouvert = trouver(donnees.arbre, rel);
    neurone = null;
    info = "";
  }
  async function lireNeurone(rel: string): Promise<void> {
    try {
      const texte = String(await cerveau.lire(rel));
      neurone = { rel, texte, avant: texte };
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  async function enregistrerNeurone(): Promise<void> {
    if (!neurone) return;
    try {
      info = String(await cerveau.ecrire(neurone.rel, neurone.texte, "modifié depuis la carte de Hameau"));
      neurone.avant = neurone.texte;
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  let nouveauNom = $state("");
  async function renommer(n: NoeudArbre): Promise<void> {
    const nom = nouveauNom.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!nom || nom === n.nom) return;
    nouveauNom = "";
    const vers = n.rel.replace(/[^/]+\/$/, `${nom}/`);
    try {
      info = String(await cerveau.deplacer(n.rel, vers));
      await charger();
      ouvrir(vers);
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  let nouvelleIcone = $state("");
  async function changerIcone(rel: string): Promise<void> {
    if (!donnees || !nouvelleIcone.trim()) return;
    donnees.disposition = { ...donnees.disposition, icones: { ...icones, [rel]: nouvelleIcone.trim().slice(0, 4) } };
    nouvelleIcone = "";
    await cerveau.disposer(donnees.disposition).catch((e) => (erreur = (e as Error).message));
  }
  let nouvelleBranche = $state("");
  async function creerBranche(parent: NoeudArbre): Promise<void> {
    const nom = nouvelleBranche.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!nom) return;
    const rel = `${parent.rel}${nom}/_dossier.md`;
    try {
      await cerveau.ecrire(rel, `# ${nouvelleBranche.trim()}\n\nNouvelle branche, créée depuis la carte de Hameau.\n`, "nouvelle branche depuis Hameau");
      nouvelleBranche = "";
      await charger();
      ouvrir(`${parent.rel}${nom}/`);
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  const niveauDe = (rel: string) => (rel === "" ? 0 : Math.min(3, rel.split("/").filter(Boolean).length)) as 0 | 1 | 2 | 3;
</script>

<div class="page" bind:clientWidth={largeur} bind:clientHeight={hauteur}>
  <svg
    bind:this={svg}
    role="application"
    aria-label="Carte du cerveau"
    onpointerdown={bas}
    onpointermove={bouge}
    onpointerup={haut}
    onpointercancel={haut}
    onwheel={molette}
  >
    <defs>
      <pattern id="points" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="var(--border)" /></pattern>
    </defs>
    <rect x="0" y="0" width="100%" height="100%" fill="url(#points)" />
    <g transform="translate({vue.x},{vue.y}) scale({vue.k})">
      {#each traces as l}
        {@const de = parRel.get(l.de)}
        {@const allume = survol !== null && lie(survol, l)}
        <path
          d={l.d}
          class={l.genre}
          class:allume
          class:eteint={survol !== null && !allume}
          stroke={l.genre === "axone" && de ? couleur(parRel.get(l.vers) ?? de) : undefined}
        />
      {/each}
      {#each ponts as p}
        <g transform="translate({p.x},{p.y}) rotate({(p.angle * 180) / Math.PI})" class="pont">
          <path d="M-9,0 h18" class="pont-fond" />
          <path d="M-9,0 a9,7 0 0 1 18,0" class="pont-arc" />
        </g>
      {/each}
      {#each liste as b (b.rel)}
        {@const c = couleur(b)}
        <g
          class="bloc niveau-{b.niveau}"
          class:choisi={ouvert?.rel === b.rel}
          transform="translate({b.x - b.l / 2},{b.y - b.h / 2})"
          role="button"
          tabindex="0"
          aria-label="{NOMS_NIVEAUX[b.niveau]} {b.nom}, {b.total} neurones"
          onpointerdown={(e) => basBloc(e, b)}
          onpointerenter={() => (survol = b.rel)}
          onpointerleave={() => (survol = null)}
          onkeydown={(e) => e.key === "Enter" && ouvrir(b.rel)}
        >
          <rect class="fond" width={b.l} height={b.h} rx="12" style="--c:{c}" />
          <rect width="6" height={b.h} rx="3" fill={c} />
          <text x="18" y={b.h / 2 + 7} class="emoji">{icones[b.rel] ?? iconeParDefaut(b.rel)}</text>
          <text x="46" y={b.h / 2 - (b.niveau === 0 ? 0 : 3)} class="nom">{b.nom}</text>
          {#if b.niveau > 0}<text x="46" y={b.h / 2 + 12} class="sous">{NOMS_NIVEAUX[b.niveau]} · {b.total} neurone{b.total > 1 ? "s" : ""}</text>{/if}
        </g>
      {/each}
    </g>
  </svg>

  <div class="barre">
    <button class="btn" onclick={centrer}>Recentrer</button>
    <button class="btn" onclick={charger}>Actualiser</button>
  </div>
  <div class="legende" aria-hidden="true">
    <b>Cerveau</b>
    <span>▭ lobe · aire · noyau</span>
    <span><i class="trait plein"></i> axone (parent → enfant)</span>
    <span><i class="trait pointille"></i> synapse (se citent)</span>
    <span>⌒ pont : croisement</span>
  </div>
  {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}

  {#if ouvert}
    {@const n = ouvert}
    <aside class="apercu" aria-label="Aperçu de {n.nom || 'Cerveau'}">
      <header>
        <span class="grosse">{icones[n.rel] ?? iconeParDefaut(n.rel)}</span>
        <div>
          <small>{NOMS_NIVEAUX[niveauDe(n.rel)]}</small>
          <h2>{n.titre ?? (n.nom || "Cerveau")}</h2>
        </div>
        <button class="btn" aria-label="Fermer l'aperçu" onclick={() => (ouvert = null)}>✕</button>
      </header>
      {#if neurone}
        <div class="editeur">
          <button class="lien-retour" onclick={() => (neurone = null)}>← {n.titre ?? n.nom}</button>
          <code>{neurone.rel}</code>
          <textarea bind:value={neurone.texte} aria-label="Contenu du neurone"></textarea>
          <div class="actions">
            <button class="btn primary" disabled={neurone.texte === neurone.avant} onclick={enregistrerNeurone}>Enregistrer</button>
            <span class="petit">Chaque version est gardée : rien ne se perd.</span>
          </div>
        </div>
      {:else}
        <div class="corps">
          {#if n.resume}<p class="resume">{n.resume}</p>{/if}
          <p class="petit">{n.total} neurone{n.total > 1 ? "s" : ""} en tout · {n.fiches.length} ici</p>
          {#if n.enfants.length}
            <h3>Sommaire</h3>
            <div class="sommaire">
              {#each n.enfants as e}
                <button class="entree" onclick={() => ouvrir(e.rel)}><span>{icones[e.rel] ?? iconeParDefaut(e.rel)}</span><b>{e.titre ?? e.nom}</b><small>{e.total}</small></button>
              {/each}
            </div>
          {/if}
          {#if n.fiches.length}
            <h3>Neurones</h3>
            <div class="neurones">
              {#each n.fiches as f}
                <button class="neurone" onclick={() => lireNeurone(f.rel)}><b>¶ {f.titre}</b><span>{f.resume}</span></button>
              {/each}
            </div>
          {/if}
          <h3>Modifier</h3>
          <div class="outils">
            {#if n.rel}
              <form onsubmit={(e) => (e.preventDefault(), renommer(n))}>
                <input class="saisie" bind:value={nouveauNom} placeholder={n.nom} aria-label="Nouveau nom du dossier" />
                <button class="btn" type="submit">Renommer</button>
              </form>
            {/if}
            <form onsubmit={(e) => (e.preventDefault(), changerIcone(n.rel))}>
              <input class="saisie" bind:value={nouvelleIcone} placeholder="Émoji" aria-label="Nouvelle icône" maxlength="4" />
              <button class="btn" type="submit">Changer l'icône</button>
            </form>
            <form onsubmit={(e) => (e.preventDefault(), creerBranche(n))}>
              <input class="saisie" bind:value={nouvelleBranche} placeholder="Nom de la nouvelle branche" aria-label="Nouvelle branche" />
              <button class="btn" type="submit">Créer</button>
            </form>
          </div>
          {#if info}<p class="info">{info}</p>{/if}
        </div>
      {/if}
    </aside>
  {/if}
</div>

<style>
  .page {
    position: relative;
    height: 100vh;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
  }
  .axone,
  .synapse {
    fill: none;
    transition: opacity 0.2s;
  }
  .axone {
    stroke-width: 3;
    opacity: 0.8;
  }
  .synapse {
    stroke: var(--muted);
    stroke-width: 1.4;
    stroke-dasharray: 5 6;
    opacity: 0.45;
  }
  .allume {
    opacity: 1;
    stroke-width: 4;
  }
  .synapse.allume {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .eteint {
    opacity: 0.15;
  }
  .pont-fond {
    stroke: var(--page, var(--surface));
    stroke-width: 7;
  }
  .pont-arc {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.6;
  }
  .bloc {
    cursor: pointer;
    transition: filter 0.2s;
  }
  .bloc .fond {
    fill: var(--surface);
    stroke: var(--c);
    stroke-width: 1.5;
    filter: drop-shadow(0 2px 4px #0001);
  }
  .bloc:hover .fond,
  .bloc:focus .fond,
  .bloc.choisi .fond {
    stroke-width: 3;
  }
  .bloc:focus {
    outline: none;
  }
  .niveau-0 .fond {
    stroke-width: 3;
  }
  .emoji {
    font-size: 20px;
  }
  .nom {
    font-weight: 700;
    font-size: 15px;
    fill: var(--text);
  }
  .niveau-0 .nom {
    font-size: 20px;
  }
  .niveau-3 .nom {
    font-size: 13px;
  }
  .sous {
    font-size: 11px;
    fill: var(--muted);
  }
  .barre {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    gap: 8px;
  }
  .legende {
    position: absolute;
    left: 14px;
    top: 14px;
    display: grid;
    gap: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 12.5px;
  }
  .trait {
    display: inline-block;
    width: 22px;
    vertical-align: middle;
    border-top: 3px solid var(--accent);
  }
  .trait.pointille {
    border-top: 2px dashed var(--muted);
  }
  .apercu {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: min(400px, calc(100% - 24px));
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 18px 50px #0003;
    display: flex;
    flex-direction: column;
    animation: apercu 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  }
  @keyframes apercu {
    from {
      opacity: 0;
      transform: scale(0.94) translateX(20px);
    }
  }
  .apercu header {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 14px 14px 8px;
  }
  .apercu header div {
    flex: 1;
    min-width: 0;
  }
  .apercu small {
    color: var(--muted);
    font-weight: 600;
  }
  .apercu h2 {
    margin: 0;
    font-size: 19px;
  }
  .grosse {
    font-size: 30px;
  }
  .corps,
  .editeur {
    overflow: auto;
    padding: 0 14px 14px;
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .editeur {
    flex: 1;
    grid-template-rows: auto auto 1fr auto;
  }
  .editeur textarea {
    min-height: 300px;
    resize: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    font: 13.5px/1.6 ui-monospace, Consolas, monospace;
    background: var(--field);
    color: var(--text);
  }
  .lien-retour {
    all: unset;
    cursor: pointer;
    color: var(--accent);
    font-weight: 600;
  }
  h3 {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .resume {
    margin: 0;
  }
  .sommaire,
  .neurones {
    display: grid;
    gap: 6px;
  }
  .entree,
  .neurone {
    all: unset;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 8px 10px;
  }
  .entree {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .entree b {
    flex: 1;
  }
  .entree small {
    color: var(--muted);
  }
  .neurone {
    display: grid;
    gap: 2px;
  }
  .neurone span {
    color: var(--muted);
    font-size: 12.5px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .entree:hover,
  .neurone:hover,
  .entree:focus-visible,
  .neurone:focus-visible {
    border-color: var(--accent);
  }
  .outils {
    display: grid;
    gap: 8px;
  }
  .outils form {
    display: flex;
    gap: 6px;
  }
  .outils input {
    flex: 1;
    min-width: 0;
  }
  .erreur {
    position: absolute;
    bottom: 12px;
    left: 14px;
    color: #c0392b;
    background: var(--surface);
    padding: 6px 10px;
    border-radius: 8px;
  }
  .info {
    color: #2e7d32;
    margin: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .apercu {
      animation: none;
    }
  }
</style>

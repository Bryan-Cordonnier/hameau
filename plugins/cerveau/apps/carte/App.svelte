<script lang="ts">
  // La carte du cerveau (cahier/01) : un éditeur qui range tout seul. Souris dans un bloc = le déplacer ; clic sur sa
  // bordure = tirer un fil vers son nouveau parent (il y part avec tout ce qu'il contient). Clic droit = Nouveau…
  // Clic sur un bloc = il s'ouvre dans une fenêtre par-dessus, texte mis en forme et modifiable. À droite : l'arbre, façon
  // explorateur, qui se déplie et se replie avec la flèche.
  import { connect } from "@etabli/sdk";
  import { agl, Recherche, type CarteDuCerveau, type NoeudCarte } from "@hameau/commun";
  import { couper, disposer, fils, NEURONE, NEURONE_TEXTE, PAS_ORGANISES, slug, SUPPRIMES, TEXTE, type Bloc } from "../../src/carte";
  import Editeur from "./Editeur.svelte";

  let donnees = $state<CarteDuCerveau | null>(null);
  let erreur = $state("");
  let info = $state("");
  let vue = $state({ x: 0, y: 0, k: 0.35 });
  let svg = $state<SVGSVGElement>();
  let largeur = $state(1000);
  let hauteur = $state(700);
  let arbreVisible = $state(false);
  let supprimesVisible = $state(false);
  let recherche = $state("");

  async function charger(): Promise<void> {
    try {
      donnees = await agl.carte();
      erreur = "";
    } catch (e) {
      erreur = (e as Error).message;
    }
  }
  void charger();
  async function agir(f: () => Promise<unknown>, message = ""): Promise<void> {
    try {
      const r = await f();
      info = message || (typeof r === "string" ? r : "");
      await charger();
    } catch (e) {
      erreur = (e as Error).message;
    }
  }

  const positions = $derived(donnees?.disposition.positions ?? {});
  const dispo = $derived(donnees ? disposer(donnees.arbre, donnees.noeuds, positions) : { blocs: [], grappes: [] });
  const traces = $derived(fils(dispo));
  let choisi = $state<string | null>(null);
  const parRel = $derived(new Map(dispo.blocs.map((b) => [b.rel, b])));
  const supprimes = $derived(donnees?.arbre.enfants.find((e) => e.rel === SUPPRIMES) ?? null);

  function trouver(n: NoeudCarte, rel: string): NoeudCarte | null {
    if (n.rel === rel) return n;
    for (const e of n.enfants) {
      const t = trouver(e, rel);
      if (t) return t;
    }
    return null;
  }

  // ---- vue : glisser le fond, molette ----
  const versMonde = (cx: number, cy: number) => {
    const r = svg!.getBoundingClientRect();
    return { x: (cx - r.left - vue.x) / vue.k, y: (cy - r.top - vue.y) / vue.k };
  };
  /** Toute la carte dans l'écran. */
  function centrer(): void {
    const b = dispo.blocs.filter((x) => !x.libre);
    if (!b.length) return void (vue = { x: largeur / 2, y: hauteur / 2, k: 0.35 });
    const [x0, x1] = [Math.min(...b.map((x) => x.x - x.l)), Math.max(...b.map((x) => x.x + x.l))];
    const [y0, y1] = [Math.min(...b.map((x) => x.y - x.h)), Math.max(...b.map((x) => x.y + x.h))];
    const k = Math.max(0.08, Math.min(1, (0.92 * largeur) / (x1 - x0), (0.85 * hauteur) / (y1 - y0)));
    vue = { x: largeur / 2 - ((x0 + x1) / 2) * k, y: hauteur / 2 + 20 - ((y0 + y1) / 2) * k, k };
  }
  $effect(() => {
    if (dispo.blocs.length && vue.x === 0) centrer();
  });
  function centrerSur(x: number, y: number, k = Math.max(vue.k, 0.9)): void {
    vue = { x: largeur / 2 - x * k, y: hauteur / 2 - y * k, k };
  }
  function molette(e: WheelEvent): void {
    e.preventDefault();
    const r = svg!.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const k = Math.min(2.5, Math.max(0.08, vue.k * Math.exp(-e.deltaY * 0.0014)));
    vue = { x: px - ((px - vue.x) * k) / vue.k, y: py - ((py - vue.y) * k) / vue.k, k };
  }

  // ---- interactions : déplacer, tirer un fil ----
  type Prise = { genre: "fond"; x: number; y: number; vx: number; vy: number } | { genre: "bloc"; cle: string; dx: number; dy: number; bouge: boolean; rel: string } | { genre: "fil"; de: string; x: number; y: number; cx: number; cy: number };
  let prise = $state<Prise | null>(null);
  let fil = $state<{ de: string; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const surBord = (b: { x: number; y: number; l: number; h: number }, m: { x: number; y: number }) => {
    const bx = Math.abs(m.x - b.x) - b.l / 2;
    const by = Math.abs(m.y - b.y) - b.h / 2;
    // une bordure de 9 px à l'écran, mais jamais plus d'un cinquième du bloc : de loin, cliquer au milieu ouvre toujours
    const marge = Math.min(9 / vue.k, Math.min(b.l, b.h) * 0.2);
    return bx > -marge || by > -marge;
  };
  function basFond(e: PointerEvent): void {
    if (e.button !== 0) return;
    menu = null;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    prise = { genre: "fond", x: e.clientX, y: e.clientY, vx: vue.x, vy: vue.y };
  }
  function basBloc(e: PointerEvent, cle: string, rel: string, b: { x: number; y: number; l: number; h: number }): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    menu = null;
    svg!.setPointerCapture(e.pointerId);
    const m = versMonde(e.clientX, e.clientY);
    if (surBord(b, m) && rel !== "" && !rel.endsWith("souvenirs")) {
      prise = { genre: "fil", de: rel, x: b.x, y: b.y, cx: e.clientX, cy: e.clientY };
      fil = { de: rel, x1: b.x, y1: b.y, x2: m.x, y2: m.y };
    } else {
      prise = { genre: "bloc", cle, dx: m.x - b.x, dy: m.y - b.y, bouge: false, rel };
    }
  }
  function bouge(e: PointerEvent): void {
    if (!prise || !donnees) return;
    if (prise.genre === "fond") {
      vue.x = prise.vx + e.clientX - prise.x;
      vue.y = prise.vy + e.clientY - prise.y;
    } else if (prise.genre === "bloc") {
      const m = versMonde(e.clientX, e.clientY);
      prise.bouge = true;
      donnees.disposition = { ...donnees.disposition, positions: { ...positions, [prise.cle]: [Math.round(m.x - prise.dx), Math.round(m.y - prise.dy)] } };
    } else if (fil) {
      const m = versMonde(e.clientX, e.clientY);
      fil = { ...fil, x2: m.x, y2: m.y };
    }
  }
  async function haut(e: PointerEvent): Promise<void> {
    const p = prise;
    prise = null;
    if (!p || !donnees) return;
    if (p.genre === "bloc") {
      if (!p.bouge) {
        choisi = p.rel;
        void ouvrir(p.rel);
      }
      else await agl.disposer(donnees.disposition).catch((x) => (erreur = (x as Error).message));
    } else if (p.genre === "fil" && fil) {
      const m = versMonde(e.clientX, e.clientY);
      fil = null;
      // un clic sur la bordure, sans tirer : on ouvre le bloc
      if (Math.hypot(e.clientX - p.cx, e.clientY - p.cy) < 5) {
        choisi = p.de;
        return void ouvrir(p.de);
      }
      const cible = dispo.blocs.find((b) => !b.libre && Math.abs(m.x - b.x) < b.l / 2 && Math.abs(m.y - b.y) < b.h / 2);
      if (cible && cible.rel !== p.de) await relier(p.de, cible.rel);
    }
  }
  async function relier(de: string, parent: string): Promise<void> {
    const n = donnees ? trouver(donnees.arbre, de) : null;
    const quoi = de.endsWith(".md") ? "cette fiche" : `« ${n?.titre ?? de} »${n?.total ? ` et ses ${n.total} fiche${n.total > 1 ? "s" : ""}` : ""}`;
    const nomParent = parRel.get(parent)?.nom ?? (parent || "le cerveau");
    if (!confirm(`Relier ${quoi} à « ${nomParent} » ? Il y part avec tout ce qu'il contient, et les sommaires se réorganisent.`)) return;
    await agir(() => agl.relier(de, parent), "Relié : les sommaires sont à jour.");
  }

  // ---- clic droit : Nouveau… ----
  let menu = $state<{ x: number; y: number; parent: string; rel: string | null } | null>(null);
  function contexte(e: MouseEvent, rel: string | null): void {
    e.preventDefault();
    e.stopPropagation();
    const r = svg!.getBoundingClientRect();
    menu = { x: e.clientX - r.left, y: e.clientY - r.top, parent: rel ?? "", rel };
  }
  let creation = $state<{ genre: "pole" | "sujet" | "section" | "neurone" | "souvenir"; parent: string; nom: string; description: string; texte: string; emoji: string; fichier: File | null } | null>(null);
  function nouveau(genre: NonNullable<typeof creation>["genre"]): void {
    creation = { genre, parent: menu?.rel?.endsWith(".md") ? "" : (menu?.parent ?? ""), nom: "", description: "", texte: "", emoji: genre === "neurone" ? "📄" : genre === "souvenir" ? "🖼️" : "📁", fichier: null };
    menu = null;
  }
  async function creer(): Promise<void> {
    const c = creation!;
    creation = null;
    if (c.genre === "neurone") {
      const dossier = c.parent || PAS_ORGANISES;
      const rel = `${dossier}${slug(c.nom)}.md`;
      await agir(() => agl.ecrire(rel, `# ${c.nom.trim()}\n\n${c.description.trim() || c.nom.trim()}\n\n${c.texte.trim()}\n`, "Nouveau neurone depuis la carte"), "Neurone créé.");
    } else if (c.genre === "souvenir" && c.fichier) {
      const f = c.fichier;
      if (f.size > 10 * 1024 * 1024) {
        erreur = "Un souvenir fait 10 Mo au plus.";
        return;
      }
      const data = await new Promise<string>((ok) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.readAsDataURL(f);
      });
      await agir(() => agl.ajouterSouvenir(c.parent || PAS_ORGANISES, f.name, c.nom || f.name, data), "Souvenir ajouté.");
    } else {
      await agir(() => agl.creerBloc({ parent: c.parent, name: c.nom, level: c.genre, description: c.description, emoji: c.emoji }), c.parent ? "Bloc créé." : "Bloc créé dans « Pas organisés » : tire un fil depuis sa bordure pour le relier.");
    }
  }

  // ---- un bloc ouvert ----
  let ouvert = $state<{ rel: string; titre: string; dossier: boolean; texte: string; avant: string; noeud: NoeudCarte | null; souvenirs?: { rel: string; titre: string }[] } | null>(null);
  let image = $state<{ rel: string; url: string; titre: string } | null>(null);
  async function ouvrir(rel: string): Promise<void> {
    if (!donnees) return;
    menu = null;
    modifie = false;
    image = null;
    if (rel.endsWith("souvenirs")) {
      const noeud = trouver(donnees.arbre, rel.replace(/souvenirs$/, ""));
      ouvert = { rel, titre: "🖼️ Souvenirs", dossier: false, texte: "", avant: "", noeud, souvenirs: noeud?.souvenirs ?? [] };
      return;
    }
    const dossier = !rel.endsWith(".md");
    const noeud = dossier ? trouver(donnees.arbre, rel) : null;
    const fichier = dossier ? `${rel}_dossier.md` : rel;
    const texte = rel === "" ? "" : String(await agl.lire(fichier).catch(() => (dossier ? `# ${noeud?.titre ?? rel}\n\nDescription du dossier.\n` : "")));
    ouvert = { rel, titre: dossier ? (noeud?.titre ?? (rel || "Cerveau")) : (texte.match(/^# (.+)/m)?.[1] ?? rel), dossier, texte, avant: texte, noeud };
  }
  let modifie = $state(false);
  function fermerOuvert(): void {
    if (modifie && !confirm("Fermer sans enregistrer les changements ?")) return;
    ouvert = null;
    image = null;
    modifie = false;
  }
  async function enregistrer(): Promise<void> {
    if (!ouvert) return;
    const fichier = ouvert.dossier ? `${ouvert.rel}_dossier.md` : ouvert.rel;
    const t = ouvert.texte;
    await agir(() => agl.ecrire(fichier, t, "Modifié depuis la carte du cerveau"), "Enregistré : les sommaires sont à jour.");
    modifie = false;
  }
  async function voirImage(s: { rel: string; titre: string }): Promise<void> {
    const r = await agl.souvenir(s.rel);
    image = { rel: s.rel, titre: s.titre, url: `data:${r.mime};base64,${r.donnees}` };
  }
  const blocDe = (rel: string): Bloc | undefined => parRel.get(rel);

  // ---- recherche sur la carte ----
  function chercherSurCarte(): void {
    const q = recherche.trim().toLowerCase();
    if (!q) return;
    const b = dispo.blocs.find((x) => x.nom.toLowerCase().includes(q));
    if (b) return centrerSur(b.x, b.y);
    for (const g of dispo.grappes) {
      const n = g.neurones.find((x) => x.titre.toLowerCase().includes(q));
      if (n) return centrerSur(n.x, n.y, 1.1);
    }
    info = "Rien de tel sur la carte.";
  }
  async function rangerCarte(): Promise<void> {
    if (!donnees || !confirm("Replacer tous les blocs proprement (les positions posées à la main sont oubliées) ?")) return;
    donnees.disposition = { ...donnees.disposition, positions: {} };
    await agl.disposer(donnees.disposition).catch((e) => (erreur = (e as Error).message));
    centrer();
  }
  void connect();

  // ---- arbre (panneau latéral) : glisser un élément sur un dossier pour le ranger ----
  let tireArbre = $state<string | null>(null);
  async function deposerArbre(parent: string): Promise<void> {
    const de = tireArbre;
    tireArbre = null;
    if (de && de !== parent && !parent.startsWith(de)) await relier(de, parent);
  }
  const visiblesRacine = (n: NoeudCarte) => n.enfants.filter((e) => e.rel !== SUPPRIMES);
</script>

{#snippet noeudArbre(n: NoeudCarte, prof: number)}
  <div class="arbre-noeud" style="padding-left:{prof * 12}px">
    <div class="arbre-ligne" role="treeitem" aria-selected="false" tabindex="0" draggable={n.rel !== ""} ondragstart={() => (tireArbre = n.rel)} ondragover={(e) => e.preventDefault()} ondrop={() => deposerArbre(n.rel)} onclick={() => { const b = blocDe(n.rel); if (b) centrerSur(b.x, b.y); void ouvrir(n.rel); }} onkeydown={(e) => e.key === "Enter" && ouvrir(n.rel)}>
      {blocDe(n.rel)?.emoji || "🧠"} {n.titre ?? (n.nom || "Cerveau")} <span class="sous">{n.total}</span>
    </div>
    {#each prof === 0 ? visiblesRacine(n) : n.enfants as e (e.rel)}{@render noeudArbre(e, prof + 1)}{/each}
    {#each n.fiches as f (f.rel)}
      <div class="arbre-ligne fiche" style="padding-left:{(prof + 1) * 12}px" role="treeitem" aria-selected="false" tabindex="0" draggable="true" ondragstart={() => (tireArbre = f.rel)} onclick={() => ouvrir(f.rel)} onkeydown={(e) => e.key === "Enter" && ouvrir(f.rel)}>📄 {f.titre}</div>
    {/each}
  </div>
{/snippet}

{#snippet supprime(n: NoeudCarte)}
  {#each n.enfants as e (e.rel)}
    <div class="ligne sup"><span>📁 {e.rel.slice(SUPPRIMES.length)}</span><span class="espace"></span>
      <button class="petit" onclick={() => agir(() => agl.restaurer(e.rel))}>Restaurer</button>
      <button class="petit danger" onclick={() => confirm(`Supprimer définitivement ${e.rel.slice(SUPPRIMES.length)} ?`) && agir(() => agl.purger(e.rel))}>Supprimer définitivement</button></div>
  {/each}
  {#each n.fiches as f (f.rel)}
    <div class="ligne sup"><span>📄 {f.rel.slice(SUPPRIMES.length)}</span><span class="espace"></span>
      <button class="petit" onclick={() => agir(() => agl.restaurer(f.rel))}>Restaurer</button>
      <button class="petit danger" onclick={() => confirm(`Supprimer définitivement ${f.titre} ?`) && agir(() => agl.purger(f.rel))}>Supprimer définitivement</button></div>
  {/each}
{/snippet}

<Recherche />
<div class="agl carte-page" bind:clientWidth={largeur} bind:clientHeight={hauteur}>
  <div class="outils">
    <input class="cherche" bind:value={recherche} placeholder="Trouver sur la carte" onkeydown={(e) => e.key === "Enter" && chercherSurCarte()} />
    <button onclick={rangerCarte}>Ranger la carte</button>
    <button onclick={centrer}>Recentrer</button>
    <button onclick={() => (supprimesVisible = !supprimesVisible)}>🗑️ Supprimés</button>
  </div>
  {#if erreur}<p class="erreur flottant">{erreur} <button class="petit" onclick={() => (erreur = "")}>OK</button></p>{/if}
  {#if info}<p class="info flottant">{info} <button class="petit" onclick={() => (info = "")}>OK</button></p>{/if}

  <svg
    bind:this={svg}
    role="application"
    aria-label="Carte du cerveau"
    onpointerdown={basFond}
    onpointermove={bouge}
    onpointerup={haut}
    onpointercancel={haut}
    onwheel={molette}
    oncontextmenu={(e) => contexte(e, null)}
  >
    <defs><pattern id="points" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.1" fill="var(--border)" /></pattern></defs>
    <rect width="100%" height="100%" fill="url(#points)" />
    <g transform="translate({vue.x},{vue.y}) scale({vue.k})">
      {#each traces as t}<path d={t.d} class="fil" stroke={t.couleur} />{/each}
      {#if fil}<line x1={fil.x1} y1={fil.y1} x2={fil.x2} y2={fil.y2} class="fil-tire" />{/if}
      {#each dispo.grappes as g (g.dossier)}
        <g>
          {#each g.neurones as n (n.rel)}
            <g
              class="neurone"
              class:choisi={choisi === n.rel}
              role="button"
              tabindex="-1"
              transform="translate({n.x},{n.y})"
              onpointerdown={(e) => basBloc(e, `${g.dossier}#neurones`, n.rel, { x: n.x, y: n.y, l: NEURONE[0], h: NEURONE[1] })}
              oncontextmenu={(e) => contexte(e, n.rel)}
            >
              <rect x={-NEURONE[0] / 2} y={-NEURONE[1] / 2} width={NEURONE[0]} height={NEURONE[1]} rx="8" style="--c:{n.couleur}" class:souvenirs={!!n.souvenirs} />
              <text x={-NEURONE[0] / 2 + 10} y="4" style="font-size:{NEURONE_TEXTE}px">{n.souvenirs ? "🖼️" : "📄"} {couper(n.titre, NEURONE[0], NEURONE_TEXTE)}</text>
            </g>
          {/each}
        </g>
      {/each}
      {#each dispo.blocs as b (b.rel)}
        <g
          class="bloc {b.etage}"
          class:libre={b.libre}
          class:choisi={choisi === b.rel}
          role="button"
          tabindex="-1"
          transform="translate({b.x},{b.y})"
          onpointerdown={(e) => basBloc(e, b.rel, b.rel, b)}
          ondblclick={() => centrerSur(b.x, b.y)}
          oncontextmenu={(e) => contexte(e, b.rel)}
        >
          <rect x={-b.l / 2} y={-b.h / 2} width={b.l} height={b.h} rx={b.etage === "cerveau" ? 22 : 12} style="--c:{b.couleur}" />
          {#if b.etage === "cerveau"}
            <text x="0" y="10" text-anchor="middle" class="t-cerveau" style="font-size:{TEXTE.cerveau}px">🧠 Cerveau</text>
          {:else}
            <text x={-b.l / 2 + 14} y={TEXTE[b.etage] * 0.36} class="t-{b.etage}" style="font-size:{TEXTE[b.etage]}px">{b.emoji} {couper(b.nom, b.l, TEXTE[b.etage])}</text>
          {/if}
        </g>
      {/each}
    </g>
  </svg>

  {#if menu}
    <div class="menu" style="left:{menu.x}px; top:{menu.y}px">
      {#if menu.rel !== null && menu.rel !== ""}<button onclick={() => { const r = menu!.rel!; menu = null; void ouvrir(r); }}>Ouvrir</button>{/if}
      <div class="sous titre-menu">Nouveau{menu.rel && !menu.rel.endsWith(".md") ? " dans ce bloc" : " (pas organisé)"}</div>
      {#if !menu.rel}<button onclick={() => nouveau("pole")}>📁 Pôle</button>{/if}
      <button onclick={() => nouveau("sujet")}>📁 Sujet</button>
      <button onclick={() => nouveau("section")}>📁 Section</button>
      <button onclick={() => nouveau("neurone")}>📄 Neurone</button>
      <button onclick={() => nouveau("souvenir")}>🖼️ Souvenir</button>
      {#if menu.rel}
        <div class="sous titre-menu">Ce bloc</div>
        {#if !menu.rel.endsWith(".md")}
          <label class="ligne couleur">Couleur <input type="color" value={blocDe(menu.rel)?.couleur ?? "#888888"} onchange={(e) => { const r = menu!.rel!; void agir(() => agl.reglerBloc({ rel: r, color: e.currentTarget.value })); }} /></label>
          <button onclick={() => { const r = menu!.rel!; const em = prompt("Émoji du bloc :", blocDe(r)?.emoji ?? "📁"); menu = null; if (em) void agir(() => agl.reglerBloc({ rel: r, emoji: em.trim().slice(0, 4) })); }}>Changer l'émoji</button>
          <button onclick={() => { const r = menu!.rel!; menu = null; void agir(() => agl.reglerBloc({ rel: r, level: blocDe(r)?.etage === "pole" ? "sujet" : blocDe(r)?.etage === "sujet" ? "section" : "pole" })); }}>Changer d'étage</button>
        {/if}
        <button class="danger" onclick={() => { const r = menu!.rel!; menu = null; if (confirm("Mettre dans Supprimés (rien n'est effacé) ?")) void agir(() => agl.supprimer(r)); }}>Supprimer</button>
      {/if}
    </div>
  {/if}

  <button class="plier" class:ouvert={arbreVisible} onclick={() => (arbreVisible = !arbreVisible)} title={arbreVisible ? "Replier l'arbre" : "Déplier l'arbre"} aria-label={arbreVisible ? "Replier l'arbre" : "Déplier l'arbre"} aria-expanded={arbreVisible}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
  {#if arbreVisible && donnees}
    <aside class="arbre">
      <div class="arbre-tete"><b>Arbre</b><span class="sous">glisse un élément sur un dossier pour le ranger</span></div>
      {@render noeudArbre(donnees.arbre, 0)}
    </aside>
  {/if}

  {#if supprimesVisible}
    <div class="voile" role="presentation" onclick={() => (supprimesVisible = false)}></div>
    <aside class="panneau">
      <div class="ligne"><h2>🗑️ Supprimés</h2><span class="espace"></span><button onclick={() => (supprimesVisible = false)}>✕</button></div>
      <p class="sous">Invisible pour les agents. Rien n'y est effacé tant que tu ne le demandes pas.</p>
      {#if supprimes && (supprimes.enfants.length || supprimes.fiches.length)}
        {@render supprime(supprimes)}
        <button class="danger" onclick={() => confirm("Tout vider ? Ce qui est dans Supprimés disparaît (l'historique Git le garde).") && agir(() => agl.purger(null))}>Tout vider</button>
      {:else}<p class="vide">Rien.</p>{/if}
    </aside>
  {/if}

  {#if creation}
    <div class="voile" role="presentation" onclick={() => (creation = null)}></div>
    <aside class="panneau">
      <h2>Nouveau {creation.genre === "pole" ? "pôle" : creation.genre}</h2>
      <p class="sous">{creation.parent ? `Dans « ${blocDe(creation.parent)?.nom ?? creation.parent} »` : "Sans parent : il ira dans « Pas organisés » jusqu'à ce que tu le relies."}</p>
      {#if creation.genre === "souvenir"}
        <input type="file" accept="image/*,.pdf" onchange={(e) => (creation!.fichier = e.currentTarget.files?.[0] ?? null)} />
        <label class="champ">Titre (sa description)<input bind:value={creation.nom} /></label>
      {:else}
        <div class="ligne">{#if creation.genre !== "neurone"}<input class="emoji" bind:value={creation.emoji} maxlength="4" />{/if}<input bind:value={creation.nom} placeholder="Nom" /></div>
        <label class="champ">{creation.genre === "neurone" ? "Résumé (2-3 lignes)" : "Description"}<textarea rows="3" bind:value={creation.description}></textarea></label>
        {#if creation.genre === "neurone"}<label class="champ">Le texte<textarea rows="10" bind:value={creation.texte}></textarea></label>{/if}
      {/if}
      <div class="ligne">
        <button class="principal" disabled={creation.genre === "souvenir" ? !creation.fichier : !creation.nom.trim()} onclick={creer}>Créer</button>
        <button onclick={() => (creation = null)}>Annuler</button>
      </div>
    </aside>
  {/if}

  {#if ouvert}
    {@const o = ouvert}
    <div class="scrim" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && fermerOuvert()}>
      <div class="fenetre" role="dialog" aria-modal="true" aria-label={o.titre}>
        <div class="tete">
          <span class="pastille-bloc">{o.dossier ? (blocDe(o.rel)?.emoji ?? "📁") : o.souvenirs ? "🖼️" : "📄"}</span>
          <div class="tete-texte"><h2>{o.titre}</h2><span class="sous">{o.rel || "Cerveau"}{o.dossier && o.noeud ? ` · ${o.noeud.total} fiche${o.noeud.total > 1 ? "s" : ""}` : ""}</span></div>
          <span class="espace"></span>
          {#if !o.souvenirs && o.rel !== ""}<button class="principal" disabled={!modifie} onclick={enregistrer}>Enregistrer</button>{/if}
          <button class="fermer" onclick={fermerOuvert} aria-label="Fermer">✕</button>
        </div>
        {#if o.souvenirs}
          <div class="corps">
            <div class="galerie">
              {#each o.souvenirs as s}<button class="vignette" onclick={() => voirImage(s)}>🖼️ {s.titre}</button>{/each}
            </div>
            {#if image}<figure><img src={image.url} alt={image.titre} /><figcaption class="sous">{image.titre}</figcaption></figure>{/if}
          </div>
        {:else if o.rel === ""}
          <div class="corps"><p class="sous">Le point de départ de tout le cerveau.</p></div>
        {:else}
          {#key o.rel}<Editeur texte={o.texte} onchange={(md, m) => { o.texte = md; modifie = m; }} />{/key}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .carte-page {
    position: relative;
    height: 100vh;
    padding: 0 !important;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .outils {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 62px;
    display: flex;
    gap: 8px;
    z-index: 3;
  }
  .cherche {
    width: 240px !important;
  }
  .flottant {
    position: absolute;
    top: 58px;
    left: 12px;
    z-index: 3;
    background: var(--surface);
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
  }
  .fil {
    fill: none;
    stroke-width: 2.4;
    opacity: 0.55;
  }
  .fil-tire {
    stroke: var(--accent);
    stroke-width: 3;
    stroke-dasharray: 8 6;
  }
  .bloc rect {
    fill: var(--surface);
    stroke: var(--c);
    stroke-width: 2;
  }
  .bloc.cerveau rect {
    fill: var(--accent);
    stroke-width: 0;
  }
  .bloc.pole rect {
    stroke-width: 3.5;
  }
  .bloc.libre rect {
    stroke-dasharray: 7 5;
  }
  .bloc {
    cursor: move;
  }
  .bloc:hover rect,
  .neurone:hover rect {
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.18));
  }
  /* Pas de cadre du navigateur autour d'un bloc cliqué : le bloc choisi a juste un trait plus marqué. */
  .bloc:focus,
  .neurone:focus {
    outline: none;
  }
  .bloc.choisi rect {
    stroke-width: 4;
  }
  .neurone.choisi rect {
    stroke-width: 2.5;
  }
  text {
    fill: var(--text);
    pointer-events: none;
  }
  .t-cerveau {
    fill: var(--accent-text);
    font-weight: 800;
  }
  .t-pole {
    font-weight: 700;
  }
  .t-sujet {
    font-weight: 600;
  }
  .neurone rect {
    fill: var(--surface-2);
    stroke: var(--c);
    stroke-width: 1;
  }
  .neurone rect.souvenirs {
    stroke-width: 2;
  }
  .neurone {
    cursor: pointer;
  }
  .menu {
    position: absolute;
    z-index: 10;
    display: grid;
    gap: 2px;
    min-width: 200px;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }
  .menu button {
    border: 0 !important;
    text-align: left;
  }
  .titre-menu {
    padding: 6px 8px 2px;
    font-size: 11px;
  }
  .couleur {
    padding: 4px 10px;
    font-size: 13px;
  }
  .couleur input {
    width: 40px !important;
    padding: 0 !important;
  }
  .arbre {
    position: absolute;
    top: 12px;
    right: 12px;
    bottom: 12px;
    width: 320px;
    overflow: auto;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    z-index: 4;
  }
  .arbre-ligne {
    padding: 3px 6px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .arbre-ligne:hover {
    background: var(--surface-2);
  }
  .fiche {
    color: var(--muted);
    font-size: 12px;
  }
  /* Bloc ouvert : une fenêtre par-dessus la carte, comme l'aperçu rapide d'Établi. */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: 5vh 6vw;
    background: rgba(10, 14, 20, 0.42);
    animation: fondu 0.15s ease-out;
  }
  @keyframes fondu {
    from {
      opacity: 0;
    }
  }
  .fenetre {
    width: min(1000px, 100%);
    height: min(760px, 100%);
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  .tete {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 0 14px 0 18px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }
  .pastille-bloc {
    font-size: 24px;
  }
  .tete-texte {
    display: grid;
    min-width: 0;
  }
  .tete-texte h2,
  .tete-texte .sous {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fermer {
    width: 36px;
    height: 36px;
    padding: 0 !important;
  }
  .corps {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  /* Flèche en haut à droite : déplie et replie l'arbre. */
  .plier {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 5;
    width: 38px;
    height: 38px;
    padding: 0 !important;
    display: grid;
    place-items: center;
  }
  .plier svg {
    transition: transform 0.15s;
  }
  .plier.ouvert svg {
    transform: rotate(180deg);
  }
  .arbre-tete {
    display: grid;
    gap: 2px;
    padding: 0 42px 10px 0;
    min-height: 38px;
  }
  .emoji {
    width: 60px !important;
    text-align: center;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .flex,
  .espace {
    flex: 1;
  }
  .galerie {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  figure img {
    max-width: 100%;
    border-radius: 10px;
  }
  .sup {
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
</style>

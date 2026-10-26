<script lang="ts">
  // Le bureau fixe de l'accueil, dessiné en SVG isométrique : murs, meubles en blocs, agents en pions plats qui marchent
  // d'un poste à l'autre. Couleurs tirées du thème (presque monochrome) ; seuls les agents, écrans et voyants sont colorés.
  // Au survol d'un agent, `onSurvol` reçoit l'agent et sa position à l'écran (pour la carte de raccourcis).
  import { BLOCS, iso, LARGEUR, POSTES, PROFONDEUR, profondeur, type Bloc } from "./plan";
  import { EMOJI, type Acteur, type Troupe } from "./troupe.svelte";

  let { troupe, onSurvol }: { troupe: Troupe; onSurvol: (a: Acteur | null, ecran: { x: number; y: number } | null) => void } = $props();

  const MUR = 1.4;
  const coins = [iso(0, 0, MUR), iso(LARGEUR, 0, MUR), iso(0, PROFONDEUR), iso(LARGEUR, PROFONDEUR)];
  const minX = Math.min(...coins.map((c) => c.X)) - 40;
  const maxX = Math.max(...coins.map((c) => c.X)) + 40;
  const minY = Math.min(...coins.map((c) => c.Y)) - 60;
  const maxY = Math.max(...coins.map((c) => c.Y)) + 30;

  const pts = (l: { X: number; Y: number }[]) => l.map((p) => `${p.X.toFixed(1)},${p.Y.toFixed(1)}`).join(" ");
  const sol = pts([iso(0, 0), iso(LARGEUR, 0), iso(LARGEUR, PROFONDEUR), iso(0, PROFONDEUR)]);
  const murFond = pts([iso(0, 0), iso(LARGEUR, 0), iso(LARGEUR, 0, MUR), iso(0, 0, MUR)]);
  const murGauche = pts([iso(0, 0), iso(0, PROFONDEUR), iso(0, PROFONDEUR, MUR), iso(0, 0, MUR)]);
  // un quadrillage discret au sol
  const lignes = [
    ...Array.from({ length: LARGEUR - 1 }, (_, i) => [iso(i + 1, 0), iso(i + 1, PROFONDEUR)]),
    ...Array.from({ length: PROFONDEUR - 1 }, (_, i) => [iso(0, i + 1), iso(LARGEUR, i + 1)]),
  ];

  function faces(b: Bloc) {
    const z = b.z ?? 0;
    const h = z + b.h;
    return {
      dessus: pts([iso(b.x, b.y, h), iso(b.x + b.l, b.y, h), iso(b.x + b.l, b.y + b.p, h), iso(b.x, b.y + b.p, h)]),
      devant: pts([iso(b.x, b.y + b.p, h), iso(b.x + b.l, b.y + b.p, h), iso(b.x + b.l, b.y + b.p, z), iso(b.x, b.y + b.p, z)]),
      cote: pts([iso(b.x + b.l, b.y, h), iso(b.x + b.l, b.y + b.p, h), iso(b.x + b.l, b.y + b.p, z), iso(b.x + b.l, b.y, z)]),
    };
  }

  type Element = { genre: "bloc"; b: Bloc; d: number } | { genre: "acteur"; a: Acteur; d: number };
  const elements = $derived<Element[]>(
    [
      ...BLOCS.map((b) => ({ genre: "bloc" as const, b, d: profondeur(b.x + b.l * 0.5, b.y + b.p * 0.5) + (b.z ?? 0) * 0.01 })),
      ...troupe.acteurs.map((a) => ({ genre: "acteur" as const, a, d: profondeur(a.x, a.y) + 0.3 })),
    ].sort((p, q) => p.d - q.d),
  );

  function survoler(e: MouseEvent, a: Acteur | null): void {
    if (!a) return onSurvol(null, null);
    const r = (e.currentTarget as SVGGraphicsElement).getBoundingClientRect();
    onSurvol(a, { x: r.left + r.width / 2, y: r.top });
  }
</script>

<svg viewBox="{minX} {minY} {maxX - minX} {maxY - minY}" class="bureau" role="img" aria-label="Le bureau des agents">
  <polygon points={sol} class="sol" />
  {#each lignes as [a, b]}<line x1={a!.X} y1={a!.Y} x2={b!.X} y2={b!.Y} class="grille" />{/each}
  <polygon points={murFond} class="mur" />
  <polygon points={murGauche} class="mur sombre" />
  <!-- les zones, nommées au survol -->
  {#each Object.entries(POSTES) as [id, p] (id)}
    {@const c = iso(p.places[0]!.x, p.places[0]!.y)}
    <ellipse cx={c.X} cy={c.Y} rx="34" ry="17" class="zone"><title>{p.emoji} {p.nom}</title></ellipse>
  {/each}

  {#each elements as el (el.genre === "bloc" ? el.b : el.a.id)}
    {#if el.genre === "bloc"}
      {@const f = faces(el.b)}
      {#if el.b.teinte === "plante"}
        <!-- une plante : un pot en bloc, un feuillage rond -->
        {@const pot = faces({ ...el.b, x: el.b.x + 0.1, y: el.b.y + 0.1, l: el.b.l - 0.2, p: el.b.p - 0.2, h: 0.3 })}
        {@const c = iso(el.b.x + el.b.l / 2, el.b.y + el.b.p / 2, 0.62)}
        <g class="bloc clair"><polygon points={pot.cote} class="f-cote" /><polygon points={pot.devant} class="f-devant" /><polygon points={pot.dessus} class="f-dessus" /></g>
        <circle cx={c.X} cy={c.Y} r="17" class="feuilles" /><circle cx={c.X - 6} cy={c.Y - 6} r="9" class="feuilles clair" />
      {:else}
        <g class="bloc {el.b.teinte}" class:note={el.b.couleur} class:allume={el.b.teinte === "voyant" && troupe.modeleAllume} style={el.b.couleur ? `--n:${el.b.couleur}` : ""}>
          <polygon points={f.cote} class="f-cote" />
          <polygon points={f.devant} class="f-devant" />
          <polygon points={f.dessus} class="f-dessus" />
        </g>
      {/if}
    {:else}
      {@const a = el.a}
      {@const p = iso(a.x, a.y)}
      <g class="acteur" class:marche={a.marche} style="transform: translate({p.X}px, {p.Y}px) scale(1.25); transition-duration: {a.duree}ms; --c: {a.couleur}"
        role="button" tabindex="0" aria-label={a.nom}
        onmouseenter={(e) => survoler(e, a)} onfocus={(e) => survoler(e as unknown as MouseEvent, a)}>
        <ellipse cx="0" cy="0" rx="13" ry="6" class="ombre" />
        <g class="corps">
          {#if a.forme === "mascotte"}
            <!-- la mascotte de Claude : un bloc orange à pattes -->
            {#each [-9, -3, 3, 9] as x}<rect x={x - 2} y="-10" width="4" height="10" fill="var(--c)" />{/each}
            <rect x="-15" y="-27" width="30" height="18" rx="2" fill="var(--c)" />
            <rect x="-21" y="-21" width="6" height="5" fill="var(--c)" /><rect x="15" y="-21" width="6" height="5" fill="var(--c)" />
            <rect x="-7" y="-23" width="3" height="6" fill="#1b1410" /><rect x="4" y="-23" width="3" height="6" fill="#1b1410" />
          {:else}
            <path d="M-11 0 L-8 -26 Q0 -32 8 -26 L11 0 Z" fill="var(--c)" />
            {#if a.id === "max"}<path d="M0 -26 L-3 -20 L0 -10 L3 -20 Z" fill="#ffd36e" />{/if}
            <circle cx="0" cy="-38" r="10" fill="var(--c)" />
            <circle cx="-3.5" cy="-39" r="1.6" fill="#fff" /><circle cx="3.5" cy="-39" r="1.6" fill="#fff" />
          {/if}
        </g>
        {#if EMOJI[a.geste] && !a.marche}
          <g class="bulle"><rect x="-13" y="-72" width="26" height="22" rx="7" /><text x="0" y="-56" text-anchor="middle" font-size="13">{EMOJI[a.geste]}</text></g>
        {/if}
      </g>
    {/if}
  {/each}
</svg>

<style>
  .bureau { width: 100%; height: 100%; display: block; user-select: none; }
  .sol { fill: color-mix(in srgb, var(--text) 4%, var(--surface)); }
  .grille { stroke: var(--border); stroke-width: 1; opacity: 0.6; }
  .mur { fill: color-mix(in srgb, var(--text) 8%, var(--surface)); }
  .mur.sombre { fill: color-mix(in srgb, var(--text) 5%, var(--surface)); }
  .zone { fill: transparent; }
  .zone:hover { fill: color-mix(in srgb, var(--text) 6%, transparent); }
  .bloc polygon { stroke: color-mix(in srgb, var(--text) 30%, var(--surface)); stroke-width: 0.7; stroke-linejoin: round; }
  .bloc.note polygon { fill: var(--n) !important; stroke: none; }
  .feuilles { fill: #4f9f72; }
  .feuilles.clair { fill: #66b98a; }
  .bloc .f-dessus { fill: color-mix(in srgb, var(--text) 26%, var(--surface)); }
  .bloc .f-devant { fill: color-mix(in srgb, var(--text) 16%, var(--surface)); }
  .bloc .f-cote { fill: color-mix(in srgb, var(--text) 11%, var(--surface)); }
  .bloc.clair .f-dessus { fill: color-mix(in srgb, var(--text) 18%, var(--surface)); }
  .bloc.clair .f-devant { fill: color-mix(in srgb, var(--text) 11%, var(--surface)); }
  .bloc.bois .f-dessus { fill: color-mix(in srgb, #a3825f 70%, var(--surface)); }
  .bloc.bois .f-devant { fill: color-mix(in srgb, #a3825f 50%, var(--surface)); }
  .bloc.bois .f-cote { fill: color-mix(in srgb, #a3825f 38%, var(--surface)); }
  .bloc.liege .f-devant { fill: color-mix(in srgb, #b08d63 60%, var(--surface)); }
  .bloc.ecran .f-devant { fill: #8fb8e8; }
  .bloc.ecran .f-dessus, .bloc.ecran .f-cote { fill: color-mix(in srgb, var(--text) 30%, var(--surface)); }
  .bloc.plante .f-dessus { fill: #5aa97c; }
  .bloc.plante .f-devant { fill: #468d64; }
  .bloc.plante .f-cote { fill: #3c7a57; }
  .bloc.voyant polygon { fill: color-mix(in srgb, var(--text) 20%, var(--surface)); }
  .bloc.voyant.allume polygon { fill: #5bc2ff; animation: clignote 1.4s steps(2) infinite; }
  @keyframes clignote { 50% { opacity: 0.45; } }
  .acteur { transition-property: transform; transition-timing-function: linear; cursor: pointer; outline: none; }
  .ombre { fill: rgba(0, 0, 0, 0.22); }
  .marche .corps { animation: pas 0.36s ease-in-out infinite; }
  @keyframes pas { 50% { transform: translateY(-3px); } }
  .bulle rect { fill: var(--surface); stroke: var(--border); }
</style>

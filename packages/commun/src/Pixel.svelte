<script lang="ts">
  // Un agent en pixel art (accueil, fiches) : son personnage et la scène de ce qu'il fait, animée.
  // Personnages : « costume » (Max), « claude » (la mascotte orange de Claude, usage privé), sinon un petit robot à la couleur de l'agent.
  import type { Scene } from "./agl";

  let { perso = "", couleur = "#5ee0b0", scene = "dort", taille = 96 }: { perso?: string; couleur?: string; scene?: Scene; taille?: number } = $props();

  // grilles 16 × 16 : un caractère = un pixel (. vide, c couleur de l'agent, f foncé, p peau, b blanc, o orange, n noir)
  const PERSOS: Record<string, string[]> = {
    robot: [
      "................",
      ".......ff.......",
      "......fccf......",
      "....ffffffff....",
      "...fccccccccf...",
      "...fcbncbnccf...",
      "...fccccccccf...",
      "...fccfffccf....",
      "....ffffffff....",
      "...ccffccffcc...",
      "..cc.fccccf.cc..",
      "..c..fccccf..c..",
      ".....fccccf.....",
      ".....ff..ff.....",
      ".....ff..ff.....",
      "................",
    ],
    costume: [
      "................",
      ".....nnnnnn.....",
      "....nnnnnnnn....",
      "....pppppppp....",
      "....pbnppbnp....",
      "....pppppppp....",
      ".....pp..pp.....",
      "......pppp......",
      "....ccbffbcc....",
      "...cccbffbccc...",
      "..pcccbffbcccp..",
      "..p.cccffccc.p..",
      "....cccccccc....",
      ".....nn..nn.....",
      ".....nn..nn.....",
      "................",
    ],
    claude: [
      "................",
      "................",
      "...oooooooooo...",
      "...oooooooooo...",
      "...oonoooonoo...",
      "...oooooooooo...",
      ".oooooooooooooo.",
      ".oooooooooooooo.",
      "...oooooooooo...",
      "...oooooooooo...",
      "...oooooooooo...",
      "...o.o....o.o...",
      "...o.o....o.o...",
      "................",
      "................",
      "................",
    ],
  };
  const grille = $derived(PERSOS[perso === "costume" || perso === "claude" ? perso : "robot"]!);
  const teinte = (ch: string): string | null =>
    ({ c: couleur, f: "#2a2f36", p: "#f2c9a0", b: "#ffffff", o: "#d97757", n: "#1c1f24" })[ch] ?? null;
  const pixels = $derived(
    grille.flatMap((ligne, y) => [...ligne].map((ch, x) => ({ x, y, f: teinte(ch) })).filter((p): p is { x: number; y: number; f: string } => p.f !== null)),
  );
</script>

<svg width={taille} height={taille} viewBox="0 0 32 32" shape-rendering="crispEdges" class="s-{scene}" role="img" aria-label="scène : {scene}">
  <!-- le décor de la scène -->
  {#if scene === "ordinateur" || scene === "ecrit"}
    <rect x="1" y="23" width="30" height="2" fill="#8a6a4a" /><rect x="3" y="25" width="2" height="6" fill="#6e5238" /><rect x="27" y="25" width="2" height="6" fill="#6e5238" />
  {/if}
  {#if scene === "ordinateur"}
    <rect x="19" y="14" width="11" height="8" fill="#2a2f36" /><rect class="ecran" x="20" y="15" width="9" height="6" fill="#5ee0b0" /><rect x="23" y="22" width="3" height="1" fill="#2a2f36" />
  {:else if scene === "ecrit"}
    <rect x="18" y="20" width="9" height="3" fill="#f5f6f8" /><rect class="stylo" x="22" y="17" width="1" height="4" fill="#2a2f36" />
  {:else if scene === "courrier"}
    <rect class="lettre" x="20" y="16" width="9" height="6" fill="#f5f6f8" stroke="#9aa1ab" stroke-width="0.5" /><path d="M20 16 l4.5 3 l4.5 -3" fill="none" stroke="#9aa1ab" stroke-width="0.5" />
  {:else if scene === "loupe"}
    <g class="loupe"><circle cx="25" cy="13" r="3.5" fill="#cfe8ff" stroke="#2a2f36" stroke-width="1" /><rect x="27" y="16" width="1.5" height="4" fill="#2a2f36" transform="rotate(-40 27.5 17)" /></g>
  {:else if scene === "dort"}
    <text class="zzz" x="22" y="9" font-size="6" fill="var(--muted, #6b727c)" font-family="monospace">z</text>
    <text class="zzz z2" x="26" y="5" font-size="4" fill="var(--muted, #6b727c)" font-family="monospace">z</text>
  {:else if scene === "attend"}
    <text class="main" x="23" y="9" font-size="8">✋</text>
  {:else if scene === "sans_credits"}
    <rect x="21" y="6" width="8" height="4" fill="none" stroke="#e05a4f" stroke-width="1" /><rect x="29" y="7" width="1" height="2" fill="#e05a4f" /><rect class="clignote" x="22" y="7" width="1.5" height="2" fill="#e05a4f" />
  {/if}
  <!-- l'agent -->
  <g transform="translate({scene === 'ordinateur' || scene === 'ecrit' || scene === 'courrier' || scene === 'loupe' ? 2 : 8} {scene === 'dort' ? 12 : 8})">
    <g class="corps">{#each pixels as p}<rect x={p.x} y={p.y} width="1" height="1" fill={p.f} />{/each}</g>
  </g>
</svg>

<style>
  svg {
    flex: none;
    image-rendering: pixelated;
  }
  .corps {
    animation: respire 1.4s steps(2) infinite;
  }
  .s-dort .corps {
    animation-duration: 3s;
  }
  .s-ordinateur .corps,
  .s-ecrit .corps {
    animation: tape 0.5s steps(2) infinite;
  }
  .ecran {
    animation: clignote 0.9s steps(2) infinite;
  }
  .stylo {
    animation: ecrit 0.6s steps(3) infinite;
  }
  .loupe {
    animation: cherche 1.6s steps(4) infinite;
  }
  .zzz {
    animation: monte 2.4s steps(4) infinite;
  }
  .z2 {
    animation-delay: 1.2s;
  }
  .main {
    animation: respire 0.8s steps(2) infinite;
  }
  .lettre {
    animation: respire 1s steps(2) infinite;
  }
  .clignote {
    animation: clignote 1s steps(2) infinite;
  }
  @keyframes respire {
    50% {
      transform: translateY(-0.5px);
    }
  }
  @keyframes tape {
    50% {
      transform: translate(0.5px, 0.5px);
    }
  }
  @keyframes clignote {
    50% {
      opacity: 0.45;
    }
  }
  @keyframes ecrit {
    33% {
      transform: translateX(1px);
    }
    66% {
      transform: translateX(2px);
    }
  }
  @keyframes cherche {
    25% {
      transform: translate(-1px, 1px);
    }
    50% {
      transform: translate(-2px, 0);
    }
    75% {
      transform: translate(-1px, -1px);
    }
  }
  @keyframes monte {
    100% {
      transform: translateY(-3px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      animation: none !important;
    }
  }
</style>

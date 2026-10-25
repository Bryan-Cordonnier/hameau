<script lang="ts">
  // Un personnage en 2D (listes, discussions, inventaire) : le galet de Max, ou l'étoile des visiteurs.
  import type { Habitant } from "./habitants";

  let { qui, taille = 40, anime = false }: { qui: Habitant | null; taille?: number; anime?: boolean } = $props();
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
</script>

<svg width={taille} height={taille} viewBox="-34 -34 68 72" class:anime aria-label={qui?.nom ?? "inconnu"} role="img">
  <defs>
    <linearGradient {id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color={qui?.couleurs[0] ?? "#ccc"} />
      <stop offset="1" stop-color={qui?.couleurs[1] ?? "#999"} />
    </linearGradient>
  </defs>
  <g class="jambes" stroke="#7a3d2a" stroke-width="4" stroke-linecap="round">
    <path class="j1" d="M-8 22 l-3 11" />
    <path class="j2" d="M8 22 l3 11" />
  </g>
  {#if qui?.forme === "etoile"}
    <path d="M0-28 L8-9 L28-6 L12 7 L17 27 L0 16 L-17 27 L-12 7 L-28-6 L-8-9Z" fill="url(#{id})" stroke="#b85a33" stroke-width="1.6" stroke-linejoin="round" />
    <circle cx="-5" cy="1" r="2.8" fill="#3b1d10" /><circle cx="5" cy="1" r="2.8" fill="#3b1d10" />
  {:else}
    <path class="bras" d="M22 4 l9 -4" stroke="#7a3d2a" stroke-width="4" stroke-linecap="round" />
    <path d="M-22 4 l-9 7" stroke="#7a3d2a" stroke-width="4" stroke-linecap="round" />
    <path d="M0-28c15 0 27 10 28 26 1 17-11 30-28 30S-29 18-28 1C-27-16-15-28 0-28z" fill="url(#{id})" />
    <circle cx="-9" cy="-2" r="3.6" fill="#4a2a1d" /><circle cx="8" cy="-2" r="3.6" fill="#4a2a1d" />
    <circle cx="-8" cy="-3.4" r="1.2" fill="#fff" /><circle cx="9" cy="-3.4" r="1.2" fill="#fff" />
    <ellipse cx="-15" cy="7" rx="4.5" ry="3" fill="#ff8f86" opacity=".7" /><ellipse cx="15" cy="7" rx="4.5" ry="3" fill="#ff8f86" opacity=".7" />
    <path d="M-5 10c4 4 10 4 13-1" stroke="#4a2a1d" stroke-width="2.6" stroke-linecap="round" fill="none" />
  {/if}
</svg>

<style>
  svg {
    flex: none;
    overflow: visible;
  }
  .anime {
    animation: rebond 1.6s ease-in-out infinite;
  }
  .anime .bras {
    transform-origin: 22px 4px;
    animation: salut 1.6s ease-in-out infinite;
  }
  @keyframes rebond {
    50% {
      transform: translateY(-3px);
    }
  }
  @keyframes salut {
    50% {
      transform: rotate(-25deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .anime,
    .anime .bras {
      animation: none;
    }
  }
</style>

<script lang="ts">
  import {
    CARET,
    CODE,
    CODE_COMPACT,
    CODE_COMPACT_STROKE,
    CODE_STROKE,
    HOOD,
    HOOD_HEM,
    SCREEN,
    SPARKLE,
    TILE,
    TORSO,
  } from "../brand";

  let { size = 24 }: { size?: number } = $props();
  const uid = $props.id();

  // Below this the fine code lines turn to mush: draw fewer, bolder ones and
  // skip the soft glows.
  const compact = $derived(size < 40);
  const code = $derived(compact ? CODE_COMPACT : CODE);
  const stroke = $derived(compact ? CODE_COMPACT_STROKE : CODE_STROKE);
</script>

<!-- Compact marks crop the margin around the tile: every pixel counts there. -->
<svg width={size} height={size} viewBox={compact ? "64 64 896 896" : "0 0 1024 1024"} aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#232a45" />
      <stop offset="1" stop-color="#0c0f18" />
    </linearGradient>
    <radialGradient id="{uid}-spill" cx=".5" cy=".42" r=".58">
      <stop offset="0" stop-color="#6f7dff" stop-opacity=".6" />
      <stop offset=".5" stop-color="#4fb8e8" stop-opacity=".14" />
      <stop offset="1" stop-color="#4fb8e8" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="{uid}-rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".5" />
      <stop offset=".35" stop-color="#fff" stop-opacity=".07" />
      <stop offset="1" stop-color="#fff" stop-opacity=".12" />
    </linearGradient>
    <linearGradient id="{uid}-screen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color={compact ? "#2d3782" : "#232b66"} />
      <stop offset="1" stop-color="#161c4a" />
    </linearGradient>
    <radialGradient id="{uid}-screen-glow" cx=".5" cy="1" r=".75">
      <stop offset="0" stop-color="#a3b0ff" stop-opacity=".7" />
      <stop offset=".6" stop-color="#7f8fff" stop-opacity=".12" />
      <stop offset="1" stop-color="#7f8fff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="{uid}-hood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a2036" />
      <stop offset="1" stop-color="#0c0f1a" />
    </linearGradient>
    <linearGradient id="{uid}-torso" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#181e33" />
      <stop offset=".55" stop-color="#090b13" />
    </linearGradient>
    <linearGradient id="{uid}-edge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b3bfff" />
      <stop offset=".3" stop-color="#5fd4ec" stop-opacity=".6" />
      <stop offset=".75" stop-color="#5fd4ec" stop-opacity="0" />
    </linearGradient>
    <filter id="{uid}-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" />
    </filter>
    <clipPath id="{uid}-tile">
      <rect x={TILE.x} y={TILE.y} width={TILE.size} height={TILE.size} rx={TILE.radius} />
    </clipPath>
    <clipPath id="{uid}-hood-clip"><path d={HOOD} /></clipPath>
    <clipPath id="{uid}-torso-clip"><path d={TORSO} /></clipPath>
  </defs>

  <rect x={TILE.x} y={TILE.y} width={TILE.size} height={TILE.size} rx={TILE.radius} fill="url(#{uid}-bg)" />
  <g clip-path="url(#{uid}-tile)">
    <rect x={TILE.x} y={TILE.y} width={TILE.size} height={TILE.size} fill="url(#{uid}-spill)" />
    <rect x="64" y="652" width="896" height="308" fill="#080a12" opacity=".6" />

    <rect x="232" y="182" width="560" height="410" rx="44" fill="#090c15" />
    {#if !compact}
      <rect x="234" y="184" width="556" height="406" rx="42" fill="none" stroke="#c8d0ff" stroke-opacity=".16" stroke-width="4" />
    {/if}
    <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.width} height={SCREEN.height} rx={SCREEN.radius} fill="url(#{uid}-screen)" />
    <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.width} height={SCREEN.height} rx={SCREEN.radius} fill="url(#{uid}-screen-glow)" />

    <g stroke-linecap="round" stroke-width={stroke}>
      {#each code as t, i (i)}
        <path d="M{t.x} {t.y}h{t.w}" stroke={t.color} stroke-opacity={t.alpha ?? 1} />
      {/each}
    </g>
    {#if !compact}
      <rect x={CARET.x} y={CARET.y} width={CARET.width} height={CARET.height} rx="4" fill="#7ee6f5" />
      <path d={SPARKLE} fill="#e3e7ff" opacity=".9" />
    {/if}

    <path d={TORSO} fill="url(#{uid}-torso)" />
    <g clip-path="url(#{uid}-torso-clip)">
      {#if !compact}
        <path d={TORSO} fill="none" stroke="url(#{uid}-edge)" stroke-width="14" filter="url(#{uid}-soft)" />
        <ellipse cx="512" cy="684" rx="150" ry="44" fill="#04060b" opacity=".7" filter="url(#{uid}-soft)" />
      {/if}
      <path d={TORSO} fill="none" stroke="url(#{uid}-edge)" stroke-width={compact ? 16 : 5} opacity=".7" />
    </g>
    <path d={HOOD} fill="url(#{uid}-hood)" />
    <g clip-path="url(#{uid}-hood-clip)">
      {#if !compact}
        <path d={HOOD} fill="none" stroke="url(#{uid}-edge)" stroke-width="16" filter="url(#{uid}-soft)" />
        <path d="M512 370V690" stroke="#04060b" stroke-opacity=".45" stroke-width="5" />
      {/if}
      <path d={HOOD} fill="none" stroke="url(#{uid}-edge)" stroke-width={compact ? 18 : 5} />
      <path d={HOOD_HEM} fill="none" stroke="#8b97ff" stroke-opacity=".28" stroke-width={compact ? 14 : 6} />
    </g>
  </g>
  <rect x="70" y="70" width="884" height="884" rx="214" fill="none" stroke="url(#{uid}-rim)" stroke-width="12" />
</svg>

<script lang="ts">
  import { onMount } from "svelte";
  import { CARET, CODE, CODE_STROKE, HOOD, HOOD_HEM, SCREEN, SPARKLE, TILE, TORSO } from "../lib/brand";

  let { size = 124, paused = false }: { size?: number; paused?: boolean } = $props();
  const uid = $props.id();

  // The app icon in layers, so the coder can type: the code lines, caret,
  // screen glow and figure are separate elements animated only through
  // transform and opacity. The compositor runs those even while the main
  // window's page is busy starting up in the background.

  /** Typing rhythm, in ms. */
  const LEAD = 380;
  const SPACE = 90;
  const NEWLINE = 200;
  const MS_PER_UNIT = 2.4;
  const MIN_TOKEN = 150;
  const HOLD = 1600;
  const FADE = 360;
  const REST = 240;

  let t = LEAD;
  const steps = CODE.map((token, i) => {
    if (i > 0) t += token.y === CODE[i - 1].y ? SPACE : NEWLINE;
    const start = t;
    t += Math.max(MIN_TOKEN, token.w * MS_PER_UNIT);
    return { start, end: t };
  });
  const fadeStart = t + HOLD;
  const fadeEnd = fadeStart + FADE;
  const CYCLE = fadeEnd + REST;

  const cap = CODE_STROKE / 2;
  const pct = (v: number) => `${(v / 1024) * 100}%`;
  /** Caret offset from where it rests, as a share of its own size. */
  const caretAt = (x: number, y: number) =>
    `translate(${((x - CARET.x) / CARET.width) * 100}%, ${((y - CARET.y) / CARET.height) * 100}%)`;
  const caretY = (token: (typeof CODE)[number]) => token.y - CARET.height / 2;
  const caretStart = (token: (typeof CODE)[number]) => caretAt(token.x - cap, caretY(token));
  const caretEnd = (token: (typeof CODE)[number]) => caretAt(token.x + token.w + cap + 9, caretY(token));

  let code: HTMLElement;
  let caret: HTMLElement;
  let animations: Animation[] = [];

  onMount(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tokens = [...code.children] as HTMLElement[];
    const inks = tokens.map((token) => token.firstElementChild as HTMLElement);
    const timing: KeyframeAnimationOptions = { duration: CYCLE, iterations: Infinity };
    const at = (ms: number) => ms / CYCLE;

    // Each token is wiped in from the left: its clip box slides right while
    // the ink inside slides left by the same amount, so the ink stays put.
    steps.forEach(({ start, end }, i) => {
      animations.push(
        tokens[i].animate(
          [
            { transform: "translateX(-100%)" },
            { transform: "translateX(-100%)", offset: at(start) },
            { transform: "translateX(0)", offset: at(end) },
            { transform: "translateX(0)" },
          ],
          timing,
        ),
        inks[i].animate(
          [
            { transform: "translateX(100%)" },
            { transform: "translateX(100%)", offset: at(start) },
            { transform: "translateX(0)", offset: at(end) },
            { transform: "translateX(0)" },
          ],
          timing,
        ),
      );
    });

    // The caret rides the edge of whatever is being typed and jumps between
    // tokens; once the screen is wiped it goes back to the first line.
    const home = caretStart(CODE[0]);
    const caretFrames: Keyframe[] = [{ transform: home }];
    steps.forEach(({ start, end }, i) => {
      if (i > 0) caretFrames.push({ transform: caretEnd(CODE[i - 1]), offset: at(start - 1) });
      caretFrames.push({ transform: caretStart(CODE[i]), offset: at(start) });
      caretFrames.push({ transform: caretEnd(CODE[i]), offset: at(end) });
    });
    caretFrames.push({ transform: caretEnd(CODE[CODE.length - 1]), offset: at(fadeEnd) });
    caretFrames.push({ transform: home, offset: at(fadeEnd + 1) });
    caretFrames.push({ transform: home });
    animations.push(caret.animate(caretFrames, timing));

    animations.push(
      code.animate(
        [
          { opacity: 1 },
          { opacity: 1, offset: at(fadeStart) },
          { opacity: 0, offset: at(fadeEnd) },
          { opacity: 0 },
        ],
        timing,
      ),
    );

    // One shared start keeps every layer on the same beat.
    const now = document.timeline.currentTime;
    for (const animation of animations) animation.startTime = now;
    return () => {
      for (const animation of animations) animation.cancel();
      animations = [];
    };
  });

  $effect(() => {
    for (const animation of animations) {
      if (paused) animation.pause();
      else animation.play();
    }
  });
</script>

<div class="scene" class:paused style:--size="{size}px">
  <svg class="layer" viewBox="0 0 1024 1024" aria-hidden="true">
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
      <linearGradient id="{uid}-screen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#232b66" />
        <stop offset="1" stop-color="#161c4a" />
      </linearGradient>
      <linearGradient id="{uid}-desk" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#3a4380" stop-opacity="0" />
        <stop offset=".5" stop-color="#5a66c8" />
        <stop offset="1" stop-color="#3a4380" stop-opacity="0" />
      </linearGradient>
      <clipPath id="{uid}-tile">
        <rect x={TILE.x} y={TILE.y} width={TILE.size} height={TILE.size} rx={TILE.radius} />
      </clipPath>
    </defs>
    <rect x={TILE.x} y={TILE.y} width={TILE.size} height={TILE.size} rx={TILE.radius} fill="url(#{uid}-bg)" />
    <g clip-path="url(#{uid}-tile)">
      <rect x={TILE.x} y={TILE.y} width={TILE.size} height={TILE.size} fill="url(#{uid}-spill)" />
      <rect x="64" y="652" width="896" height="308" fill="#080a12" opacity=".6" />
      <rect x="64" y="646" width="896" height="10" fill="url(#{uid}-desk)" />
      <rect x="232" y="182" width="560" height="410" rx="44" fill="#090c15" />
      <rect x="234" y="184" width="556" height="406" rx="42" fill="none" stroke="#c8d0ff" stroke-opacity=".16" stroke-width="4" />
      <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.width} height={SCREEN.height} rx={SCREEN.radius} fill="url(#{uid}-screen)" />
    </g>
  </svg>

  <div
    class="glow"
    style:left={pct(SCREEN.x)}
    style:top={pct(SCREEN.y)}
    style:width={pct(SCREEN.width)}
    style:height={pct(SCREEN.height)}
    style:border-radius="{(SCREEN.radius / SCREEN.width) * 100}% / {(SCREEN.radius / SCREEN.height) * 100}%"
  ></div>

  <div class="code" bind:this={code}>
    {#each CODE as token, i (i)}
      <span
        class="token"
        style:left={pct(token.x - cap)}
        style:top={pct(token.y - cap)}
        style:width={pct(token.w + CODE_STROKE)}
        style:height={pct(CODE_STROKE)}
      >
        <i style:background={token.color} style:opacity={token.alpha ?? 1}></i>
      </span>
    {/each}
  </div>

  <span
    class="caret"
    bind:this={caret}
    style:left={pct(CARET.x)}
    style:top={pct(CARET.y)}
    style:width={pct(CARET.width)}
    style:height={pct(CARET.height)}
  ><i></i></span>

  <svg class="sparkle" viewBox="690 236 56 56" style:left={pct(690)} style:top={pct(236)} style:width={pct(56)} aria-hidden="true">
    <path d={SPARKLE} fill="#e3e7ff" />
  </svg>

  <!-- The coder, clipped to the tile so a nod never shows a gap. -->
  <div class="figure-clip" style:inset={pct(TILE.x)} style:border-radius="{(TILE.radius / TILE.size) * 100}%">
    <svg class="figure" viewBox="0 0 1024 1024" aria-hidden="true">
      <defs>
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
        <clipPath id="{uid}-hood-clip"><path d={HOOD} /></clipPath>
        <clipPath id="{uid}-torso-clip"><path d={TORSO} /></clipPath>
      </defs>
      <path d={TORSO} fill="url(#{uid}-torso)" />
      <g clip-path="url(#{uid}-torso-clip)">
        <path d={TORSO} fill="none" stroke="url(#{uid}-edge)" stroke-width="14" filter="url(#{uid}-soft)" />
        <path d={TORSO} fill="none" stroke="url(#{uid}-edge)" stroke-width="5" opacity=".7" />
        <ellipse cx="512" cy="684" rx="150" ry="44" fill="#04060b" opacity=".7" filter="url(#{uid}-soft)" />
      </g>
      <path d={HOOD} fill="url(#{uid}-hood)" />
      <g clip-path="url(#{uid}-hood-clip)">
        <path d={HOOD} fill="none" stroke="url(#{uid}-edge)" stroke-width="16" filter="url(#{uid}-soft)" />
        <path d={HOOD} fill="none" stroke="url(#{uid}-edge)" stroke-width="5" />
        <path d="M512 370V690" stroke="#04060b" stroke-opacity=".45" stroke-width="5" />
        <path d={HOOD_HEM} fill="none" stroke="#8b97ff" stroke-opacity=".28" stroke-width="6" />
      </g>
    </svg>
  </div>

  <svg class="layer" viewBox="0 0 1024 1024" aria-hidden="true">
    <defs>
      <linearGradient id="{uid}-rim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".5" />
        <stop offset=".35" stop-color="#fff" stop-opacity=".07" />
        <stop offset="1" stop-color="#fff" stop-opacity=".12" />
      </linearGradient>
    </defs>
    <rect x="70" y="70" width="884" height="884" rx="214" fill="none" stroke="url(#{uid}-rim)" stroke-width="12" />
  </svg>
</div>

<style>
  .scene {
    position: relative;
    width: var(--size);
    height: var(--size);
  }

  .scene > * {
    position: absolute;
  }

  .layer {
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .glow {
    background: radial-gradient(
      75% 75% at 50% 100%,
      rgb(163 176 255 / 0.7),
      rgb(127 143 255 / 0.12) 60%,
      rgb(127 143 255 / 0)
    );
  }

  .code {
    inset: 0;
  }

  .token {
    position: absolute;
    overflow: hidden;
  }

  .token i,
  .caret i {
    display: block;
    width: 100%;
    height: 100%;
  }

  .token i {
    border-radius: 999px;
  }

  .caret i {
    border-radius: 22%;
    background: #7ee6f5;
    box-shadow: 0 0 4px rgb(126 230 245 / 0.8);
  }

  .sparkle {
    aspect-ratio: 1;
    opacity: 0.9;
  }

  .figure-clip {
    overflow: hidden;
  }

  .figure {
    position: absolute;
    top: -7.1429%; /* 64 / 896: the SVG spans the full 1024 box */
    left: -7.1429%;
    width: 114.2857%; /* 1024 / 896 */
    height: 114.2857%;
    overflow: visible;
  }

  @media (prefers-reduced-motion: no-preference) {
    .glow {
      animation: flicker 3.2s var(--ease-in-out) infinite alternate;
    }

    .caret i {
      animation: blink 1.05s steps(1) infinite;
    }

    .sparkle {
      animation: twinkle 3.6s var(--ease-in-out) infinite;
    }

    .figure {
      animation: type 0.9s var(--ease-in-out) infinite alternate;
    }

    .paused * {
      animation-play-state: paused !important;
    }
  }

  @keyframes flicker {
    from {
      opacity: 0.62;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0;
    }
  }

  @keyframes twinkle {
    0%,
    62%,
    100% {
      opacity: 0.9;
      transform: scale(1) rotate(0);
    }
    76% {
      opacity: 1;
      transform: scale(1.35) rotate(45deg);
    }
  }

  /* The small rock of someone typing. */
  @keyframes type {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(0.9%);
    }
  }
</style>

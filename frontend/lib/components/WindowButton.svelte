<script lang="ts">
  /**
   * A round, glassy window button (minimize, maximize, close), used by the
   * app's and the setup's title bars: a colored orb lit from above, with a
   * dark inner ring and the glyph set under the glass.
   */
  type Kind = "minimize" | "maximize" | "close";

  let {
    kind,
    label,
    disabled = false,
    title,
    onclick,
  }: {
    kind: Kind;
    label: string;
    disabled?: boolean;
    title?: string;
    onclick: () => void;
  } = $props();
</script>

<button class="wb {kind}" aria-label={label} {title} {disabled} {onclick}>
  <span class="orb" aria-hidden="true">
    <svg viewBox="0 0 20 20">
      {#if kind === "close"}
        <path class="stroke" d="M7 7l6 6m0-6l-6 6" />
      {:else if kind === "minimize"}
        <path class="stroke" d="M6.4 10h7.2" />
      {:else}
        <path class="fill" d="M6.9 6.9h6.2v6.2z" />
        <path class="fill" d="M6.9 8l5.1 5.1h-5.1z" />
      {/if}
    </svg>
  </span>
</button>

<style>
  .wb {
    /* light, body and deep: the orb's color from its lit top to its base */
    --light: #ff9a8f;
    --body: #f5433f;
    --deep: #a3161b;
    --ink: #6e0d10;
    display: grid;
    place-items: center;
    width: 27px;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: none;
  }

  .minimize {
    --light: #ffe39a;
    --body: #fbb325;
    --deep: #b36f00;
    --ink: #613c00;
  }

  .maximize {
    --light: #9ff0a2;
    --body: #2fc147;
    --deep: #137a26;
    --ink: #074216;
  }

  .orb {
    position: relative;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 118%, rgb(255 255 255 / 0.38), transparent 46%),
      radial-gradient(circle at 50% 32%, var(--light), var(--body) 52%, var(--deep) 100%);
    box-shadow:
      inset 0 -1.5px 2px rgb(0 0 0 / 0.32),
      inset 0 0.75px 0.5px rgb(255 255 255 / 0.55),
      0 0 0 0.75px rgb(0 0 0 / 0.55),
      0 2px 4px -1px rgb(0 0 0 / 0.6),
      0 0 10px -2px color-mix(in srgb, var(--body) 55%, transparent);
    transition:
      transform var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast),
      filter var(--dur-fast);
  }

  /* The dark inner ring. */
  .orb::before {
    content: "";
    position: absolute;
    inset: 2.2px;
    border: 1.05px solid rgb(0 0 0 / 0.62);
    border-radius: 50%;
    box-shadow: 0 0.5px 0 rgb(255 255 255 / 0.28);
  }

  /* The specular highlight, over the glyph: it sits under the glass. */
  .orb::after {
    content: "";
    position: absolute;
    top: 1.1px;
    left: 50%;
    z-index: 1;
    width: 10px;
    height: 6px;
    border-radius: 50%;
    background: linear-gradient(180deg, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0.05));
    transform: translateX(-50%);
    pointer-events: none;
  }

  svg {
    width: 16px;
    height: 16px;
    filter: drop-shadow(0 0.6px 0 rgb(255 255 255 / 0.35));
  }

  .stroke {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.85;
    stroke-linecap: round;
  }

  .fill {
    fill: var(--ink);
  }

  .wb:hover .orb {
    transform: translateY(-0.5px) scale(1.1);
    filter: brightness(1.08) saturate(1.1);
    box-shadow:
      inset 0 -1.5px 2px rgb(0 0 0 / 0.3),
      inset 0 0.75px 0.5px rgb(255 255 255 / 0.6),
      0 0 0 0.75px rgb(0 0 0 / 0.55),
      0 3px 6px -1px rgb(0 0 0 / 0.6),
      0 0 14px -1px color-mix(in srgb, var(--body) 75%, transparent);
  }

  /* Held down: the orb sinks, loses its glow and its highlight dims. */
  .wb:active .orb {
    transform: translateY(1px) scale(0.86);
    filter: brightness(0.82) saturate(1.15);
    box-shadow:
      inset 0 2px 3.5px rgb(0 0 0 / 0.55),
      0 0 0 0.75px rgb(0 0 0 / 0.65),
      0 0.5px 1px rgb(0 0 0 / 0.5);
    transition-duration: 50ms;
  }

  .orb::after {
    transition: opacity var(--dur-fast);
  }

  .wb:active .orb::after {
    opacity: 0.4;
  }

  .wb:focus-visible {
    outline: none;
  }

  .wb:focus-visible .orb {
    outline: 2px solid rgb(255 255 255 / 0.75);
    outline-offset: 2px;
  }

  .wb:disabled {
    cursor: not-allowed;
  }

  .wb:disabled .orb {
    opacity: 0.35;
    transform: none;
    filter: grayscale(0.6);
  }
</style>

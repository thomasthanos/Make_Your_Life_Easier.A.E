<script module lang="ts">
  export interface Step {
    label: string;
    state: "done" | "active" | "pending";
  }
</script>

<script lang="ts">
  let {
    title,
    percent,
    action,
    detail,
    steps,
  }: { title: string; percent: number; action: string; detail: string; steps: Step[] } = $props();

  const shown = $derived(Math.floor(Math.min(100, Math.max(0, percent))));
</script>

<section class="working">
  <div class="head">
    <h2>{title}</h2>
    <span class="pct" aria-live="polite">{shown}<small>%</small></span>
  </div>

  <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={shown}>
    <div class="fill" style:transform="scaleX({Math.max(0.004, percent / 100)})"><i></i></div>
  </div>

  <div class="now">
    <span class="action">{action}</span>
    <span class="detail" title={detail}>{detail || " "}</span>
  </div>

  <ol class="steps">
    {#each steps as step (step.label)}
      <li class={step.state}>
        <span class="mark" aria-hidden="true">
          {#if step.state === "done"}
            <svg viewBox="0 0 16 16"><path d="M3.5 8.4l3 3 6-6.6" /></svg>
          {:else if step.state === "active"}
            <span class="spinner"></span>
          {/if}
        </span>
        {step.label}
      </li>
    {/each}
  </ol>
</section>

<style>
  .working {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  h2 {
    font-size: 20px;
  }

  .pct {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    background: var(--accent-grad);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .pct small {
    font-size: 16px;
    margin-left: 1px;
  }

  .bar {
    position: relative;
    height: 8px;
    margin-top: 14px;
    overflow: hidden;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.07);
    box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.4);
  }

  .fill {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    background: var(--accent-grad);
    box-shadow: 0 0 14px var(--accent-glow);
    transform-origin: left center;
    transition: transform 240ms var(--ease-out);
  }

  /* A glint running along the filled part; scaled with it, never past it. */
  .fill i {
    position: absolute;
    inset: 0 auto 0 0;
    width: 35%;
    background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.5), transparent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .fill i {
      animation: shine 1.7s var(--ease-in-out) infinite;
    }
  }

  @keyframes shine {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(300%);
    }
  }

  .now {
    display: grid;
    gap: 2px;
    margin-top: 10px;
    min-width: 0;
  }

  .action {
    font-size: 13px;
    color: var(--text-2);
  }

  .detail {
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-3);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .steps {
    display: grid;
    gap: 9px;
    margin: auto 0 0;
    padding: 16px 16px 4px;
    list-style: none;
    border-radius: 14px;
    background: rgb(255 255 255 / 0.025);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.05);
  }

  li {
    display: flex;
    align-items: center;
    gap: 11px;
    font-size: 13px;
    color: var(--text-3);
    transition: color var(--dur-med);
  }

  li:last-child {
    margin-bottom: 12px;
  }

  li.active {
    color: var(--text-1);
  }

  li.done {
    color: var(--text-2);
  }

  .mark {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.14);
  }

  .done .mark {
    background: var(--accent-grad);
    box-shadow: 0 0 10px -2px var(--accent-glow);
  }

  .mark svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: #fff;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgb(var(--accent-rgb) / 0.2);
    border-top-color: var(--accent);
    border-right-color: var(--accent-2);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }
</style>

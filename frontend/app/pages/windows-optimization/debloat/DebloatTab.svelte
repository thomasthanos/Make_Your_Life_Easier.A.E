<script lang="ts">
  // The one-click Debloat: what it will do, with a switch on each, and the
  // apps it removes.
  import Info from "@lucide/svelte/icons/info";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Package from "@lucide/svelte/icons/package";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
  import Progress from "./Progress.svelte";
  import { debloat } from "./state.svelte";

  const planned = $derived(debloat.plannedTweaks.length);
  const apps = $derived(debloat.chosenApps);
</script>

<div class="debloat">
  <section class="hero surface">
    <span class="rim" aria-hidden="true"></span>
    <div class="hero-left">
      <span class="hero-icon" aria-hidden="true"><WandSparkles size={26} strokeWidth={1.6} /></span>
      <div class="hero-copy">
        <div class="hero-heading">
          <h2>Debloat Windows</h2>
          {#if debloat.status}<span class="windows">{debloat.status.windows.name}</span>{/if}
        </div>
        <p>
          Turns off the tracking, ads and clutter Windows ships with, and removes the apps you do not need, in one go.
          A restore point is made first, and MYLE can undo each of its changes later.
        </p>
      </div>
    </div>
    <div class="hero-action">
      <button class="btn primary big" disabled={debloat.locked || !debloat.status || (!planned && !apps.length)} onclick={() => debloat.debloat()}>
        {#if debloat.busy}<LoaderCircle size={17} class="spin" /> Working…{:else}<Sparkles size={17} /> Debloat{/if}
      </button>
      <small>
        {#if !debloat.status}Checking this PC…
        {:else if !planned && !apps.length}Everything chosen is already done
        {:else}{planned} change{planned === 1 ? "" : "s"} · {apps.length} app{apps.length === 1 ? "" : "s"} to remove{/if}
      </small>
    </div>
  </section>

  <Progress />

  <section class="card surface apps-bar">
    <div class="apps-bar-top">
      <div class="apps-bar-info">
        <span class="section-icon"><Package size={15} /></span>
        <div>
          <div class="title-row">
            <h3>Apps to remove</h3>
            <span class="counter">{apps.length} of {debloat.installedApps.length} installed</span>
          </div>
          <p class="note">
            Removed for every user of this PC. Nothing Windows or MYLE needs is ever listed, and any app can be reinstalled from the Microsoft Store.
          </p>
        </div>
      </div>
      <button class="btn apps-btn" onclick={() => (debloat.tab = "apps")}><Package size={14} /> Choose apps</button>
    </div>

    {#if apps.length}
      <div class="chips-tray">
        {#each apps as app (app.id)}
          <span class="chip-app">
            <Package size={11} />
            {app.title}
          </span>
        {/each}
      </div>
    {:else}
      <p class="empty-inline">No apps chosen{debloat.installedApps.length ? " — click Choose apps to select some." : ": none of MYLE's list is installed."}</p>
    {/if}
  </section>

  <section class="card surface">
    <header class="card-header">
      <div class="card-title">
        <span class="section-icon"><Info size={15} /></span>
        <h3>What it does</h3>
      </div>
      <span class="counter">{debloat.debloatTweaks.filter((t) => t.state === "applied").length} of {debloat.debloatTweaks.length} enabled</span>
    </header>
    <ul class="rows">
      {#each debloat.debloatTweaks as tweak (tweak.id)}
        {@const done = tweak.state === "applied"}
        <li class:done class:enabled={done}>
          <label>
            <span class="text">
              <strong>
                {tweak.title}
                {#if tweak.risk === "caution"}<span class="tag caution"><TriangleAlert size={10} /> Asks again</span>{/if}
              </strong>
              <small>{tweak.summary}</small>
            </span>
            <span class="row-right">
              {#if done}
                <span class="tag ok"><ShieldCheck size={11} /> On</span>
              {:else if tweak.state === "partial"}
                <span class="tag partial">Partly</span>
              {:else}
                <span class="tag off">Off</span>
              {/if}
              <input
                type="checkbox"
                class="switch"
                role="switch"
                checked={done}
                disabled={debloat.busy}
                onchange={async (event) => {
                  const input = event.currentTarget;
                  input.checked = done;
                  if (done) {
                    await debloat.undo([tweak]);
                  } else {
                    await debloat.apply(tweak);
                  }
                }}
              />
            </span>
          </label>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  .debloat {
    display: grid;
    gap: 14px;
  }

  /* ── Hero ─────────────────────────────────────────────────────────────── */

  .hero {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    overflow: hidden;
    padding: 18px 22px;
  }

  .rim {
    position: absolute;
    inset: 0 14% auto;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgb(167 126 255 / 0.68), transparent);
    box-shadow: 0 0 16px rgb(143 103 255 / 0.25);
    pointer-events: none;
  }

  .hero-left {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .hero-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 54px;
    height: 54px;
    border: 1px solid rgb(var(--accent-rgb) / 0.3);
    border-radius: 15px;
    background:
      radial-gradient(circle at 28% 24%, rgb(255 255 255 / 0.15), transparent 55%),
      linear-gradient(145deg, rgb(var(--accent-rgb) / 0.32), rgb(111 179 198 / 0.1));
    color: #d8dcff;
  }

  .hero-copy {
    min-width: 0;
  }

  .hero-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .hero-copy h2 {
    font-family: var(--font-brand);
    font-size: 19px;
    font-weight: 650;
  }

  .hero-copy p {
    max-width: 72ch;
    margin-top: 4px;
    color: var(--text-2);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .windows {
    padding: 2px 9px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.03);
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 500;
  }

  .hero-action {
    display: grid;
    flex: none;
    justify-items: center;
    gap: 5px;
  }

  .hero-action .btn {
    min-width: 168px;
    height: 42px;
    justify-content: center;
    gap: 8px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .hero-action small {
    color: var(--text-3);
    font-size: 10.5px;
    white-space: nowrap;
  }

  /* ── Shared card chrome ───────────────────────────────────────────────── */

  .card {
    display: grid;
    gap: 12px;
    padding: 16px 18px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .section-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 1px solid rgb(var(--accent-rgb) / 0.2);
    border-radius: 8px;
    background: rgb(var(--accent-rgb) / 0.08);
    color: rgb(var(--accent-soft-rgb) / 0.9);
  }

  .card h3 {
    color: var(--text-1);
    font-size: 13.5px;
    font-weight: 650;
  }

  .counter {
    padding: 2px 9px;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.03);
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 560;
    white-space: nowrap;
  }

  /* ── Apps horizontal bar ──────────────────────────────────────────────── */

  .apps-bar {
    gap: 10px;
    padding: 14px 18px;
  }

  .apps-bar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .apps-bar-info {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .note {
    margin-top: 2px;
    color: var(--text-3);
    font-size: 11.5px;
    line-height: 1.45;
  }

  .apps-btn {
    flex: none;
    gap: 7px;
  }

  .chips-tray {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-top: 2px;
  }

  .chip-app {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 8px;
    border: 1px solid rgb(var(--accent-rgb) / 0.18);
    border-radius: 999px;
    background: rgb(var(--accent-rgb) / 0.08);
    color: rgb(var(--accent-soft-rgb) / 0.92);
    font-size: 11px;
    font-weight: 550;
  }

  .chip-app :global(svg) {
    color: rgb(var(--accent-soft-rgb) / 0.65);
    flex: none;
  }

  .empty-inline {
    color: var(--text-3);
    font-size: 11.5px;
  }

  /* ── What it does (2-column grid of tweaks) ───────────────────────────── */

  .rows {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li {
    border: 1px solid rgb(255 255 255 / 0.055);
    border-radius: 10px;
    background: rgb(255 255 255 / 0.018);
    transition: background var(--dur-fast), border-color var(--dur-fast);
  }

  .rows li:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .rows li.enabled {
    border-color: rgb(var(--accent-rgb) / 0.14);
    background: rgb(var(--accent-rgb) / 0.03);
  }

  .rows li:hover {
    border-color: rgb(255 255 255 / 0.11);
    background: rgb(255 255 255 / 0.035);
  }

  .rows label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 100%;
    padding: 10px 12px;
    cursor: pointer;
  }

  .text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .text strong {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 600;
  }

  .text small {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.4;
  }

  .row-right {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: none;
  }

  .tag {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 999px;
    font-size: 9.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .tag.ok {
    border-color: rgb(63 203 151 / 0.22);
    background: rgb(63 203 151 / 0.06);
    color: rgb(99 224 177 / 0.9);
  }

  .tag.caution {
    border-color: rgb(237 170 73 / 0.25);
    background: rgb(237 170 73 / 0.06);
    color: rgb(239 191 111 / 0.9);
  }

  .tag.partial {
    border-color: rgb(237 170 73 / 0.2);
    background: rgb(237 170 73 / 0.04);
    color: rgb(239 191 111 / 0.85);
  }

  .tag.off {
    color: var(--text-3);
  }

  /* ── Responsive ───────────────────────────────────────────────────────── */

  @media (max-width: 920px) {
    .rows {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .hero {
      flex-direction: column;
      align-items: stretch;
      gap: 14px;
    }

    .hero-action {
      justify-items: stretch;
    }

    .hero-action .btn {
      width: 100%;
    }

    .apps-bar-top {
      flex-direction: column;
      align-items: stretch;
    }

    .apps-btn {
      justify-content: center;
    }
  }
</style>

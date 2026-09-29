<script lang="ts">
  // The one-click Debloat: what it will do, with a switch on each, and the
  // apps it removes.
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Package from "@lucide/svelte/icons/package";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
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
    <span class="hero-icon" aria-hidden="true"><WandSparkles size={26} strokeWidth={1.6} /></span>
    <div class="hero-copy">
      <h2>Debloat Windows</h2>
      <p>
        Turns off the tracking, ads and clutter Windows ships with, and removes the apps you do not need, in one go.
        A restore point is made first, and MYLE can undo each of its changes later.
      </p>
      {#if debloat.status}<span class="windows">{debloat.status.windows.name}</span>{/if}
    </div>
    <div class="hero-action">
      <button class="btn primary big" disabled={debloat.locked || !debloat.status || (!planned && !apps.length)} onclick={() => debloat.debloat()}>
        {#if debloat.busy}<LoaderCircle size={16} class="spin" /> Working…{:else}<WandSparkles size={16} /> Debloat{/if}
      </button>
      <small>
        {#if !debloat.status}Checking this PC…
        {:else if !planned && !apps.length}Everything chosen is already done
        {:else}{planned} change{planned === 1 ? "" : "s"} · {apps.length} app{apps.length === 1 ? "" : "s"} to remove{/if}
      </small>
    </div>
  </section>

  <Progress />

  <div class="columns">
    <section class="card surface">
      <header>
        <h3>What it does</h3>
        <span>{debloat.debloatTweaks.length} changes</span>
      </header>
      <ul class="rows">
        {#each debloat.debloatTweaks as tweak (tweak.id)}
          {@const done = tweak.state === "applied"}
          <li class:done>
            <label>
              <span class="text">
                <strong>
                  {tweak.title}
                  {#if tweak.risk === "caution"}<span class="tag caution"><TriangleAlert size={10} /> Asks again</span>{/if}
                </strong>
                <small>{tweak.summary}</small>
              </span>
              {#if done}
                <span class="tag ok"><ShieldCheck size={10} /> Done</span>
              {:else}
                {#if tweak.state === "partial"}<span class="tag partial">Partly</span>{/if}
                <input
                  type="checkbox"
                  class="switch"
                  role="switch"
                  checked={!debloat.skipped.has(tweak.id)}
                  disabled={debloat.busy}
                  onchange={(event) => debloat.setTweak(tweak.id, event.currentTarget.checked)}
                />
              {/if}
            </label>
          </li>
        {/each}
      </ul>
    </section>

    <section class="card surface apps">
      <header>
        <h3>Apps to remove</h3>
        <span>{apps.length} of {debloat.installedApps.length} installed</span>
      </header>
      {#if apps.length}
        <div class="chips">
          {#each apps as app (app.id)}<span class="chip-app">{app.title}</span>{/each}
        </div>
      {:else}
        <p class="empty">No apps chosen{debloat.installedApps.length ? "." : ": none of MYLE's list is installed."}</p>
      {/if}
      <p class="note">
        For every user of this PC. Nothing Windows or MYLE needs is ever on the list, and every app can be installed
        again from the Microsoft Store.
      </p>
      <button class="btn" onclick={() => (debloat.tab = "apps")}><Package size={14} /> Choose apps</button>
    </section>
  </div>
</div>

<style>
  .debloat {
    display: grid;
    gap: 14px;
  }

  .hero {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px;
    overflow: hidden;
    padding: 20px 22px;
  }

  .rim {
    position: absolute;
    inset: 0 18% auto;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgb(167 126 255 / 0.66), transparent);
    box-shadow: 0 0 15px rgb(143 103 255 / 0.25);
    pointer-events: none;
  }

  .hero-icon {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    border: 1px solid rgb(var(--accent-rgb) / 0.28);
    border-radius: 17px;
    background:
      radial-gradient(circle at 28% 24%, rgb(255 255 255 / 0.14), transparent 55%),
      linear-gradient(145deg, rgb(var(--accent-rgb) / 0.3), rgb(111 179 198 / 0.08));
    color: #d8dcff;
  }

  .hero-copy h2 {
    font-family: var(--font-brand);
    font-size: 20px;
    font-weight: 600;
  }

  .hero-copy p {
    max-width: 70ch;
    margin-top: 5px;
    color: var(--text-2);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .windows {
    display: inline-block;
    margin-top: 8px;
    padding: 2px 8px;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 999px;
    color: var(--text-3);
    font-size: 10.5px;
  }

  .hero-action {
    display: grid;
    justify-items: center;
    gap: 6px;
  }

  .hero-action .btn {
    min-width: 170px;
    height: 44px;
    justify-content: center;
    font-size: 14px;
  }

  .hero-action small {
    color: var(--text-3);
    font-size: 10.5px;
    white-space: nowrap;
  }

  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
    align-items: start;
    gap: 14px;
  }

  .card {
    display: grid;
    gap: 10px;
    padding: 14px 16px 16px;
  }

  .card header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }

  .card h3 {
    font-size: 13.5px;
    font-weight: 650;
  }

  .card header span {
    color: var(--text-3);
    font-size: 11px;
  }

  .rows {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rows li + li {
    border-top: 1px solid rgb(255 255 255 / 0.05);
  }

  .rows label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 2px;
    cursor: pointer;
  }

  .rows li.done label {
    cursor: default;
  }

  .text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .text strong {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 600;
  }

  .rows li.done .text strong {
    color: var(--text-2);
  }

  .text small {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.4;
  }

  .tag {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 999px;
    font-size: 9.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .tag.ok {
    border-color: rgb(63 203 151 / 0.2);
    color: rgb(99 224 177 / 0.9);
  }

  .tag.caution {
    border-color: rgb(237 170 73 / 0.25);
    color: rgb(239 191 111 / 0.9);
  }

  .tag.partial {
    color: var(--text-3);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .chip-app {
    padding: 3px 9px;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.035);
    color: var(--text-2);
    font-size: 11px;
  }

  .empty,
  .note {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.45;
  }

  .apps .btn {
    justify-self: start;
  }

  @media (max-width: 960px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .hero {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .hero-action {
      grid-column: 1 / -1;
      justify-items: stretch;
    }
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { getVersion } from "@tauri-apps/api/app";
  import { isTauri } from "@tauri-apps/api/core";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Palette from "@lucide/svelte/icons/palette";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Rocket from "@lucide/svelte/icons/rocket";
  import PageHeader from "../../../lib/components/PageHeader.svelte";
  import { settings } from "../../../lib/settings.svelte";
  import { toast } from "../../../lib/toast.svelte";
  import { checkForUpdate, formatBytes, installUpdate, type UpdateAsset } from "../../../lib/updater";
  import AccountCard from "./AccountCard.svelte";
  import SyncedData from "./SyncedData.svelte";

  const REPO_URL = "https://github.com/thomasthanos/Make_Your_Life_Easier.A.E";

  type UpdateView =
    | { state: "idle" }
    | { state: "checking" }
    | { state: "upToDate"; latest: string }
    | { state: "available"; latest: string; asset: UpdateAsset }
    | { state: "downloading"; latest: string; progress: number | null; detail: string }
    | { state: "installing" }
    | { state: "error"; message: string };

  let version = $state("");
  let update = $state<UpdateView>({ state: "idle" });

  onMount(() => {
    if (isTauri()) void getVersion().then((v) => (version = v));
  });

  function message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  async function check() {
    update = { state: "checking" };
    try {
      const result = await checkForUpdate();
      if (result.status === "available") update = { state: "available", latest: result.latest, asset: result.asset };
      else if (result.status === "upToDate") update = { state: "upToDate", latest: result.latest };
      else if (result.status === "justUpdated") update = { state: "upToDate", latest: result.current };
      else update = { state: "error", message: "Updates are not configured in this build." };
    } catch (error) {
      update = { state: "error", message: message(error) };
    }
  }

  /** Same path as the splash: download, verify, run the installer, restart. */
  async function install(latest: string, asset: UpdateAsset) {
    update = { state: "downloading", latest, progress: 0, detail: "" };
    try {
      await installUpdate(asset, (event) => {
        if (event.event === "started" || event.event === "progress") {
          const total = event.data.total;
          const done = event.event === "progress" ? event.data.downloaded : 0;
          update = {
            state: "downloading",
            latest,
            progress: total ? Math.min(done / total, 1) : null,
            detail: total ? `${formatBytes(done)} of ${formatBytes(total)}` : formatBytes(done),
          };
        } else if (event.event === "installing") {
          update = { state: "installing" };
        }
      });
    } catch (error) {
      update = { state: "error", message: message(error) };
      toast.error(`The update failed: ${message(error)}`);
    }
  }

  function open(url: string) {
    void openUrl(url).catch((error) => toast.error(`Could not open the link: ${message(error)}`));
  }
</script>

<PageHeader title="Settings" subtitle="Your account, what it keeps in sync, and this PC." />

<div class="layout">
  <div class="column">
    <AccountCard />
    <SyncedData />
  </div>

  <div class="column">
    <section class="panel" aria-labelledby="appearance-title">
      <h2 id="appearance-title"><Palette size={15} /> Appearance</h2>
      <label class="row">
        <span class="text">
          <strong>Reduce transparency</strong>
          <small>Turns off the blur and softens animations. Useful on older graphics hardware.</small>
        </span>
        <input
          type="checkbox"
          class="switch"
          checked={settings.perfLite}
          onchange={(e) => settings.setPerfLite(e.currentTarget.checked)}
        />
      </label>
    </section>

    <section class="panel" aria-labelledby="updates-title">
      <h2 id="updates-title"><Rocket size={15} /> Updates</h2>
      <div class="version">
        <span class="text">
          <strong>Make Your Life Easier {version ? `v${version}` : "(dev preview)"}</strong>
          <small>Checked at every start. Downloads from downloads.thomast.uk, with GitHub as the fallback.</small>
        </span>
      </div>

      <div class="update" aria-live="polite">
        {#if update.state === "checking"}
          <span class="status"><LoaderCircle size={14} class="spin" /> Checking…</span>
        {:else if update.state === "upToDate"}
          <span class="status ok"><CircleCheck size={14} /> You're on the latest version.</span>
        {:else if update.state === "available"}
          {@const available = update}
          <span class="status accent"><Download size={14} /> Version {available.latest} is available.</span>
          <button class="btn small primary" onclick={() => install(available.latest, available.asset)}>
            Install and restart
          </button>
        {:else if update.state === "downloading"}
          <span class="status"><LoaderCircle size={14} class="spin" /> Downloading {update.latest}… {update.detail}</span>
          <span class="bar" class:indeterminate={update.progress === null}>
            <span style:transform={update.progress === null ? undefined : `scaleX(${update.progress})`}></span>
          </span>
        {:else if update.state === "installing"}
          <span class="status"><LoaderCircle size={14} class="spin" /> Installing; the app will restart by itself.</span>
        {:else if update.state === "error"}
          <span class="status error" title={update.message}>{update.message}</span>
        {/if}
        {#if update.state === "idle" || update.state === "upToDate" || update.state === "error"}
          <button class="btn small" onclick={check}><RefreshCw size={13} /> Check for updates</button>
        {/if}
      </div>
    </section>

    <section class="panel" aria-labelledby="about-title">
      <h2 id="about-title">About</h2>
      <p class="about">Make Your Life Easier · © 2026 ThomasThanos</p>
      <div class="links">
        <button class="btn small ghost" onclick={() => open(REPO_URL)}><ExternalLink size={13} /> GitHub</button>
        <button class="btn small ghost" onclick={() => open(`${REPO_URL}/releases`)}>
          <ExternalLink size={13} /> Release notes
        </button>
      </div>
    </section>
  </div>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    align-items: start;
    gap: 14px;
    max-width: 1180px;
  }

  .column {
    display: grid;
    gap: 14px;
    min-width: 0;
  }

  .panel {
    display: grid;
    gap: 12px;
    padding: 18px;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: var(--radius-lg);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0.018));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14.5px;
  }

  h2 :global(svg) {
    color: rgb(166 176 255 / 0.85);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    cursor: pointer;
  }

  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  strong {
    font-size: 12.5px;
    font-weight: 600;
  }

  small {
    color: var(--text-3);
    font-size: 11.5px;
    line-height: 1.45;
  }

  .update {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-height: 30px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    min-width: 0;
    color: var(--text-2);
    font-size: 12px;
  }

  .status.ok {
    color: rgb(110 225 175);
  }

  .status.accent {
    color: rgb(178 186 255);
  }

  .status.error {
    overflow: hidden;
    color: rgb(255 170 150 / 0.9);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .bar {
    position: relative;
    flex-basis: 100%;
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.3);
  }

  .bar span {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--accent-grad);
    transform-origin: left;
    transition: transform 160ms linear;
  }

  .bar.indeterminate span {
    width: 34%;
    animation: sweep 1.2s var(--ease-in-out) infinite;
  }

  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(300%);
    }
  }

  .about {
    color: var(--text-2);
    font-size: 12px;
  }

  .links {
    display: flex;
    gap: 6px;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>

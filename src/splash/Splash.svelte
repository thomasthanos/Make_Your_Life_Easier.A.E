<script lang="ts">
  import { onMount } from "svelte";
  import { getVersion } from "@tauri-apps/api/app";
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import {
    checkForUpdate,
    finishStartup,
    formatBytes,
    installUpdate,
    type DownloadEvent,
    type UpdateAsset,
  } from "../lib/updater";
  import SplashLogo from "./SplashLogo.svelte";

  /** Keep the splash up long enough to read, even when the check is instant. */
  const MIN_VISIBLE_MS = 1100;
  /** How long an error stays on screen before the app starts anyway. */
  const ERROR_HOLD_MS = 1800;

  type Phase = "checking" | "downloading" | "installing" | "starting" | "error";

  let phase = $state<Phase>("checking");
  let status = $state("Checking for updates…");
  let detail = $state("");
  let progress = $state<number | null>(null); // null = indeterminate
  let version = $state("");

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  onMount(() => {
    if (!isTauri()) {
      detail = "Preview: the updater only runs inside the app";
      return;
    }
    // Show the window only after the first frame is painted (no blank flash).
    requestAnimationFrame(() => requestAnimationFrame(() => void getCurrentWindow().show()));
    void getVersion().then((v) => (version = v));
    void run();
  });

  async function run() {
    const startedAt = performance.now();
    try {
      const result = await checkForUpdate();
      if (result.status === "available") await applyUpdate(result.latest, result.asset);
    } catch (err) {
      showError(phase === "checking" ? "Couldn't check for updates" : "Update failed", err);
      await sleep(ERROR_HOLD_MS);
    }

    phase = "starting";
    status = "Starting…";
    detail = "";
    progress = null;
    const elapsed = performance.now() - startedAt;
    if (elapsed < MIN_VISIBLE_MS) await sleep(MIN_VISIBLE_MS - elapsed);
    await finishStartup();
  }

  // In a real update the app exits once the installer launches, so this only
  // returns in demo mode.
  async function applyUpdate(latest: string, asset: UpdateAsset) {
    phase = "downloading";
    status = "Downloading update…";
    detail = `Version ${latest}`;
    progress = 0;
    await installUpdate(asset, onDownloadEvent);
  }

  function onDownloadEvent(e: DownloadEvent) {
    switch (e.event) {
      case "started":
        progress = e.data.total ? 0 : null;
        break;
      case "progress": {
        const { downloaded, total } = e.data;
        if (total) {
          progress = Math.min(downloaded / total, 1);
          status = `Downloading update… ${Math.round(progress * 100)}%`;
          detail = `${formatBytes(downloaded)} of ${formatBytes(total)}`;
        } else {
          progress = null;
          detail = formatBytes(downloaded);
        }
        break;
      }
      case "verifying":
        status = "Verifying update…";
        progress = null;
        break;
      case "installing":
        phase = "installing";
        status = "Installing update…";
        detail = "The app will restart by itself";
        progress = null;
        break;
    }
  }

  function showError(title: string, err: unknown) {
    phase = "error";
    status = title;
    detail = err instanceof Error ? err.message : String(err);
    progress = null;
  }
</script>

<div class="app-backdrop" aria-hidden="true"></div>

<div class="splash" data-tauri-drag-region>
  <div class="center">
    <SplashLogo busy={phase !== "error"} />

    <div class="text">
      <p class="status" class:error={phase === "error"}>{status}</p>
      <p class="detail" title={detail}>{detail || " "}</p>
    </div>

    <div class="bar" class:indeterminate={progress === null} class:hidden={phase === "error"}>
      <div class="fill" style:transform={progress === null ? undefined : `scaleX(${progress})`}></div>
    </div>
  </div>

  <p class="version">{version ? `v${version}` : " "}</p>
</div>

<style>
  .splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100vh;
    padding: 0 24px 16px;
  }

  /* Everything inside passes clicks through, so the whole window drags. */
  .splash > * {
    pointer-events: none;
  }

  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding-top: 16px;
  }

  .text {
    display: grid;
    gap: 4px;
    width: 100%;
    margin: 26px 0 18px;
    text-align: center;
  }

  .status {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .status.error {
    color: #ffb4b0;
  }

  .detail {
    overflow: hidden;
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    position: relative;
    width: 184px;
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.08);
    box-shadow: inset 0 1px 1px rgb(0 0 0 / 0.35);
    transition: opacity var(--dur-med);
  }

  .bar.hidden {
    opacity: 0;
  }

  .fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--accent-grad);
    box-shadow: 0 0 12px var(--accent-glow);
    transform-origin: left center;
    transform: scaleX(0);
    transition: transform 160ms linear;
  }

  .indeterminate .fill {
    width: 38%;
    transition: none;
    animation: sweep 1.25s var(--ease-in-out) infinite;
  }

  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(265%);
    }
  }

  .version {
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
</style>

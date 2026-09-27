<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
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
  const ERROR_HOLD_MS = 2200;
  /** Time for the bar to fill and the logo to pop before the app opens. */
  const DONE_MS = 380;
  /** How often the byte count and speed are redrawn; faster is unreadable. */
  const META_EVERY_MS = 250;
  /** Window over which the download speed is measured. */
  const SPEED_WINDOW_MS = 500;

  type Phase = "checking" | "downloading" | "verifying" | "installing" | "starting" | "error";

  let phase = $state<Phase>("checking");
  let title = $state("Checking for updates…");
  let detail = $state("");
  let progress = $state<number | null>(null); // null = indeterminate
  let percent = $state<number | null>(null);
  let transfer = $state(""); // "5.7 MB of 13.6 MB"
  let rate = $state(""); // "2.1 MB/s · 4s left"
  let version = $state("");

  const countdown = $derived(phase === "error");
  const indeterminate = $derived(progress === null && !countdown);
  const tone = $derived(phase === "error" ? "error" : phase === "starting" ? "done" : "busy");

  let updater = { checkForUpdate, installUpdate, finishStartup };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  onMount(() => {
    if (!isTauri()) {
      const demo = new URLSearchParams(location.search).get("demo");
      if (import.meta.env.DEV && demo !== null) {
        void import("./preview").then(({ previewUpdater }) => {
          const preview = previewUpdater(demo);
          updater = preview;
          version = preview.version;
          void run();
        });
      } else {
        detail = "Preview: the updater only runs inside the app";
      }
      return;
    }
    // Show the window only after the first frame is painted (no blank flash).
    requestAnimationFrame(() => requestAnimationFrame(() => void getCurrentWindow().show()));
    void getVersion().then((v) => (version = v));
    void run();
  });

  async function run() {
    const startedAt = performance.now();
    let upToDate = false;
    try {
      const result = await updater.checkForUpdate();
      upToDate = result.status === "upToDate";
      if (result.status === "available") await applyUpdate(result.current, result.latest, result.asset);
    } catch (err) {
      showError(phase === "checking" ? "Couldn't check for updates" : "Update failed", err);
      await sleep(ERROR_HOLD_MS);
    }

    phase = "starting";
    title = "Starting…";
    detail = upToDate ? "You're on the latest version" : "";
    progress = 1;
    percent = null;
    transfer = "";
    rate = "";
    const elapsed = performance.now() - startedAt;
    await sleep(Math.max(MIN_VISIBLE_MS - elapsed, DONE_MS));
    await updater.finishStartup();
  }

  // In a real update the app exits once the installer launches, so this only
  // returns in demo mode.
  async function applyUpdate(current: string, latest: string, asset: UpdateAsset) {
    phase = "downloading";
    title = "Downloading update";
    detail = `v${current} → v${latest}`;
    progress = 0;
    percent = 0;
    transfer = asset.size ? `0 B of ${formatBytes(asset.size)}` : "";
    await updater.installUpdate(asset, onDownloadEvent);
  }

  let sample = { at: 0, bytes: 0 };
  let speed = 0; // bytes per second, smoothed
  let lastMeta = 0;

  function onDownloadEvent(e: DownloadEvent) {
    switch (e.event) {
      case "started":
        sample = { at: performance.now(), bytes: 0 };
        speed = 0;
        lastMeta = 0;
        progress = e.data.total ? 0 : null;
        percent = e.data.total ? 0 : null;
        break;
      case "progress":
        onProgress(e.data.downloaded, e.data.total);
        break;
      case "verifying":
        phase = "verifying";
        title = "Verifying update…";
        detail = "Checking its SHA-256 checksum";
        clearTransfer();
        break;
      case "installing":
        phase = "installing";
        title = "Installing update…";
        detail = "The app will restart by itself";
        clearTransfer();
        break;
    }
  }

  function onProgress(downloaded: number, total: number | null) {
    const now = performance.now();
    const elapsed = now - sample.at;
    if (elapsed >= SPEED_WINDOW_MS) {
      const current = ((downloaded - sample.bytes) * 1000) / elapsed;
      speed = speed ? speed * 0.65 + current * 0.35 : current;
      sample = { at: now, bytes: downloaded };
    }
    progress = total ? Math.min(downloaded / total, 1) : null;

    // The bar follows every chunk; the numbers settle at a readable pace.
    const finished = total !== null && downloaded >= total;
    if (now - lastMeta < META_EVERY_MS && !finished) return;
    lastMeta = now;
    percent = progress === null ? null : Math.floor(progress * 100);
    transfer = total ? `${formatBytes(downloaded)} of ${formatBytes(total)}` : formatBytes(downloaded);
    rate =
      speed > 0
        ? [`${formatBytes(speed)}/s`, total && !finished ? timeLeft((total - downloaded) / speed) : ""]
            .filter(Boolean)
            .join(" · ")
        : "";
  }

  function timeLeft(seconds: number): string {
    if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))}s left`;
    return `${Math.ceil(seconds / 60)} min left`;
  }

  function clearTransfer() {
    progress = null;
    percent = null;
    transfer = "";
    rate = "";
  }

  function showError(heading: string, err: unknown) {
    phase = "error";
    title = heading;
    detail = err instanceof Error ? err.message : String(err);
    clearTransfer();
    transfer = "Opening the app anyway…";
  }
</script>

<div class="app-backdrop" aria-hidden="true"></div>

<div class="splash" data-tauri-drag-region>
  <div class="center">
    <SplashLogo {tone} />

    <div class="text" aria-live="polite">
      {#key title}
        <p class="title" class:error={phase === "error"} in:fly={{ y: 6, duration: 260, easing: cubicOut }}>
          {title}{#if percent !== null}<span class="pct">{percent}%</span>{/if}
        </p>
      {/key}
      <p class="detail" class:error={phase === "error"} title={detail}>{detail || " "}</p>
    </div>

    <div
      class="bar"
      class:indeterminate
      class:countdown
      class:done={phase === "starting"}
      style:--hold="{ERROR_HOLD_MS}ms"
    >
      <div class="fill" style:transform={progress === null || countdown ? undefined : `scaleX(${progress})`}>
        <div class="shine"></div>
      </div>
    </div>

    <div class="meta">
      <span>{transfer}</span>
      <span>{rate}</span>
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
    padding: 0 24px 14px;
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
    padding-top: 10px;
  }

  .text {
    display: grid;
    gap: 3px;
    width: 100%;
    margin: 10px 0 16px;
    text-align: center;
  }

  .title {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.005em;
    font-variant-numeric: tabular-nums;
  }

  .title.error {
    color: #ffb4b0;
  }

  .pct {
    min-width: 3.2ch;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: #cfd6ff;
    background: rgb(139 151 255 / 0.16);
    box-shadow: inset 0 0 0 1px rgb(139 151 255 / 0.28);
  }

  .detail {
    overflow: hidden;
    font-size: 12px;
    color: var(--text-3);
    white-space: nowrap;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }

  /* Error messages can be long: give them two lines. */
  .detail.error {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    white-space: normal;
    color: rgb(255 200 196 / 0.6);
  }

  .bar {
    position: relative;
    width: 232px;
    height: 5px;
    overflow: hidden;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.08);
    box-shadow: inset 0 1px 1px rgb(0 0 0 / 0.35);
  }

  .fill {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    background: var(--accent-grad);
    box-shadow: 0 0 12px var(--accent-glow);
    transform-origin: left center;
    transform: scaleX(0);
    transition: transform 160ms linear;
  }

  /* A glint running along the filled part; it is scaled with the fill, so it
     never shows past it. */
  .shine {
    position: absolute;
    inset: 0 auto 0 0;
    width: 40%;
    background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.55), transparent);
    opacity: 0;
  }

  .indeterminate .fill {
    width: 38%;
    transition: none;
  }

  .countdown .fill {
    background: linear-gradient(90deg, #ff9f7a, #e5484d);
    box-shadow: 0 0 10px rgb(229 72 77 / 0.45);
    transform: scaleX(1);
    transition: none;
  }

  .done .fill {
    transition: transform 320ms var(--ease-out);
  }

  .meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    width: 232px;
    height: 16px;
    margin-top: 8px;
    font-size: 11px;
    color: var(--text-3);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* A lone message (no speed readout) sits centered under the bar. */
  .meta:has(span:last-child:empty) {
    justify-content: center;
  }

  .version {
    font-size: 11px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: no-preference) {
    .text,
    .bar,
    .meta,
    .version {
      animation: enter 520ms var(--ease-out) both;
    }

    .text {
      animation-delay: 120ms;
    }

    .bar,
    .meta {
      animation-delay: 200ms;
    }

    .version {
      animation-delay: 280ms;
    }

    .indeterminate .fill {
      animation: sweep 1.25s var(--ease-in-out) infinite;
    }

    .countdown .fill {
      animation: drain var(--hold) linear forwards;
    }

    .bar:not(.indeterminate, .countdown) .shine {
      animation: shine 1.6s var(--ease-in-out) infinite;
    }
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(265%);
    }
  }

  @keyframes drain {
    to {
      transform: scaleX(0);
    }
  }

  @keyframes shine {
    from {
      opacity: 1;
      transform: translateX(-100%);
    }
    to {
      opacity: 1;
      transform: translateX(250%);
    }
  }
</style>

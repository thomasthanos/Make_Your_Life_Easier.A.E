<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Logo from "../../lib/components/Logo.svelte";
  import { nav } from "../../lib/nav.svelte";
  import { pages } from "../pages/registry";

  let { maximized = $bindable(false) }: { maximized?: boolean } = $props();
  const win = isTauri() ? getCurrentWindow() : null;
  const pageTitle = $derived(pages.find((p) => p.id === nav.current)?.label ?? "");
  let syncVersion = 0;

  async function syncMaximized() {
    if (!win) return;
    const version = ++syncVersion;
    const next = await win.isMaximized();
    if (version === syncVersion) maximized = next;
  }

  async function toggleMaximized() {
    if (!win) return;
    await win.toggleMaximize();
    await syncMaximized();
  }

  onMount(() => {
    if (!win) return;
    void syncMaximized();
    const unlisten = win.onResized(() => void syncMaximized());
    return () => void unlisten.then((off) => off());
  });
</script>

<header class="titlebar" data-tauri-drag-region>
  <div class="brand">
    <Logo size={20} />
    <span class="name">Make Your Life Easier</span>
    {#if pageTitle}
      <span class="breadcrumb" aria-label={`Current page: ${pageTitle}`}>
        <span class="sep" aria-hidden="true">/</span>
        <span class="page">{pageTitle}</span>
      </span>
    {/if}
  </div>

  <div class="controls">
    <button class="ctl" aria-label="Minimize" onclick={() => win?.minimize()}>
      <svg viewBox="0 0 10 10"><path d="M0 5h10" /></svg>
    </button>
    <button class="ctl" aria-label={maximized ? "Restore" : "Maximize"} onclick={() => void toggleMaximized()}>
      {#if maximized}
        <svg viewBox="0 0 10 10">
          <path d="M2.5 2.5v-1a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
          <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
        </svg>
      {:else}
        <svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" rx="1" /></svg>
      {/if}
    </button>
    <button class="ctl close" aria-label="Close" onclick={() => win?.close()}>
      <svg viewBox="0 0 10 10"><path d="M.5.5l9 9m0-9l-9 9" /></svg>
    </button>
  </div>
</header>

<style>
  .titlebar {
    position: relative;
    grid-area: title;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    height: var(--titlebar-h);
    margin-inline: calc(var(--frame-gap) * -1);
    padding-left: 17px;
    background:
      radial-gradient(70% 180% at 0% 0%, rgb(98 111 231 / 0.11), transparent 58%),
      radial-gradient(58% 170% at 100% 0%, rgb(43 172 205 / 0.085), transparent 62%),
      var(--titlebar-fill);
  }

  .titlebar::after {
    content: "";
    position: absolute;
    right: 16px;
    bottom: 0;
    left: 16px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--titlebar-divider) 18%, var(--titlebar-divider) 82%, transparent);
    pointer-events: none;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    font-size: 12.75px;
    white-space: nowrap;
    /* Clicks fall through to the drag region. */
    pointer-events: none;
  }

  .name {
    font-weight: 600;
    letter-spacing: -0.005em;
    color: var(--text-1);
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .sep {
    color: rgb(205 215 242 / 0.28);
  }

  .page {
    overflow: hidden;
    color: rgb(214 222 245 / 0.6);
    text-overflow: ellipsis;
  }

  .controls {
    display: flex;
    flex: none;
    align-items: center;
    height: 100%;
    border-left: 1px solid rgb(255 255 255 / 0.025);
  }

  .ctl {
    display: grid;
    place-items: center;
    width: var(--window-control-w);
    height: 100%;
    border-left: 1px solid rgb(255 255 255 / 0.018);
    border-radius: 0;
    background: transparent;
    color: var(--ctl-icon);
    transition:
      background var(--dur-fast),
      color var(--dur-fast),
      box-shadow var(--dur-fast);
  }

  .ctl:hover {
    background: var(--ctl-hover);
    color: #fff;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.045);
  }

  .ctl:active {
    background: var(--ctl-press);
  }

  .close:hover {
    background: var(--ctl-close-hover);
    box-shadow: none;
  }

  .close:active {
    background: var(--ctl-close-press);
  }

  svg {
    width: 10.5px;
    height: 10.5px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.05;
    shape-rendering: geometricPrecision;
  }
</style>

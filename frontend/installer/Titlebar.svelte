<script lang="ts">
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Logo from "../lib/components/Logo.svelte";

  let {
    label,
    busy = false,
    onclose,
  }: { label: string; busy?: boolean; onclose: () => void } = $props();

  const win = isTauri() ? getCurrentWindow() : null;
</script>

<header class="titlebar" data-tauri-drag-region>
  <div class="brand">
    <Logo size={18} />
    <span class="name">Make Your Life Easier</span>
    <span class="badge">{label}</span>
  </div>
  <div class="controls">
    <button class="ctl" aria-label="Minimize" onclick={() => win?.minimize()}>
      <svg viewBox="0 0 10 10"><path d="M0 5h10" /></svg>
    </button>
    <button
      class="ctl close"
      aria-label="Close"
      disabled={busy}
      title={busy ? "Setup is working, please wait" : undefined}
      onclick={onclose}
    >
      <svg viewBox="0 0 10 10"><path d="M.5.5l9 9m0-9l-9 9" /></svg>
    </button>
  </div>
</header>

<style>
  .titlebar {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    height: 42px;
    padding-left: 16px;
    background:
      radial-gradient(70% 180% at 0% 0%, rgb(98 111 231 / 0.1), transparent 58%),
      linear-gradient(180deg, rgb(24 30 45 / 0.5), rgb(13 18 29 / 0.2));
    box-shadow: inset 0 -1px 0 var(--titlebar-divider);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12.5px;
    pointer-events: none;
  }

  .name {
    font-weight: 600;
    color: var(--text-1);
  }

  .badge {
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    color: #cfd6ff;
    background: rgb(var(--accent-rgb) / 0.14);
    box-shadow: inset 0 0 0 1px rgb(var(--accent-rgb) / 0.22);
  }

  .controls {
    display: flex;
  }

  .ctl {
    display: grid;
    place-items: center;
    width: 46px;
    height: 100%;
    color: var(--ctl-icon);
    transition: background var(--dur-fast);
  }

  .ctl svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
  }

  .ctl:hover {
    background: var(--ctl-hover);
  }

  .ctl.close:hover {
    background: var(--ctl-close-hover);
    color: #fff;
  }

  .ctl:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .ctl:disabled:hover {
    background: none;
  }
</style>

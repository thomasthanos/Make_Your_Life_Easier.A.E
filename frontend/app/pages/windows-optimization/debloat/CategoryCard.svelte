<script lang="ts">
  import type { Snippet } from "svelte";
  import AppWindow from "@lucide/svelte/icons/app-window";
  import Bot from "@lucide/svelte/icons/bot";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Gamepad2 from "@lucide/svelte/icons/gamepad-2";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Megaphone from "@lucide/svelte/icons/megaphone";
  import Package from "@lucide/svelte/icons/package";
  import PanelBottom from "@lucide/svelte/icons/panel-bottom";
  import Pin from "@lucide/svelte/icons/pin";
  import Puzzle from "@lucide/svelte/icons/puzzle";
  import Search from "@lucide/svelte/icons/search";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  let { id, title, count, description, wide = false, collapsible = false, open = $bindable(true), ontoggle, tools, children }: {
    id: string; title: string; count?: string; description?: string; wide?: boolean;
    /** The header folds the card away. */
    collapsible?: boolean; open?: boolean;
    /** Told instead of folding by itself, when the page keeps what is open. */
    ontoggle?: (open: boolean) => void;
    tools?: Snippet; children: Snippet;
  } = $props();
  const icons: Record<string, typeof Package> = {
    privacy: EyeOff, system: Settings2, taskbar: PanelBottom, explorer: FolderOpen, ai: Bot, apps: AppWindow, features: Puzzle,
    layout: LayoutGrid, recommendations: EyeOff, folders: FolderOpen, pins: Pin,
    microsoft: AppWindow, bing: Search, xbox: Gamepad2, thirdParty: Megaphone,
  };
  const Icon = $derived(icons[id] ?? Package);
  const contentId = $props.id();
</script>

<section class="category-card surface" class:wide class:closed={collapsible && !open} aria-label={title}>
  <header>
    {#if collapsible}
      <button type="button" class="heading toggle" aria-expanded={open} aria-controls={contentId} onclick={() => (ontoggle ? ontoggle(!open) : (open = !open))}>
        <span class="category-icon"><Icon size={15} /></span>
        <span class="category-heading"><h3>{title}</h3>{#if description}<p>{description}</p>{/if}</span>
        {#if count}<span class="count">{count}</span>{/if}
        <span class="chevron"><ChevronDown size={15} /></span>
      </button>
    {:else}
      <div class="heading">
        <span class="category-icon"><Icon size={15} /></span>
        <div class="category-heading"><h3>{title}</h3>{#if description}<p>{description}</p>{/if}</div>
        {#if count}<span class="count">{count}</span>{/if}
      </div>
    {/if}
    {#if tools}<div class="card-tools">{@render tools()}</div>{/if}
  </header>
  <div class="card-content" id={contentId} hidden={collapsible && !open}>{@render children()}</div>
</section>

<style>
  .category-card { min-width: 0; padding: 10px 10px 8px; }
  .category-card.wide { grid-column: 1 / -1; }
  .category-card.closed { padding-bottom: 10px; }
  header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .closed header { margin-bottom: 0; }
  .heading { display: flex; flex: 1; align-items: center; gap: 9px; min-width: 0; padding: 2px; border-radius: 8px; text-align: left; }
  .toggle:hover { background: rgb(255 255 255 / 0.03); }
  .toggle:focus-visible { outline: 2px solid rgb(var(--accent-rgb) / 0.75); outline-offset: 1px; }
  .category-icon { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border: 1px solid rgb(var(--accent-rgb) / 0.2); border-radius: 8px; background: rgb(var(--accent-rgb) / 0.08); color: var(--accent); }
  .category-heading { display: grid; flex: 1; gap: 2px; min-width: 0; }
  h3 { color: var(--text-1); font-size: 13px; font-weight: 600; }
  p { color: var(--text-2); font-size: 11px; line-height: 1.45; }
  .count { flex: none; padding: 2px 7px; border-radius: 6px; background: rgb(255 255 255 / 0.04); color: var(--text-2); font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .chevron { display: grid; place-items: center; flex: none; color: var(--text-3); transition: transform var(--dur-fast) var(--ease-out); }
  .closed .chevron { transform: rotate(-90deg); }
  .card-tools { flex: none; }
  .card-content { container: optimization-list / inline-size; min-width: 0; }
  .card-content[hidden] { display: none; }
  @media (prefers-reduced-motion: reduce) { .chevron { transition: none; } }
</style>

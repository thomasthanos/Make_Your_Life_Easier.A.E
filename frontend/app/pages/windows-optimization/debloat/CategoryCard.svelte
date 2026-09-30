<script lang="ts">
  import type { Snippet } from "svelte";
  import Bot from "@lucide/svelte/icons/bot";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Package from "@lucide/svelte/icons/package";
  import PanelBottom from "@lucide/svelte/icons/panel-bottom";
  import Pin from "@lucide/svelte/icons/pin";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  let { id, title, count, description, wide = false, tools, children }: {
    id: string; title: string; count?: string; description?: string; wide?: boolean; tools?: Snippet; children: Snippet;
  } = $props();
  const icons: Record<string, typeof Package> = { privacy: EyeOff, system: Settings2, taskbar: PanelBottom, explorer: FolderOpen, ai: Bot, layout: LayoutGrid, recommendations: EyeOff, folders: FolderOpen, pins: Pin };
  const Icon = $derived(icons[id] ?? Package);
</script>
<section class="category-card surface" class:wide aria-label={title}>
  <header>
    <span class="category-icon"><Icon size={17} /></span>
    <div class="category-heading"><h3>{title}</h3>{#if description}<p>{description}</p>{/if}</div>
    {#if count}<span class="count">{count}</span>{/if}
  </header>
  {#if tools}<div class="card-tools">{@render tools()}</div>{/if}
  <div class="card-content">{@render children()}</div>
</section>
<style>
  .category-card { min-width: 0; padding: 18px; }
  .category-card.wide { grid-column: 1 / -1; }
  header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .category-icon { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border: 1px solid rgb(var(--accent-rgb) / 0.2); border-radius: 10px; background: rgb(var(--accent-rgb) / 0.08); color: var(--accent); }
  .category-heading { flex: 1; min-width: 0; }
  h3 { color: var(--text-1); font-size: 14px; font-weight: 600; }
  p { margin-top: 4px; color: var(--text-2); font-size: 11.5px; line-height: 1.6; }
  .count { flex: none; padding: 3px 7px; border-radius: 6px; background: rgb(255 255 255 / 0.04); color: var(--text-2); font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .card-tools { margin-bottom: 14px; }
  .card-content { container: optimization-list / inline-size; min-width: 0; }
</style>

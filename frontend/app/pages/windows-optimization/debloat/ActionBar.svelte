<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, detail, children }: { title: string; detail: string; children: Snippet } = $props();
</script>
<footer class="action-bar surface">
  <div class="action-summary"><strong>{title}</strong><span>{detail}</span></div>
  <div class="action-buttons">{@render children()}</div>
</footer>
<style>
  .action-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 8px; padding: 8px 10px; border-color: rgb(var(--accent-rgb) / 0.2); background: rgb(255 255 255 / 0.02); }
  .action-summary { display: grid; gap: 4px; }
  strong { color: var(--text-1); font-size: 12.5px; font-weight: 600; }
  .action-summary > span { color: rgb(200 210 240 / 0.65); font-size: 11.5px; }
  .action-buttons { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
</style>

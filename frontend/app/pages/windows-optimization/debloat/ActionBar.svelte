<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, detail, children }: { title: string; detail: string; children: Snippet } = $props();
</script>
<footer class="action-bar surface">
  <div class="action-summary"><strong>{title}</strong><span>{detail}</span></div>
  <div class="action-buttons">{@render children()}</div>
</footer>
<style>
  .action-bar { position: sticky; bottom: 0; z-index: 3; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 18px; padding: 14px 16px; border-color: rgb(var(--accent-rgb) / 0.2); background: #1b202d; box-shadow: 0 -6px 20px -12px rgb(0 0 0 / 0.7); }
  .action-summary { display: grid; gap: 4px; }
  strong { color: var(--text-1); font-size: 12.5px; font-weight: 600; }
  .action-summary > span { color: rgb(200 210 240 / 0.65); font-size: 11.5px; }
  .action-buttons { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
</style>

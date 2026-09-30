<script lang="ts">
  import type { Snippet } from "svelte";
  import "./optimization.css";
  let { children }: { children: Snippet } = $props();
</script>
<div class="grid-frame"><div class="category-grid">{@render children()}</div></div>
<style>
  .grid-frame { container: optimization-grid / inline-size; min-width: 0; }
  .category-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
  @container optimization-grid (min-width: 900px) { .category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @container optimization-grid (min-width: 1200px) { .category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>

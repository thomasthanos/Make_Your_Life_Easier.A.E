<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import ChoiceButtons from "./ChoiceButtons.svelte";
  import type { Snippet } from "svelte";
  import type { ChoiceOption } from "./catalog";
  let { query = $bindable(""), filters, filter, onchange, placeholder = "Search settings…", children }: {
    query?: string; filters: readonly ChoiceOption[]; filter: string; onchange: (value: string) => void; placeholder?: string;
    /** More on the same line, at its end (a button). */
    children?: Snippet;
  } = $props();
</script>
<div class="list-toolbar">
  <label class="list-search">
    <Search size={15} />
    <input aria-label={placeholder} {placeholder} bind:value={query} spellcheck="false" />
    {#if query}<button type="button" aria-label="Clear search" onclick={() => (query = "")}><X size={13} /></button>{/if}
  </label>
  <ChoiceButtons options={filters} active={filter} preset={false} ariaLabel="List filters" {onchange} />
  {#if children}<div class="extra">{@render children()}</div>{/if}
</div>
<style>
  .list-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .extra { display: flex; align-items: center; gap: 8px; margin-left: auto; }
  .list-search { display: flex; align-items: center; gap: 9px; flex: 0 1 340px; min-width: 200px; min-height: 32px; padding: 0 11px; border: 1px solid rgb(255 255 255 / 0.09); border-radius: 9px; background: rgb(0 0 0 / 0.15); color: var(--text-2); }
  .list-search:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  input { width: 100%; min-width: 0; padding: 6px 0; border: 0; background: transparent; color: var(--text-1); font: inherit; font-size: 12px; }
  input:focus-visible { outline: none; }
  button { display: grid; place-items: center; width: 24px; height: 24px; flex: none; border-radius: 5px; color: var(--text-2); }
  button:hover { background: var(--hover); }
</style>

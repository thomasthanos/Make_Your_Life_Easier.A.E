<script lang="ts">
  import type { Snippet } from "svelte";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { Risk, TweakState } from "./api";
  import StatusBadge from "./StatusBadge.svelte";
  let { title, summary = "", state, risk, recommended = false, selectable = false, checked = false, disabled = false, inlineActions = false, onselect, actions }: {
    title: string; summary?: string; state?: TweakState; risk?: Risk; recommended?: boolean;
    selectable?: boolean; checked?: boolean; disabled?: boolean; inlineActions?: boolean; onselect?: (checked: boolean) => void; actions?: Snippet;
  } = $props();
</script>

{#snippet copy()}
  <span class="row-copy">
    <span class="row-title">{title}
      {#if recommended}<span class="recommended">Recommended</span>{/if}
      {#if risk === "caution"}<span class="caution"><TriangleAlert size={11} /> Caution</span>{/if}
    </span>
    {#if summary}<span class="row-summary">{summary}</span>{/if}
    {#if state === "unavailable"}<span class="row-summary">This change is not available on this version of Windows.</span>{/if}
  </span>
{/snippet}

<div class="option-row" class:selected={selectable && checked} class:inline-actions={inlineActions}>
  {#if selectable}
    <label class="row-choice">
      <input type="checkbox" class="check" aria-label={"Select " + title} {checked} {disabled} onchange={(event) => {
        const want = event.currentTarget.checked;
        event.currentTarget.checked = checked;
        onselect?.(want);
      }} />
      {@render copy()}
    </label>
  {:else}
    <div class="row-copy-wrap">{@render copy()}</div>
  {/if}
  {#if state || actions}
    <div class="row-actions">
      {#if state}<StatusBadge {state} />{/if}
      {@render actions?.()}
    </div>
  {/if}
</div>

<style>
  .option-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 16px; border: 1px solid rgb(255 255 255 / 0.065); border-radius: 10px; background: rgb(255 255 255 / 0.018); }
  .option-row.selected { border-color: rgb(var(--accent-rgb) / 0.26); background: rgb(var(--accent-rgb) / 0.06); }
  .row-choice { display: flex; align-items: flex-start; gap: 12px; min-width: 0; cursor: pointer; }
  .row-choice input { margin-top: 2px; }
  .row-choice:has(input:disabled) { cursor: default; }
  .row-copy-wrap, .row-copy { display: grid; gap: 5px; min-width: 0; }
  .row-title { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; color: var(--text-1); font-size: 13px; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
  .row-summary { color: rgb(200 210 240 / 0.65); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
  .row-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
  .recommended, .caution { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 5px; font-size: 10px; font-weight: 500; }
  .recommended { background: rgb(var(--accent-rgb) / 0.12); color: rgb(var(--accent-soft-rgb)); }
  .caution { background: rgb(245 188 95 / 0.08); color: #efc38a; }
  @container optimization-list (max-width: 560px) {
    .option-row { gap: 10px; padding: 13px; }
    .option-row:not(.inline-actions) { grid-template-columns: minmax(0, 1fr); }
    .option-row:not(.inline-actions) .row-actions { justify-content: flex-start; }
    .option-row:not(.inline-actions):has(.row-choice) .row-actions { padding-left: 30px; }
  }
</style>

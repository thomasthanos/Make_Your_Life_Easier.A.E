<script lang="ts">
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import X from "@lucide/svelte/icons/x";
  import { selectionPresets, type ChoiceOption } from "./catalog";
  let { options = selectionPresets, active, disabled = false, preset = true, ariaLabel = "Selection presets", onchange }: {
    options?: readonly ChoiceOption[]; active?: string; disabled?: boolean; preset?: boolean; ariaLabel?: string; onchange: (value: string) => void;
  } = $props();
</script>

<div class="choices" class:filters={!preset} role="group" aria-label={ariaLabel}>
  {#each options as option (option.value)}
    <button type="button" class:active={active === option.value}
      aria-pressed={active === undefined ? undefined : active === option.value} {disabled} onclick={() => onchange(option.value)}>
      {#if preset}
        {#if option.value === "recommended" || option.value === "essential"}<Sparkles size={13} />
        {:else if option.value === "all"}<CheckCheck size={13} />
        {:else if option.value === "none"}<X size={13} />{/if}
      {/if}
      {option.label}
    </button>
  {/each}
</div>

<style>
  .choices { display: flex; flex-wrap: wrap; gap: 6px; }
  button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 6px 10px; border: 1px solid rgb(255 255 255 / 0.09); border-radius: 7px; background: rgb(255 255 255 / 0.035); color: var(--text-2); font-size: 11.5px; font-weight: 500; }
  button:hover:not(:disabled) { border-color: rgb(var(--accent-rgb) / 0.35); background: var(--hover); color: var(--text-1); }
  button.active { border-color: rgb(var(--accent-rgb) / 0.3); background: rgb(var(--accent-rgb) / 0.16); color: var(--text-1); }
  .filters button { border-color: transparent; background: transparent; }
  .filters button.active { border-color: rgb(var(--accent-rgb) / 0.2); background: rgb(var(--accent-rgb) / 0.13); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
</style>

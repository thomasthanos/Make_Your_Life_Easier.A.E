<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleMinus from "@lucide/svelte/icons/circle-minus";
  import Minus from "@lucide/svelte/icons/minus";
  import type { TweakState } from "./api";
  let { state }: { state: TweakState } = $props();
  const labels: Record<TweakState, string> = { applied: "Applied", partial: "Partly applied", notApplied: "Not applied", unavailable: "Unavailable" };
</script>

<span class="badge {state}">
  {#if state === "applied"}<CircleCheck size={12} />
  {:else if state === "partial"}<CircleMinus size={12} />
  {:else}<Minus size={12} />{/if}
  {labels[state]}
</span>

<style>
  .badge { display: inline-flex; align-items: center; gap: 5px; flex: none; padding: 4px 7px; border-radius: 6px; background: rgb(255 255 255 / 0.045); color: rgb(200 210 240 / 0.65); font-size: 10.5px; font-weight: 500; white-space: nowrap; }
  .applied { background: rgb(62 207 142 / 0.08); color: #98dfbd; }
  .partial { background: rgb(245 188 95 / 0.08); color: #efc38a; }
  .unavailable { border: 1px dashed rgb(255 255 255 / 0.12); background: transparent; }
</style>

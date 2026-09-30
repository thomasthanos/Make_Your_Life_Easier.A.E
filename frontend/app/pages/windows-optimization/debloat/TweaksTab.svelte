<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import CategoryCard from "./CategoryCard.svelte";
  import CategoryGrid from "./CategoryGrid.svelte";
  import ListToolbar from "./ListToolbar.svelte";
  import OptimizationRow from "./OptimizationRow.svelte";
  import Progress from "./Progress.svelte";
  import { tweakCategories } from "./catalog";
  import { debloat } from "./state.svelte";
  const view = $derived(debloat.views.tweaks);
  const tweaks = $derived(debloat.status?.tweaks ?? []);
  const shown = $derived(tweaks.filter((tweak) =>
    (tweak.title + " " + tweak.summary).toLowerCase().includes(view.query.trim().toLowerCase()) &&
    (view.filter === "all" || (view.filter === "applied" && tweak.state === "applied") || (view.filter === "pending" && (tweak.state === "notApplied" || tweak.state === "partial")))
  ));
  const undoable = $derived(tweaks.filter((tweak) => tweak.canUndo));
</script>
<div class="optimization-ui">
  <section class="overview surface">
    <div class="overview-copy"><h2>Windows tweaks</h2><p>Browse settings by category. Apply a change on its own, or undo it.</p></div>
    <button class="btn" disabled={debloat.locked || !undoable.length} onclick={() => debloat.undo(undoable)}><Undo2 size={14} /> Undo MYLE changes ({undoable.length})</button>
  </section>
  <Progress />
  <ListToolbar bind:query={view.query} filter={view.filter}
    filters={[{ value: "all", label: "All" }, { value: "applied", label: "Applied" }, { value: "pending", label: "Pending" }]}
    onchange={(value) => (view.filter = value)} placeholder="Search Windows tweaks…" />
  {#if !debloat.status}
    <div class="empty-state"><strong>{debloat.error ? "Could not load settings" : "Loading Windows tweaks…"}</strong></div>
  {:else if !shown.length}
    <div class="empty-state"><strong>No matching tweaks</strong><span>Clear your search or try another filter.</span>
      <button class="btn" onclick={() => ((view.query = ""), (view.filter = "all"))}>Reset filters</button>
    </div>
  {:else}
    <CategoryGrid>
      {#each tweakCategories as category (category.id)}
        {@const rows = shown.filter((tweak) => tweak.category === category.id)}
        {#if rows.length}
          <CategoryCard id={category.id} title={category.title} count={rows.filter((tweak) => tweak.state === "applied").length + " / " + rows.length + " applied"}>
            <div class="option-list">
              {#each rows as tweak (tweak.id)}
                <OptimizationRow title={tweak.title} summary={tweak.summary} state={tweak.state} risk={tweak.risk}>
                  {#snippet actions()}
                    {#if tweak.state !== "unavailable"}
                      {#if tweak.state === "applied" || tweak.canUndo}
                        <button class="btn" disabled={debloat.locked} onclick={() => debloat.undo([tweak])}><Undo2 size={13} /> {tweak.canUndo ? "Undo" : "Turn off"}</button>
                      {/if}
                      {#if tweak.state === "notApplied" || tweak.state === "partial"}
                        <button class="btn primary" disabled={debloat.locked} onclick={() => debloat.apply(tweak)}><Check size={13} /> Apply</button>
                      {/if}
                    {/if}
                  {/snippet}
                </OptimizationRow>
              {/each}
            </div>
          </CategoryCard>
        {/if}
      {/each}
    </CategoryGrid>
  {/if}
</div>

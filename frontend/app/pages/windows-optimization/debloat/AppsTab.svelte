<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Store from "@lucide/svelte/icons/store";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import ActionBar from "./ActionBar.svelte";
  import CategoryCard from "./CategoryCard.svelte";
  import CategoryGrid from "./CategoryGrid.svelte";
  import ChoiceButtons from "./ChoiceButtons.svelte";
  import ListToolbar from "./ListToolbar.svelte";
  import OptimizationRow from "./OptimizationRow.svelte";
  import Progress from "./Progress.svelte";
  import { appCategories } from "./catalog";
  import type { SelectionPreset } from "./selection";
  import { debloat } from "./state.svelte";
  const view = $derived(debloat.views.apps);
  const shown = $derived(debloat.installedApps.filter((app) =>
    app.title.toLowerCase().includes(view.query.trim().toLowerCase()) &&
    (view.filter === "all" || (view.filter === "recommended" && app.recommended) || (view.filter === "selected" && debloat.isAppChosen(app.id)))
  ));
  const removed = $derived((debloat.status?.apps ?? []).filter((app) => app.removedByMyle && !app.packages.length &&
    app.title.toLowerCase().includes(view.query.trim().toLowerCase())));
  const chosen = $derived(debloat.chosenApps);
</script>
<div class="optimization-ui">
  <section class="overview surface">
    <div class="overview-copy"><h2>Apps to remove</h2><p>Choose apps by category. Removal affects every user of this PC and requires confirmation.</p></div>
    <ChoiceButtons disabled={debloat.locked || !debloat.status} onchange={(preset) => debloat.selectApps(preset as SelectionPreset)} />
  </section>
  <Progress />
  <ListToolbar bind:query={view.query} filter={view.filter}
    filters={[{ value: "all", label: "All" }, { value: "recommended", label: "Recommended" }, { value: "selected", label: "Selected" }]}
    onchange={(value) => (view.filter = value)} placeholder="Search installed apps…" />
  {#if !debloat.status}
    <div class="empty-state"><strong>{debloat.error ? "Could not load apps" : "Checking installed apps…"}</strong></div>
  {:else if !shown.length && !removed.length}
    <div class="empty-state"><strong>{debloat.installedApps.length ? "No matching apps" : "Nothing to remove"}</strong>
      <span>{debloat.installedApps.length ? "Your selections are kept when you change filters." : "None of the apps on MYLE's list is installed."}</span>
      {#if debloat.installedApps.length}<button class="btn" onclick={() => ((view.query = ""), (view.filter = "all"))}>Reset filters</button>{/if}
    </div>
  {:else}
    <CategoryGrid>
      {#each appCategories as category (category.id)}
        {@const rows = shown.filter((app) => app.group === category.id)}
        {@const removedRows = removed.filter((app) => app.group === category.id)}
        {#if rows.length || removedRows.length}
          <CategoryCard id={category.id} title={category.title} count={rows.filter((app) => debloat.isAppChosen(app.id)).length + " / " + rows.length + " selected"} wide={category.id === "microsoft"}>
            {#if category.id === "xbox"}<p class="notice"><TriangleAlert size={14} /> Some games need these apps. Check what you use before selecting them.</p>{/if}
            <div class="app-options" class:microsoft={category.id === "microsoft"}>
              {#each rows as app (app.id)}
                <OptimizationRow title={app.title} recommended={app.recommended} selectable checked={debloat.isAppChosen(app.id)} disabled={debloat.locked} onselect={(checked) => debloat.setApp(app.id, checked)} />
              {/each}
            </div>
            {#if removedRows.length}
              <h4 class="section-label">Removed by MYLE</h4>
              <div class="option-list">
                {#each removedRows as app (app.id)}
                  <OptimizationRow title={app.title} summary="Install it again from the Microsoft Store.">
                    {#snippet actions()}<button class="btn" aria-label={"Get " + app.title + " again"} disabled={debloat.locked} onclick={() => debloat.openStore(app)}><Store size={13} /> Get it again</button>{/snippet}
                  </OptimizationRow>
                {/each}
              </div>
            {/if}
          </CategoryCard>
        {/if}
      {/each}
    </CategoryGrid>
  {/if}
  <ActionBar title={chosen.length + " app" + (chosen.length === 1 ? "" : "s") + " selected"} detail="Review and confirm before anything is removed.">
    <button class="btn danger" disabled={debloat.locked || !chosen.length} onclick={() => debloat.removeApps(chosen)}>
      {#if debloat.busy}<LoaderCircle size={14} class="spin" /> Working…{:else}<Trash2 size={14} /> Remove selected ({chosen.length}){/if}
    </button>
  </ActionBar>
</div>

<style>
  .app-options { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .app-options.microsoft { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @container optimization-list (max-width: 800px) { .app-options.microsoft { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @container optimization-list (max-width: 450px) { .app-options.microsoft { grid-template-columns: minmax(0, 1fr); } }
</style>

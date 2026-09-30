<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Package from "@lucide/svelte/icons/package";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import ActionBar from "./ActionBar.svelte";
  import CategoryCard from "./CategoryCard.svelte";
  import CategoryGrid from "./CategoryGrid.svelte";
  import ChoiceButtons from "./ChoiceButtons.svelte";
  import ListToolbar from "./ListToolbar.svelte";
  import OptimizationRow from "./OptimizationRow.svelte";
  import Progress from "./Progress.svelte";
  import { tweakCategories } from "./catalog";
  import type { SelectionPreset } from "./selection";
  import { debloat } from "./state.svelte";

  const view = $derived(debloat.views.debloat);
  const shown = $derived(debloat.debloatTweaks.filter((tweak) =>
    (tweak.title + " " + tweak.summary).toLowerCase().includes(view.query.trim().toLowerCase()) &&
    (view.filter === "all" || (view.filter === "pending" && tweak.state !== "applied") || (view.filter === "selected" && tweak.state !== "applied" && !debloat.skipped.has(tweak.id)))
  ));
  const planned = $derived(debloat.plannedTweaks.length);
  const apps = $derived(debloat.chosenApps);
</script>

<div class="optimization-ui">
  <section class="overview surface">
    <div class="overview-copy">
      <div class="overview-title"><h2>Debloat Windows</h2>
        {#if debloat.status}<span class="windows-label">{debloat.status.windows.name}</span>{/if}
      </div>
      <p>Choose the changes you want. Review and confirm Apply selected before anything changes on your PC.</p>
    </div>
    <ChoiceButtons disabled={debloat.locked || !debloat.status} onchange={(preset) => debloat.selectTweaks(preset as SelectionPreset)} />
  </section>
  <Progress />
  <ListToolbar bind:query={view.query} filter={view.filter}
    filters={[{ value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "selected", label: "Selected" }]}
    onchange={(value) => (view.filter = value)} placeholder="Search Debloat changes…" />
  {#if !debloat.status}
    <div class="empty-state"><strong>{debloat.error ? "Could not load this PC" : "Checking this PC…"}</strong><span>{debloat.error ? "Refresh the page to try again." : "Your Windows settings will appear here."}</span></div>
  {:else if !shown.length}
    <div class="empty-state"><strong>No matching changes</strong><span>Your selections are kept when you change filters.</span>
      <button class="btn" onclick={() => ((view.query = ""), (view.filter = "all"))}>Reset filters</button>
    </div>
  {:else}
    <CategoryGrid>
      {#each tweakCategories as category (category.id)}
        {@const rows = shown.filter((tweak) => tweak.category === category.id)}
        {@const pending = rows.filter((tweak) => tweak.state !== "applied")}
        {@const applied = rows.filter((tweak) => tweak.state === "applied")}
        {#if rows.length}
          <CategoryCard id={category.id} title={category.title} count={pending.filter((tweak) => !debloat.skipped.has(tweak.id)).length + " selected"}>
            <div class="option-list">
              {#each pending as tweak (tweak.id)}
                <OptimizationRow title={tweak.title} summary={tweak.summary} state={tweak.state} risk={tweak.risk}
                  recommended={tweak.risk === "safe"} selectable checked={!debloat.skipped.has(tweak.id)}
                  disabled={debloat.locked} onselect={(checked) => debloat.setTweak(tweak.id, checked)} />
              {/each}
            </div>
            {#if applied.length}
              <h4 class="section-label">Already applied · {applied.length}</h4>
              <div class="option-list">
                {#each applied as tweak (tweak.id)}
                  <OptimizationRow title={tweak.title} summary={tweak.summary} state={tweak.state} risk={tweak.risk}>
                    {#snippet actions()}
                      <button class="btn" disabled={debloat.locked} onclick={() => debloat.undo([tweak])}><Undo2 size={13} /> {tweak.canUndo ? "Undo" : "Turn off"}</button>
                    {/snippet}
                  </OptimizationRow>
                {/each}
              </div>
            {/if}
          </CategoryCard>
        {/if}
      {/each}
    </CategoryGrid>
  {/if}
  <section class="overview surface">
    <div class="overview-copy">
      <div class="overview-title"><Package size={17} /><h3>Apps to remove</h3><span class="count">{apps.length} selected</span></div>
      <p>{apps.length ? apps.map((app) => app.title).join(", ") : "No apps selected. Choose apps to include them in this run."}</p>
    </div>
    <button class="btn" onclick={() => (debloat.tab = "apps")}>Choose apps <ArrowRight size={14} /></button>
  </section>
  <ActionBar title={planned + " change" + (planned === 1 ? "" : "s") + " selected · " + apps.length + " app" + (apps.length === 1 ? "" : "s") + " to remove"}
    detail={planned || apps.length ? "Review your selection next. A restore point comes before the changes." : "Select pending changes or apps to get started."}>
    <button class="btn primary" disabled={debloat.locked || !debloat.status || (!planned && !apps.length)} onclick={() => debloat.debloat()}>
      {#if debloat.busy}<LoaderCircle size={15} class="spin" /> Working…{:else}<Sparkles size={15} /> Apply selected{/if}
    </button>
  </ActionBar>
</div>

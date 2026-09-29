<script lang="ts">
  // Store apps to remove: only installed ones MYLE knows are safe to remove.
  import Search from "@lucide/svelte/icons/search";
  import Store from "@lucide/svelte/icons/store";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { AppGroup } from "./api";
  import Progress from "./Progress.svelte";
  import { debloat } from "./state.svelte";

  let query = $state("");

  const groups: { id: AppGroup; title: string; note?: string }[] = [
    { id: "microsoft", title: "Microsoft" },
    { id: "bing", title: "Bing" },
    { id: "xbox", title: "Xbox", note: "Some games need these: none is chosen for you." },
    { id: "thirdParty", title: "Other apps Windows installed" },
  ];

  const shown = $derived(
    debloat.installedApps.filter((app) => app.title.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const chosen = $derived(debloat.chosenApps);
  const removed = $derived((debloat.status?.apps ?? []).filter((app) => app.removedByMyle && !app.packages.length));
</script>

<div class="apps">
  <div class="toolbar">
    <label class="search">
      <Search size={14} />
      <input placeholder="Search apps" bind:value={query} spellcheck="false" />
    </label>
    <button class="btn small" disabled={debloat.busy} onclick={() => debloat.selectApps("recommended")}>Select recommended</button>
    <button class="btn small" disabled={debloat.busy} onclick={() => debloat.selectApps("all")}>All</button>
    <button class="btn small" disabled={debloat.busy} onclick={() => debloat.selectApps("none")}>None</button>
    <span class="spacer"></span>
    <button class="btn danger" disabled={debloat.locked || !chosen.length} onclick={() => debloat.removeApps(chosen)}>
      <Trash2 size={14} /> Remove {chosen.length || ""} app{chosen.length === 1 ? "" : "s"}
    </button>
  </div>

  <Progress />

  <p class="note">
    Only installed apps MYLE knows are safe to remove are listed. The Store, Terminal, WebView2, Xbox sign-in, codecs and
    anything else Windows needs are never offered. Removing works for every user of this PC and for new ones.
  </p>

  <div class="grid">
    {#each groups as group (group.id)}
      {@const items = shown.filter((app) => app.group === group.id)}
      {#if items.length}
        <section class="group surface">
          <header>
            <h3>{group.title}</h3>
            <span>{items.filter((app) => debloat.isAppChosen(app.id)).length} of {items.length}</span>
          </header>
          {#if group.note}<p class="group-note">{group.note}</p>{/if}
          <ul>
            {#each items as app (app.id)}
              <li>
                <label>
                  <input
                    type="checkbox"
                    class="check"
                    checked={debloat.isAppChosen(app.id)}
                    disabled={debloat.busy}
                    onchange={(event) => debloat.setApp(app.id, event.currentTarget.checked)}
                  />
                  <span>{app.title}</span>
                  {#if app.recommended}<span class="tag">Recommended</span>{/if}
                </label>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>

  {#if !debloat.installedApps.length && debloat.status}
    <p class="empty surface">None of the apps on MYLE's list is installed. Nothing to remove.</p>
  {/if}

  {#if removed.length}
    <section class="group surface">
      <header><h3>Removed by MYLE</h3><span>{removed.length}</span></header>
      <ul class="removed">
        {#each removed as app (app.id)}
          <li>
            <span>{app.title}</span>
            <button class="btn small" onclick={() => debloat.openStore(app)}><Store size={12} /> Get it again</button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .apps {
    display: grid;
    gap: 14px;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: min(100%, 260px);
    height: 34px;
    padding: 0 11px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 9px;
    background: rgb(0 0 0 / 0.2);
    color: var(--text-3);
  }

  .search:focus-within {
    border-color: rgb(var(--accent-rgb) / 0.55);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: none;
    color: var(--text-1);
    font: inherit;
    font-size: 12.5px;
  }

  .spacer {
    flex: 1;
  }

  .note,
  .group-note {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.45;
  }

  .group-note {
    margin: -2px 0 6px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    align-items: start;
    gap: 14px;
  }

  .group {
    padding: 12px 14px;
  }

  .group header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding-bottom: 6px;
  }

  .group h3 {
    font-size: 13px;
    font-weight: 650;
  }

  .group header span {
    color: var(--text-3);
    font-size: 11px;
  }

  ul {
    display: grid;
    gap: 1px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li label {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 4px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12.5px;
  }

  li label:hover {
    background: var(--hover);
  }

  li label span:first-of-type {
    flex: 1;
    min-width: 0;
  }

  .tag {
    padding: 1px 7px;
    border: 1px solid rgb(var(--accent-rgb) / 0.22);
    border-radius: 999px;
    color: rgb(190 198 255 / 0.85);
    font-size: 9.5px;
    font-weight: 600;
  }

  .removed {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    column-gap: 18px;
  }

  .removed li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 5px 4px;
    font-size: 12.5px;
  }

  .empty {
    padding: 16px;
    color: var(--text-2);
    font-size: 12px;
    text-align: center;
  }
</style>

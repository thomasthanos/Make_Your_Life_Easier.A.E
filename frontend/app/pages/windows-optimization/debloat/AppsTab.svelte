<script lang="ts">
  // Store apps to remove: only installed ones MYLE knows are safe to remove.
  import Package from "@lucide/svelte/icons/package";
  import Search from "@lucide/svelte/icons/search";
  import Store from "@lucide/svelte/icons/store";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { AppGroup, AppStatus } from "./api";
  import Progress from "./Progress.svelte";
  import { debloat } from "./state.svelte";

  let query = $state("");

  interface GroupDef {
    id: AppGroup;
    title: string;
    note?: string;
  }

  interface PopulatedGroup extends GroupDef {
    items: AppStatus[];
  }

  const groups: GroupDef[] = [
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

  const populatedGroups = $derived<PopulatedGroup[]>(
    groups
      .map((g) => ({ ...g, items: shown.filter((app) => app.group === g.id) }))
      .filter((g) => g.items.length > 0),
  );

  // Split into primary (large, e.g. Microsoft) and secondary (stacked on the right)
  // so small 1-2 item groups never sit next to a 14-item list with huge empty space below.
  const mainGroups = $derived(populatedGroups.filter((g) => g.items.length > 4));
  const sideGroups = $derived(populatedGroups.filter((g) => g.items.length <= 4));
</script>

<div class="apps">
  <div class="top-bar surface">
    <div class="toolbar">
      <label class="search">
        <Search size={14} />
        <input placeholder="Search installed apps…" bind:value={query} spellcheck="false" />
      </label>
      <div class="quick-actions">
        <button class="btn small" disabled={debloat.busy} onclick={() => debloat.selectApps("recommended")}>Select recommended</button>
        <button class="btn small" disabled={debloat.busy} onclick={() => debloat.selectApps("all")}>All</button>
        <button class="btn small" disabled={debloat.busy} onclick={() => debloat.selectApps("none")}>None</button>
      </div>
      <span class="spacer"></span>
      <button class="btn danger remove-btn" disabled={debloat.locked || !chosen.length} onclick={() => debloat.removeApps(chosen)}>
        <Trash2 size={14} /> Remove {chosen.length || ""} app{chosen.length === 1 ? "" : "s"}
      </button>
    </div>
    <p class="note">
      Only installed apps MYLE knows are safe to remove are listed. The Store, Terminal, WebView2, Xbox sign-in, codecs and
      anything else Windows needs are never offered. Removing works for every user of this PC and for new ones.
    </p>
  </div>

  <Progress />

  {#if populatedGroups.length}
    <div class="layout" class:single={!mainGroups.length || !sideGroups.length}>
      {#if mainGroups.length}
        <div class="col">
          {#each mainGroups as group (group.id)}
            <section class="group surface">
              <header>
                <div class="group-title">
                  <span class="group-icon"><Package size={14} /></span>
                  <h3>{group.title}</h3>
                </div>
                <span class="group-count">{group.items.filter((app) => debloat.isAppChosen(app.id)).length} of {group.items.length} selected</span>
              </header>
              {#if group.note}<p class="group-note">{group.note}</p>{/if}
              <ul class="multi-grid">
                {#each group.items as app (app.id)}
                  {@const checked = debloat.isAppChosen(app.id)}
                  <li class:checked>
                    <label>
                      <input
                        type="checkbox"
                        class="check"
                        {checked}
                        disabled={debloat.busy}
                        onchange={(event) => debloat.setApp(app.id, event.currentTarget.checked)}
                      />
                      <span class="app-name">{app.title}</span>
                      {#if app.recommended}<span class="tag-rec">Recommended</span>{/if}
                    </label>
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      {/if}

      {#if sideGroups.length}
        <div class="col">
          {#each sideGroups as group (group.id)}
            <section class="group surface">
              <header>
                <div class="group-title">
                  <span class="group-icon"><Package size={14} /></span>
                  <h3>{group.title}</h3>
                </div>
                <span class="group-count">{group.items.filter((app) => debloat.isAppChosen(app.id)).length} of {group.items.length} selected</span>
              </header>
              {#if group.note}<p class="group-note">{group.note}</p>{/if}
              <ul>
                {#each group.items as app (app.id)}
                  {@const checked = debloat.isAppChosen(app.id)}
                  <li class:checked>
                    <label>
                      <input
                        type="checkbox"
                        class="check"
                        {checked}
                        disabled={debloat.busy}
                        onchange={(event) => debloat.setApp(app.id, event.currentTarget.checked)}
                      />
                      <span class="app-name">{app.title}</span>
                      {#if app.recommended}<span class="tag-rec">Recommended</span>{/if}
                    </label>
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if !debloat.installedApps.length && debloat.status}
    <p class="empty surface">None of the apps on MYLE's list is installed. Nothing to remove.</p>
  {/if}

  {#if removed.length}
    <section class="group surface">
      <header>
        <div class="group-title">
          <span class="group-icon"><Store size={14} /></span>
          <h3>Removed by MYLE</h3>
        </div>
        <span class="group-count">{removed.length}</span>
      </header>
      <ul class="removed">
        {#each removed as app (app.id)}
          <li>
            <span class="app-name">{app.title}</span>
            <button class="btn small ghost" onclick={() => debloat.openStore(app)}><Store size={12} /> Get it again</button>
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

  /* ── Top bar ──────────────────────────────────────────────────────────── */

  .top-bar {
    display: grid;
    gap: 10px;
    padding: 14px 16px;
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
    background: rgb(0 0 0 / 0.22);
    color: var(--text-3);
    transition: border-color var(--dur-fast);
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

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .spacer {
    flex: 1;
  }

  .remove-btn {
    white-space: nowrap;
  }

  .note {
    color: var(--text-3);
    font-size: 11.5px;
    line-height: 1.45;
  }

  /* ── 2-column balanced layout ─────────────────────────────────────────── */

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr);
    align-items: start;
    gap: 14px;
  }

  .layout.single {
    grid-template-columns: 1fr;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  /* ── Group card ───────────────────────────────────────────────────────── */

  .group {
    display: grid;
    gap: 10px;
    padding: 14px 16px 16px;
  }

  .group header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgb(255 255 255 / 0.055);
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group-icon {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 1px solid rgb(var(--accent-rgb) / 0.2);
    border-radius: 7px;
    background: rgb(var(--accent-rgb) / 0.08);
    color: rgb(var(--accent-soft-rgb) / 0.85);
  }

  .group h3 {
    font-size: 13.5px;
    font-weight: 650;
  }

  .group-count {
    padding: 2px 9px;
    border: 1px solid rgb(255 255 255 / 0.06);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.025);
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 560;
    white-space: nowrap;
  }

  .group-note {
    padding: 7px 10px;
    border: 1px solid rgb(237 170 73 / 0.14);
    border-radius: 8px;
    background: rgb(237 170 73 / 0.04);
    color: rgb(239 191 111 / 0.85);
    font-size: 11px;
    line-height: 1.4;
  }

  /* ── App tiles ────────────────────────────────────────────────────────── */

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  ul.multi-grid {
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 7px;
  }

  li {
    border: 1px solid rgb(255 255 255 / 0.05);
    border-radius: 9px;
    background: rgb(255 255 255 / 0.018);
    transition: background var(--dur-fast), border-color var(--dur-fast);
  }

  li.checked {
    border-color: rgb(var(--accent-rgb) / 0.22);
    background: rgb(var(--accent-rgb) / 0.05);
  }

  li:hover {
    border-color: rgb(255 255 255 / 0.11);
    background: rgb(255 255 255 / 0.038);
  }

  li label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
    font-size: 12.5px;
  }

  .app-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-rec {
    flex: none;
    padding: 2px 7px;
    border: 1px solid rgb(var(--accent-rgb) / 0.2);
    border-radius: 999px;
    background: rgb(var(--accent-rgb) / 0.07);
    color: rgb(var(--accent-soft-rgb) / 0.88);
    font-size: 9.5px;
    font-weight: 600;
  }

  /* ── Removed section ──────────────────────────────────────────────────── */

  .removed {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 7px;
  }

  .removed li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 10px;
    font-size: 12.5px;
  }

  .ghost {
    background: transparent;
    border-color: rgb(255 255 255 / 0.08);
    color: var(--text-2);
  }

  .ghost:hover:not(:disabled) {
    background: rgb(255 255 255 / 0.06);
    border-color: rgb(255 255 255 / 0.12);
  }

  /* ── Empty ────────────────────────────────────────────────────────────── */

  .empty {
    padding: 20px;
    color: var(--text-2);
    font-size: 12.5px;
    text-align: center;
  }

  /* ── Responsive ───────────────────────────────────────────────────────── */

  @media (max-width: 920px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .toolbar {
      gap: 10px;
    }

    .search {
      width: 100%;
    }

    .quick-actions {
      width: 100%;
    }

    .spacer {
      display: none;
    }

    .remove-btn {
      width: 100%;
    }
  }
</style>

<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import DatabaseZap from "@lucide/svelte/icons/database-zap";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ScanSearch from "@lucide/svelte/icons/scan-search";
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import type { OperationStage } from "./api";
  import { formatBytes, gameSavesState as gameSaves, type GameSavesFilter } from "./state.svelte";

  const stageLabels: Record<OperationStage, string> = {
    preparing: "Preparing…",
    scanning: "Scanning save locations…",
    updatingDatabase: "Updating the game database…",
    creatingSafetyBackup: "Creating a safety backup…",
    backingUp: "Backing up saves…",
    restoring: "Restoring saves…",
    finishing: "Finishing…",
  };
  const progress = $derived(
    gameSaves.operation?.total
      ? Math.max(0, Math.min(100, (gameSaves.operation.done / gameSaves.operation.total) * 100))
      : null,
  );

  /** After this long the engine is still at it: say why that can happen. */
  const SLOW_AFTER_S = 20;

  // The engine reports nothing while it scans or copies, so show that time
  // passes: seconds so far, and a hint once it gets slow.
  let startedAt = $state(0);
  let now = $state(0);
  $effect(() => {
    const operation = gameSaves.operation;
    if (!operation) return;
    startedAt = Date.now();
    now = startedAt;
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });
  const elapsed = $derived(Math.max(0, Math.round((now - startedAt) / 1000)));

  function formatElapsed(seconds: number) {
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
  }
</script>

<div class="toolbar surface">
  <div class="main-row">
    <label class="search">
      <Search size={15} />
      <input
        class="input"
        type="search"
        value={gameSaves.query}
        placeholder="Search games…"
        autocomplete="off"
        spellcheck="false"
        oninput={(event) => gameSaves.setQuery(event.currentTarget.value)}
      />
      {#if gameSaves.query}
        <button class="clear icon-btn" aria-label="Clear search" onclick={() => gameSaves.setQuery("")}><X size={13} /></button>
      {/if}
    </label>

    <label class="filter">
      <span class="sr-only">Status filter</span>
      <select value={gameSaves.filter} onchange={(event) => gameSaves.setFilter(event.currentTarget.value as GameSavesFilter)}>
        <option value="all">All statuses</option>
        <option value="changed">Changed since backup</option>
        <option value="notBackedUp">Not backed up</option>
        <option value="backedUp">Backed up</option>
        <option value="problems">Needs attention</option>
      </select>
    </label>

    <span class="spacer"></span>

    <button class="btn" disabled={gameSaves.busy} onclick={() => gameSaves.scan()}>
      <ScanSearch size={15} /> Scan again
    </button>
    <button class="btn" disabled={gameSaves.busy} onclick={() => gameSaves.updateDatabase()}>
      <DatabaseZap size={15} /> Update database
    </button>
  </div>

  <div class="action-row">
    <span class="shown">{gameSaves.visibleGames.length} {gameSaves.visibleGames.length === 1 ? "game" : "games"}</span>
    {#if gameSaves.discovering}
      <span class="discovering" title="A full scan runs in the background; actions stop it first.">
        <LoaderCircle size={12} class="spin" /> Looking for new games…
      </span>
    {/if}
    <button class="btn ghost" disabled={!gameSaves.visibleGames.length || gameSaves.busy} onclick={() => gameSaves.toggleAllVisible()}>
      <CheckCheck size={14} /> {gameSaves.allVisibleSelected ? "Deselect shown" : "Select all shown"}
    </button>
    {#if gameSaves.selectedGames.length}
      <button class="btn ghost" disabled={gameSaves.busy} onclick={() => gameSaves.clearSelection()}>Clear</button>
    {/if}
    <span class="selection" aria-live="polite">
      {gameSaves.selectedGames.length} selected{gameSaves.selectedGames.length ? ` · ${formatBytes(gameSaves.selectedBytes)}` : ""}
    </span>
    <span class="spacer"></span>
    {#if gameSaves.tab === "pc"}
      <button class="btn primary action" disabled={!gameSaves.selectedGames.length || gameSaves.busy} onclick={() => gameSaves.backupSelected()}>
        <Archive size={15} /> Back up ({gameSaves.selectedGames.length})
      </button>
    {:else}
      <button class="btn primary action" disabled={!gameSaves.selectedGames.length || gameSaves.busy} onclick={() => gameSaves.openRestorePicker()}>
        <RotateCcw size={15} /> Restore ({gameSaves.selectedGames.length})
      </button>
    {/if}
  </div>

  {#if gameSaves.operation}
    <div class="operation" aria-live="polite">
      <LoaderCircle size={14} class="spin" />
      <span class="operation-text">
        <strong>{stageLabels[gameSaves.operation.stage]}</strong>
        {#if gameSaves.operation.current}<small>{gameSaves.operation.current}</small>{/if}
        {#if gameSaves.operation.note}<small>{gameSaves.operation.note}</small>{/if}
        {#if elapsed >= SLOW_AFTER_S && !gameSaves.operation.total}
          <small class="slow">
            Still working. Many games, or saves in OneDrive that are online-only (they download first), make this take
            longer.
          </small>
        {/if}
      </span>
      {#if gameSaves.operation.total}
        <span class="numbers">{gameSaves.operation.done}/{gameSaves.operation.total}</span>
      {/if}
      {#if elapsed >= 2}
        <span class="numbers">{formatElapsed(elapsed)}</span>
      {/if}
      <button class="btn small" disabled={gameSaves.cancelling} onclick={() => gameSaves.cancel()}>
        {gameSaves.cancelling ? "Cancelling…" : "Cancel"}
      </button>
      <span class="progress" class:indeterminate={progress === null} aria-hidden="true">
        <span style:width={progress === null ? undefined : `${progress}%`}></span>
      </span>
    </div>
  {/if}
</div>

<style>
  .toolbar {
    display: grid;
    gap: 9px;
    margin-bottom: 10px;
    padding: 9px;
    position: sticky;
    top: -18px;
    z-index: 18;
    background: linear-gradient(180deg, rgb(27 32 47 / 0.96), rgb(16 20 31 / 0.97));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.055), 0 14px 26px -22px rgb(0 0 0 / 0.94);
  }

  .main-row,
  .action-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }

  .search {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 230px;
    min-width: 160px;
  }

  .search > :global(svg) {
    position: absolute;
    left: 11px;
    z-index: 1;
    color: var(--text-3);
    pointer-events: none;
  }

  .search .input {
    width: 100%;
    padding-right: 31px;
    padding-left: 33px;
  }

  .search input::-webkit-search-cancel-button {
    display: none;
  }

  .clear {
    position: absolute;
    right: 3px;
    width: 28px;
    height: 28px;
  }

  select {
    height: 34px;
    padding: 0 28px 0 10px;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 10px;
    background: rgb(9 12 20 / 0.7);
    color: var(--text-2);
    font: inherit;
    font-size: 12px;
  }

  .spacer {
    flex: 1;
  }

  .shown,
  .selection {
    color: var(--text-3);
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }

  .selection {
    padding-left: 8px;
    border-left: 1px solid rgb(255 255 255 / 0.07);
  }

  .discovering {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: rgb(166 176 255 / 0.75);
    font-size: 11px;
  }

  .action {
    min-width: 126px;
  }

  .operation {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 7px 8px 9px;
    border-radius: 9px;
    background: rgb(139 151 255 / 0.045);
    color: var(--accent);
  }

  .operation-text {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .operation-text strong {
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .operation-text small {
    overflow: hidden;
    color: var(--text-3);
    font-size: 10.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .numbers {
    margin-left: auto;
    color: var(--text-2);
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }

  .progress {
    position: absolute;
    right: 8px;
    bottom: 3px;
    left: 8px;
    height: 2px;
    overflow: hidden;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.06);
  }

  .numbers + .numbers {
    margin-left: 0;
  }

  .operation-text small.slow {
    color: rgb(245 188 95 / 0.8);
    white-space: normal;
  }

  .progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent-grad);
    transition: width var(--dur-med) var(--ease-out);
  }

  /* The engine gives no count while it scans: a moving band, not a bar
     frozen at zero. */
  .progress.indeterminate > span {
    width: 30%;
    animation: sweep 1.3s var(--ease-in-out) infinite;
  }

  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(340%);
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  button:disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  @media (max-width: 720px) {
    .toolbar {
      position: relative;
      top: auto;
    }

    .main-row .spacer {
      display: none;
    }

    .operation-text small {
      display: none;
    }
  }
</style>

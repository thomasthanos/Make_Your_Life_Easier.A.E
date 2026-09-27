<script lang="ts">
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Select, { type SelectOption } from "../../../lib/components/Select.svelte";
  import type { GameSaveEntry, GameSaveStatus, GameSavesTab } from "./api";
  import { formatBytes, formatDate, gameSavesState as state } from "./state.svelte";

  let { game, tab }: { game: GameSaveEntry; tab: GameSavesTab } = $props();
  const uid = $props.id();
  const selected = $derived(state.isSelected(game));
  const snapshotId = $derived(state.snapshotFor(game));
  const snapshotOptions = $derived<SelectOption<string>[]>(
    game.snapshots.map((snapshot) => ({
      value: snapshot.id,
      label: `${formatDate(snapshot.timestamp)}${snapshot.label ? ` · ${snapshot.label}` : ""}${snapshot.isSafety ? " · Safety" : ""}`,
    })),
  );

  const statusInfo: Record<GameSaveStatus, { label: string; tone: string }> = {
    notBackedUp: { label: "Not backed up", tone: "warning" },
    backedUp: { label: "Backed up", tone: "success" },
    changedSinceBackup: { label: "Changed since backup", tone: "changed" },
    backupOnly: { label: "Backup only", tone: "neutral" },
    needsLocation: { label: "Choose restore location", tone: "warning" },
    unknown: { label: "Unknown", tone: "neutral" },
    error: { label: "Needs attention", tone: "danger" },
  };
</script>

<article class="card surface" class:selected class:problem={game.status === "error"}>
  <input
    id="{uid}-check"
    class="check"
    type="checkbox"
    checked={selected}
    disabled={state.busy}
    aria-label={`Select ${game.title}`}
    onchange={() => state.toggleSelected(game)}
  />

  <label class="identity" for="{uid}-check">
    <span class="game-icon" aria-hidden="true"><HardDrive size={19} strokeWidth={1.65} /></span>
    <span class="title-wrap">
      <span class="title">{game.title}</span>
      <span class="badges">
        <span class="status {statusInfo[game.status].tone}">{statusInfo[game.status].label}</span>
        {#each game.platformBadges as badge (badge)}
          <span class="platform">{badge}</span>
        {/each}
      </span>
    </span>
  </label>

  <div class="facts" aria-label={`Save details for ${game.title}`}>
    <span><strong>{game.fileCount.toLocaleString()}</strong> {game.fileCount === 1 ? "file" : "files"}</span>
    <span><strong>{formatBytes(game.totalBytes)}</strong></span>
    <span title={formatDate(game.lastSaveAt)}>Last save <strong>{formatDate(game.lastSaveAt)}</strong></span>
    <span title={formatDate(game.lastBackupAt)}>Backup <strong>{formatDate(game.lastBackupAt)}</strong></span>
  </div>

  <div class="path-row">
    <span class="path selectable" title={game.paths.join("\n")}>
      {game.paths[0] ?? "No local path available"}
      {#if game.paths.length > 1}<span class="more-paths">+{game.paths.length - 1}</span>{/if}
    </span>
    {#if game.error}
      <span class="error" title={game.error}><TriangleAlert size={13} /> {game.error}</span>
    {/if}
  </div>

  <div class="actions">
    {#if tab === "backup" && game.snapshots.length}
      <div class="snapshot">
        <span>Snapshot</span>
        <Select
          value={snapshotId}
          options={snapshotOptions}
          ariaLabel={`Snapshot for ${game.title}`}
          size="sm"
          minWidth="156px"
          disabled={state.busy}
          onchange={(id) => state.setSnapshot(game.id, id)}
        />
      </div>
    {/if}

    <label class="auto" title="Include this game in scheduled backups">
      <span>Auto</span>
      <input
        class="switch"
        type="checkbox"
        checked={game.autoBackup}
        disabled={state.busy || !game.hasLocalData}
        aria-label={`Automatic backup for ${game.title}`}
        onchange={(event) => state.setAutoBackup(game, event.currentTarget.checked)}
      />
    </label>
    <button
      class="icon-btn"
      disabled={!game.paths.length}
      title="Open save folder"
      aria-label={`Open save folder for ${game.title}`}
      onclick={() => state.openGameFolder(game)}
    >
      <FolderOpen size={16} />
    </button>
  </div>
</article>

<style>
  .card {
    container-type: inline-size;
    display: grid;
    grid-template-columns: auto minmax(180px, 1.15fr) minmax(360px, 1.35fr) auto;
    grid-template-areas:
      "check identity facts actions"
      ". path path actions";
    align-items: center;
    gap: 8px 12px;
    min-width: 0;
    padding: 13px 14px;
    transition:
      border-color var(--dur-fast),
      background var(--dur-fast);
  }

  .card:hover {
    border-color: rgb(255 255 255 / 0.11);
  }

  .card.selected {
    border-color: rgb(var(--accent-rgb) / 0.34);
    background: linear-gradient(180deg, rgb(var(--accent-rgb) / 0.085), rgb(var(--accent-rgb) / 0.025));
  }

  .card.problem {
    border-color: rgb(229 72 77 / 0.2);
  }

  .check {
    grid-area: check;
  }

  .identity {
    grid-area: identity;
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .game-icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: none;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 11px;
    background: linear-gradient(145deg, rgb(var(--accent-rgb) / 0.14), rgb(79 209 232 / 0.045));
    color: rgb(175 184 255 / 0.86);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
  }

  .title-wrap {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .title {
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .status,
  .platform {
    display: inline-flex;
    align-items: center;
    min-height: 18px;
    padding: 1px 7px;
    border: 1px solid rgb(255 255 255 / 0.055);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.02);
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }

  .status.success {
    border-color: rgb(62 207 142 / 0.12);
    background: rgb(62 207 142 / 0.04);
    color: rgb(92 218 166 / 0.78);
  }

  .status.warning {
    border-color: rgb(245 176 65 / 0.15);
    background: rgb(245 176 65 / 0.045);
    color: rgb(245 188 95 / 0.82);
  }

  .status.changed {
    border-color: rgb(77 163 255 / 0.14);
    background: rgb(77 163 255 / 0.045);
    color: rgb(112 183 255 / 0.82);
  }

  .status.danger {
    border-color: rgb(229 72 77 / 0.18);
    background: rgb(229 72 77 / 0.045);
    color: rgb(255 145 145 / 0.84);
  }

  .platform {
    font-weight: 500;
  }

  .facts {
    grid-area: facts;
    display: grid;
    grid-template-columns: repeat(2, minmax(112px, 1fr));
    gap: 4px 16px;
    min-width: 0;
    color: var(--text-3);
    font-size: 11.5px;
  }

  .facts span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .facts strong {
    color: var(--text-2);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .path-row {
    grid-area: path;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .path {
    min-width: 0;
    overflow: hidden;
    color: rgb(200 210 240 / 0.38);
    font-family: var(--font-mono);
    font-size: 10.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .more-paths {
    margin-left: 6px;
    color: var(--accent);
  }

  .error {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 240px;
    overflow: hidden;
    color: rgb(255 145 145 / 0.76);
    font-size: 11px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .actions {
    grid-area: actions;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    align-self: stretch;
  }

  .auto {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--text-3);
    font-size: 11px;
  }

  .snapshot {
    display: grid;
    gap: 3px;
    color: var(--text-3);
    font-size: 10.5px;
  }

  button:disabled {
    opacity: 0.35;
    pointer-events: none;
  }

  @container (max-width: 860px) {
    .card {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        "check identity actions"
        ". facts actions"
        ". path path";
    }
  }

  @container (max-width: 560px) {
    .card {
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas:
        "check identity"
        ". facts"
        ". path"
        ". actions";
    }

    .facts {
      grid-template-columns: 1fr;
    }

    .actions {
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }
</style>


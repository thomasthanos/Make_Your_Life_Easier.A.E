<script lang="ts">
  import CalendarClock from "@lucide/svelte/icons/calendar-clock";
  import Cloud from "@lucide/svelte/icons/cloud";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FolderSearch from "@lucide/svelte/icons/folder-search";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { BackupSchedule, RootStore, ScheduleWeekday } from "./api";
  import { formatDate, gameSavesState as gs } from "./state.svelte";

  const storeOptions: { id: RootStore; label: string }[] = [
    { id: "steam", label: "Steam" },
    { id: "epic", label: "Epic Games" },
    { id: "gog", label: "GOG" },
    { id: "gogGalaxy", label: "GOG Galaxy" },
    { id: "uplay", label: "Ubisoft Connect" },
    { id: "origin", label: "EA app / Origin" },
    { id: "otherWindows", label: "Other folder" },
  ];
  const weekdays: { id: ScheduleWeekday; label: string }[] = [
    { id: "monday", label: "Monday" },
    { id: "tuesday", label: "Tuesday" },
    { id: "wednesday", label: "Wednesday" },
    { id: "thursday", label: "Thursday" },
    { id: "friday", label: "Friday" },
    { id: "saturday", label: "Saturday" },
    { id: "sunday", label: "Sunday" },
  ];
  const storeLabel = (store: RootStore) => storeOptions.find((item) => item.id === store)?.label ?? store;
  let newRootStore = $state<RootStore>("steam");
  const scheduledFailure = $derived(
    gs.page.settings.lastScheduledResult?.error ??
      (gs.page.settings.lastScheduledResult?.failedGames.length
        ? `Failed: ${gs.page.settings.lastScheduledResult.failedGames.join(", ")}`
        : null),
  );
  const lastAttemptFailed = $derived(
    scheduledFailure !== null ||
      (gs.page.settings.lastScheduledAttempt !== null &&
        (gs.page.settings.lastScheduledSuccess === null ||
          gs.page.settings.lastScheduledAttempt > gs.page.settings.lastScheduledSuccess)),
  );

  /** Saves the schedule, then shows what was actually stored: a refused
   *  change (or one skipped while busy) must not stay visible in the control. */
  async function changeSchedule(
    control: HTMLInputElement | HTMLSelectElement,
    stored: () => string,
    schedule: BackupSchedule,
    time = gs.page.settings.scheduleTime,
    weekday = gs.page.settings.scheduleWeekday,
  ) {
    await gs.setSchedule(schedule, time, weekday);
    control.value = stored();
  }
</script>

<section id="game-saves-settings" class="settings" aria-label="Backup settings">
  <article class="setting-card surface">
    <div class="card-head">
      <span class="card-icon"><Cloud size={17} /></span>
      <span>
        <h2>Backup folder</h2>
        <p>Use a cloud-synced folder for an off-PC copy.</p>
      </span>
    </div>

    <div class="path selectable" class:empty={!gs.page.settings.backupFolder} title={gs.page.settings.backupFolder ?? ""}>
      {gs.page.settings.backupFolder ?? "No backup folder selected"}
    </div>

    <div class="button-row">
      <button class="btn" disabled={!!gs.settingsBusy || gs.busy} onclick={() => gs.chooseBackupFolder()}>
        <FolderSearch size={15} /> Choose folder
      </button>
      <button
        class="btn ghost"
        disabled={!gs.page.settings.backupFolder}
        onclick={() => gs.openBackupFolder()}
      >
        <FolderOpen size={15} /> Open
      </button>
    </div>

    <div class="clouds">
      <span class="sub-label">Cloud folders</span>
      {#if gs.page.cloudFolders.length}
        <div class="cloud-list">
          {#each gs.page.cloudFolders as folder (`${folder.provider}:${folder.path}`)}
            <button
              class="cloud-chip"
              title={`${folder.provider}: ${folder.path}`}
              disabled={!!gs.settingsBusy || gs.busy}
              onclick={() => gs.useDetectedBackupFolder(folder.path)}
            >
              <Cloud size={12} /> {folder.provider}
            </button>
          {/each}
        </div>
      {:else}
        <button class="link" disabled={!!gs.settingsBusy || gs.busy} onclick={() => gs.detectCloudFolders()}>
          Detect cloud folders
        </button>
      {/if}
    </div>
  </article>

  <article class="setting-card surface">
    <div class="card-head">
      <span class="card-icon"><CalendarClock size={17} /></span>
      <span>
        <h2>Automatic backup</h2>
        <p>Back up changed saves on a schedule.</p>
      </span>
    </div>

    <label class="field">
      <span>Frequency</span>
      <select
        value={gs.page.settings.schedule}
        disabled={!!gs.settingsBusy || gs.busy}
        onchange={(event) =>
          changeSchedule(event.currentTarget, () => gs.page.settings.schedule, event.currentTarget.value as BackupSchedule)}
      >
        <option value="off">Off</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>
    </label>

    {#if gs.page.settings.schedule !== "off"}
      <div class="schedule-fields">
        {#if gs.page.settings.schedule === "weekly"}
          <label class="field compact">
            <span>Day</span>
            <select
              value={gs.page.settings.scheduleWeekday}
              disabled={!!gs.settingsBusy || gs.busy}
              onchange={(event) =>
                changeSchedule(
                  event.currentTarget,
                  () => gs.page.settings.scheduleWeekday,
                  gs.page.settings.schedule,
                  gs.page.settings.scheduleTime,
                  event.currentTarget.value as ScheduleWeekday,
                )}
            >
              {#each weekdays as day (day.id)}<option value={day.id}>{day.label}</option>{/each}
            </select>
          </label>
        {/if}
        <label class="field compact">
          <span>Time</span>
          <input
            class="input time"
            type="time"
            value={gs.page.settings.scheduleTime}
            disabled={!!gs.settingsBusy || gs.busy}
            onchange={(event) =>
              changeSchedule(
                event.currentTarget,
                () => gs.page.settings.scheduleTime,
                gs.page.settings.schedule,
                event.currentTarget.value,
                gs.page.settings.scheduleWeekday,
              )}
          />
        </label>
      </div>
    {/if}

    <div class="last-run">
      <span class="sub-label">{lastAttemptFailed ? "Last attempt failed" : "Last automatic backup"}</span>
      <strong class:failed={lastAttemptFailed}>
        {formatDate(lastAttemptFailed ? gs.page.settings.lastScheduledAttempt : gs.page.settings.lastScheduledSuccess)}
      </strong>
      {#if scheduledFailure}<small title={scheduledFailure}>{scheduledFailure}</small>{/if}
    </div>

    <button
      class="btn full"
      disabled={gs.busy || !gs.page.settings.backupFolder}
      onclick={() => gs.backupChanged()}
    >
      Back up new and changed saves now
    </button>
  </article>

  <article class="setting-card surface wide">
    <div class="card-head">
      <span class="card-icon"><FolderSearch size={17} /></span>
      <span>
        <h2>Game install folders</h2>
        <p>Known launchers are detected automatically; add unusual locations below.</p>
      </span>
      <button
        class="icon-btn refresh"
        title="Detect launcher folders again"
        aria-label="Detect launcher folders again"
        disabled={!!gs.settingsBusy || gs.busy}
        onclick={() => gs.refreshRoots()}
      >
        <RefreshCw size={15} class={gs.settingsBusy === "roots" ? "spin" : ""} />
      </button>
    </div>

    <div class="root-list">
      {#each gs.page.settings.roots as root (root.id)}
        <div class="root">
          <span class="root-store">{storeLabel(root.store)}</span>
          <span class="root-path selectable" title={root.path}>{root.path}</span>
          <span class="source">{root.source}</span>
          {#if root.source === "manual"}
            <button
              class="remove icon-btn"
              title="Remove folder"
              aria-label={`Remove ${root.path}`}
              disabled={!!gs.settingsBusy || gs.busy}
              onclick={() => gs.removeRoot(root.id)}
            ><Trash2 size={14} /></button>
          {/if}
        </div>
      {:else}
        <p class="empty">No launcher folders detected yet.</p>
      {/each}
    </div>

    <div class="add-root">
      <select bind:value={newRootStore} aria-label="Launcher for new folder">
        {#each storeOptions as store (store.id)}<option value={store.id}>{store.label}</option>{/each}
      </select>
      <button class="btn" disabled={!!gs.settingsBusy || gs.busy} onclick={() => gs.addRoot(newRootStore)}>
        <Plus size={15} /> Add folder
      </button>
      <button class="btn ghost custom-add" disabled={!!gs.settingsBusy || gs.busy} onclick={() => gs.openCustomDialog()}>
        <Plus size={15} /> Add custom game
      </button>
    </div>

    {#if gs.page.settings.customGames.length}
      <div class="custom-games">
        <span class="sub-label">Added by you</span>
        {#each gs.page.settings.customGames as game (game.id)}
          <div class="custom-game">
            <span>
              <strong>{game.name}</strong>
              <small class="selectable" title={game.paths.join("\n")}>{game.paths.join(" · ")}</small>
            </span>
            <button class="icon-btn" title="Edit custom game" aria-label={`Edit ${game.name}`} onclick={() => gs.openCustomDialog(game)}>
              <Pencil size={14} />
            </button>
            <button class="icon-btn remove" title="Remove custom game" aria-label={`Remove ${game.name}`} onclick={() => gs.removeCustomGame(game.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </article>
</section>

<style>
  .settings {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
    gap: 10px;
    margin: -10px 0 20px;
  }

  .setting-card {
    display: flex;
    flex-direction: column;
    gap: 13px;
    min-width: 0;
    padding: 15px;
  }

  .wide {
    grid-column: span 2;
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }

  .card-icon {
    display: grid;
    place-items: center;
    width: 31px;
    height: 31px;
    flex: none;
    border: 1px solid rgb(139 151 255 / 0.15);
    border-radius: 9px;
    background: rgb(139 151 255 / 0.07);
    color: rgb(169 179 255 / 0.86);
  }

  h2 {
    font-size: 13.5px;
  }

  p {
    margin-top: 2px;
    color: var(--text-3);
    font-size: 11.5px;
  }

  .refresh {
    margin-left: auto;
  }

  .path {
    overflow: hidden;
    padding: 8px 10px;
    border: 1px solid rgb(255 255 255 / 0.055);
    border-radius: 9px;
    background: rgb(0 0 0 / 0.14);
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: 10.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .path.empty {
    color: var(--text-3);
    font-family: var(--font-sans);
  }

  .button-row,
  .add-root,
  .schedule-fields {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 7px;
  }

  .clouds,
  .last-run,
  .custom-games {
    display: grid;
    gap: 6px;
  }

  .sub-label,
  .field > span {
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.035em;
    text-transform: uppercase;
  }

  .cloud-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .cloud-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: 1px solid rgb(79 209 232 / 0.12);
    border-radius: 999px;
    background: rgb(79 209 232 / 0.035);
    color: rgb(139 210 224 / 0.78);
    font-size: 11px;
  }

  .cloud-chip:hover {
    background: rgb(79 209 232 / 0.075);
  }

  .link {
    justify-self: start;
    color: var(--accent);
    font-size: 11.5px;
  }

  .field {
    display: grid;
    gap: 5px;
  }

  .field:not(.compact) {
    width: 100%;
  }

  select {
    height: 32px;
    min-width: 130px;
    padding: 0 28px 0 9px;
    border: 1px solid rgb(255 255 255 / 0.075);
    border-radius: 9px;
    background: rgb(9 12 20 / 0.72);
    color: var(--text-2);
    font: inherit;
    font-size: 12px;
  }

  .time {
    width: 112px;
  }

  .last-run strong {
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
  }

  .last-run small {
    overflow: hidden;
    color: rgb(255 145 145 / 0.72);
    font-size: 10.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .last-run strong.failed {
    color: rgb(245 188 95 / 0.82);
  }

  .full {
    align-self: flex-start;
  }

  .root-list {
    display: grid;
    gap: 4px;
    max-height: 150px;
    overflow: auto;
  }

  .root {
    display: grid;
    grid-template-columns: 104px minmax(120px, 1fr) auto 28px;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 5px 7px;
    border-radius: 7px;
    background: rgb(255 255 255 / 0.018);
    font-size: 11px;
  }

  .root-store {
    color: var(--text-2);
    font-weight: 500;
  }

  .root-path {
    overflow: hidden;
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: 10px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .source {
    color: var(--text-3);
    font-size: 9.5px;
    text-transform: uppercase;
  }

  .remove {
    color: rgb(255 145 145 / 0.65);
  }

  .empty {
    padding: 7px;
  }

  .custom-add {
    margin-left: auto;
  }

  .custom-game {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 5px;
    padding: 7px 8px;
    border-radius: 8px;
    background: rgb(255 255 255 / 0.018);
  }

  .custom-game > span {
    display: grid;
    min-width: 0;
  }

  .custom-game strong {
    font-size: 11.5px;
  }

  .custom-game small {
    overflow: hidden;
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: 9.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  button:disabled,
  select:disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  @media (max-width: 1080px) {
    .wide {
      grid-column: auto;
    }
  }

  @media (max-width: 720px) {
    .root {
      grid-template-columns: 88px minmax(0, 1fr) 28px;
    }

    .source {
      display: none;
    }

    .custom-add {
      margin-left: 0;
    }
  }
</style>

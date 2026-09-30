<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import Check from "@lucide/svelte/icons/check";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Folder from "@lucide/svelte/icons/folder";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Pin from "@lucide/svelte/icons/pin";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type { StartAlignment, StartAllAppsView, StartLayout } from "./api";
  import { debloat } from "./state.svelte";

  const sm = $derived(debloat.status?.startMenu);

  const alignments: { id: StartAlignment; label: string; hint: string }[] = [
    { id: "left", label: "Left", hint: "Classic corner position" },
    { id: "center", label: "Center", hint: "Windows 11 default" },
  ];

  const layouts: { id: StartLayout; label: string; hint: string }[] = [
    { id: "default", label: "Default", hint: "Balanced pins & items" },
    { id: "morePins", label: "More pins", hint: "Extra row for apps" },
    { id: "moreRecommendations", label: "More recent", hint: "Extra row for files" },
  ];

  const views: { id: StartAllAppsView; label: string; hint: string }[] = [
    { id: "category", label: "Category", hint: "Grouped by topic" },
    { id: "grid", label: "Grid", hint: "Alphabetical tiles" },
    { id: "list", label: "List", hint: "Compact A–Z list" },
  ];

  const folderCatalog: { id: string; label: string; essential?: boolean }[] = [
    { id: "settings", label: "Settings", essential: true },
    { id: "explorer", label: "File Explorer", essential: true },
    { id: "downloads", label: "Downloads", essential: true },
    { id: "documents", label: "Documents" },
    { id: "userProfile", label: "Personal folder" },
    { id: "pictures", label: "Pictures" },
    { id: "music", label: "Music" },
    { id: "videos", label: "Videos" },
    { id: "network", label: "Network" },
  ];

  const pinCatalog: { id: string; label: string; sub: string; essential?: boolean }[] = [
    { id: "explorer", label: "File Explorer", sub: "System", essential: true },
    { id: "settings", label: "Settings", sub: "System", essential: true },
    { id: "store", label: "Microsoft Store", sub: "Store", essential: true },
    { id: "terminal", label: "Terminal", sub: "Developer", essential: true },
    { id: "calculator", label: "Calculator", sub: "Utility", essential: true },
    { id: "notepad", label: "Notepad", sub: "Editor", essential: true },
    { id: "snipping-tool", label: "Snipping Tool", sub: "Capture", essential: true },
    { id: "photos", label: "Photos", sub: "Media" },
    { id: "paint", label: "Paint", sub: "Graphics" },
    { id: "clock", label: "Clock", sub: "Utility" },
    { id: "edge", label: "Microsoft Edge", sub: "Browser" },
    { id: "xbox", label: "Xbox", sub: "Gaming" },
  ];

  const selectedPins = new SvelteSet<string>(
    pinCatalog.filter((item) => item.essential).map((item) => item.id),
  );

  // The folders as last chosen here, until Windows has them: a second click
  // while the first is still being saved builds on it instead of undoing it.
  let folderDraft = $state<string[] | null>(null);
  const folders = $derived(folderDraft ?? sm?.folders ?? []);

  function saveFolders(next: string[]) {
    folderDraft = next;
    void debloat.setStartMenu({ folders: next }).finally(() => {
      if (folderDraft === next) folderDraft = null;
    });
  }

  function toggleFolder(id: string) {
    if (!sm || debloat.locked) return;
    const current = new Set(folders);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    saveFolders(folderCatalog.map((f) => f.id).filter((fId) => current.has(fId)));
  }

  function setFolderPreset(preset: "essential" | "all" | "none") {
    if (!sm || debloat.locked) return;
    saveFolders(
      preset === "all"
        ? folderCatalog.map((f) => f.id)
        : preset === "essential"
          ? folderCatalog.filter((f) => f.essential).map((f) => f.id)
          : [],
    );
  }

  function togglePin(id: string) {
    if (selectedPins.has(id)) selectedPins.delete(id);
    else selectedPins.add(id);
  }

  function selectPins(preset: "essential" | "all" | "none") {
    selectedPins.clear();
    if (preset === "none") return;
    for (const item of pinCatalog) {
      if (preset === "all" || item.essential) selectedPins.add(item.id);
    }
  }
</script>

{#if !sm}
  <div class="empty surface">Loading Start Menu settings…</div>
{:else}
  <div class="columns">
    <div class="col">
      <section class="card surface">
        <header class="card-head">
          <div class="head-title">
            <span class="icon"><LayoutGrid size={15} /></span>
            <div>
              <h2>Layout &amp; View</h2>
              <p>Position, density and default All Apps view for the Windows 11 Start Menu.</p>
            </div>
          </div>
        </header>

        <div class="control-group">
          <div class="control-label">
            <strong>Start &amp; Taskbar alignment</strong>
            <span>Where the Start button and pinned taskbar icons sit on screen.</span>
          </div>
          <div class="segmented cols-2" role="group" aria-label="Start alignment">
            {#each alignments as item (item.id)}
              <button
                type="button"
                class="seg-btn"
                class:active={sm.alignment === item.id}
                disabled={debloat.locked}
                onclick={() => debloat.setStartMenu({ alignment: item.id })}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">
            <strong>Start Menu layout</strong>
            <span>Choose whether to give extra space to pinned apps or recent files.</span>
          </div>
          <div class="segmented cols-3" role="group" aria-label="Start Menu layout">
            {#each layouts as item (item.id)}
              <button
                type="button"
                class="seg-btn"
                class:active={sm.layout === item.id}
                disabled={debloat.locked}
                onclick={() => debloat.setStartMenu({ layout: item.id })}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="control-group">
          <div class="control-label">
            <strong>All Apps view mode</strong>
            <span>Switch between the new Windows 11 Category grid, classic Grid, or A–Z List.</span>
          </div>
          <div class="segmented cols-3" role="group" aria-label="All Apps view mode">
            {#each views as item (item.id)}
              <button
                type="button"
                class="seg-btn"
                class:active={sm.allAppsView === item.id}
                disabled={debloat.locked}
                onclick={() => debloat.setStartMenu({ allAppsView: item.id })}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            {/each}
          </div>
        </div>
      </section>

      <section class="card surface">
        <header class="card-head">
          <div class="head-title">
            <span class="icon"><Folder size={15} /></span>
            <div>
              <h2>Quick Folders Next to Power</h2>
              <p>Folders shown at the bottom-right of Start next to the Power button ({folders.length} / {folderCatalog.length} active).</p>
            </div>
          </div>
          <div class="quick-links">
            <button type="button" class="link" disabled={debloat.locked} onclick={() => setFolderPreset("essential")}>Essential</button>
            <span>·</span>
            <button type="button" class="link" disabled={debloat.locked} onclick={() => setFolderPreset("all")}>All</button>
            <span>·</span>
            <button type="button" class="link" disabled={debloat.locked} onclick={() => setFolderPreset("none")}>None</button>
          </div>
        </header>

        <div class="folder-grid">
          {#each folderCatalog as folder (folder.id)}
            {@const active = folders.includes(folder.id)}
            <button
              type="button"
              class="folder-tile"
              class:active
              disabled={debloat.locked}
              onclick={() => toggleFolder(folder.id)}
            >
              <span class="check-box" aria-hidden="true">
                {#if active}<Check size={11} />{/if}
              </span>
              <span class="folder-name">{folder.label}</span>
            </button>
          {/each}
        </div>
      </section>
    </div>

    <div class="col">
      <section class="card surface">
        <header class="card-head">
          <div class="head-title">
            <span class="icon"><EyeOff size={15} /></span>
            <div>
              <h2>Recommendations &amp; Privacy</h2>
              <p>Control what appears in the bottom section of the Start Menu.</p>
            </div>
          </div>
        </header>

        <div class="hero-toggle" class:on={sm.hideRecommended}>
          <div class="toggle-copy">
            <div class="title-line">
              <strong>Hide Recommended section completely</strong>
              <span class="tag admin"><ShieldCheck size={11} /> Policy</span>
              <span class="tag" class:done={sm.hideRecommended}>{sm.hideRecommended ? "On" : "Off"}</span>
            </div>
            <p>Collapses the entire Recommended feed so the Start Menu shows only your pinned apps and All Apps.</p>
          </div>
          <label class="switch">
            <input
              type="checkbox"
              checked={sm.hideRecommended}
              disabled={debloat.locked}
              onchange={(e) => {
                const target = e.currentTarget;
                const want = target.checked;
                target.checked = !want;
                void debloat.setHideRecommended(want);
              }}
            />
            <span></span>
          </label>
        </div>

        <div class="rows">
          <div class="row">
            <div class="copy">
              <strong>Show recently added apps</strong>
              <p>Display newly installed apps in the Start Menu.</p>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                checked={sm.showRecentApps}
                disabled={debloat.locked}
                onchange={(e) => debloat.setStartMenu({ showRecentApps: e.currentTarget.checked })}
              />
              <span></span>
            </label>
          </div>

          <div class="row">
            <div class="copy">
              <strong>Show most used apps</strong>
              <p>Track and surface frequently launched apps in Start.</p>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                checked={sm.showMostUsedApps}
                disabled={debloat.locked}
                onchange={(e) => debloat.setStartMenu({ showMostUsedApps: e.currentTarget.checked })}
              />
              <span></span>
            </label>
          </div>

          <div class="row">
            <div class="copy">
              <strong>Show recently opened files</strong>
              <p>Include recent documents in Start and File Explorer jump lists.</p>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                checked={sm.showRecentFiles}
                disabled={debloat.locked}
                onchange={(e) => debloat.setStartMenu({ showRecentFiles: e.currentTarget.checked })}
              />
              <span></span>
            </label>
          </div>

          <div class="row">
            <div class="copy">
              <strong>Show tips, shortcuts &amp; app suggestions</strong>
              <p>Allow Windows to suggest Store apps and tips inside Start.</p>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                checked={sm.showRecommendations}
                disabled={debloat.locked}
                onchange={(e) => debloat.setStartMenu({ showRecommendations: e.currentTarget.checked })}
              />
              <span></span>
            </label>
          </div>

          <div class="row">
            <div class="copy">
              <strong>Show account-related notifications</strong>
              <p>Show Microsoft account and OneDrive alerts on the user profile icon.</p>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                checked={sm.showAccountNotifications}
                disabled={debloat.locked}
                onchange={(e) => debloat.setStartMenu({ showAccountNotifications: e.currentTarget.checked })}
              />
              <span></span>
            </label>
          </div>
        </div>
      </section>

      <section class="card surface">
        <header class="card-head">
          <div class="head-title">
            <span class="icon"><Pin size={15} /></span>
            <div>
              <div class="title-line">
                <h2>Clean Up Pinned Apps</h2>
                <span class="tag admin"><ShieldCheck size={11} /> Admin</span>
              </div>
              <p>Replace default Start Menu bloatware pins with a clean layout. Your current pins are backed up automatically.</p>
            </div>
          </div>
          <div class="quick-links">
            <button type="button" class="link" disabled={debloat.locked} onclick={() => selectPins("essential")}>Essential</button>
            <span>·</span>
            <button type="button" class="link" disabled={debloat.locked} onclick={() => selectPins("all")}>All</button>
            <span>·</span>
            <button type="button" class="link" disabled={debloat.locked} onclick={() => selectPins("none")}>None</button>
          </div>
        </header>

        <div class="pin-grid">
          {#each pinCatalog as item (item.id)}
            {@const chosen = selectedPins.has(item.id)}
            <button
              type="button"
              class="pin-tile"
              class:chosen
              disabled={debloat.locked}
              onclick={() => togglePin(item.id)}
            >
              <span class="check-box" aria-hidden="true">
                {#if chosen}<Check size={11} />{/if}
              </span>
              <div class="pin-copy">
                <strong>{item.label}</strong>
                <span>{item.sub}</span>
              </div>
            </button>
          {/each}
        </div>

        <footer class="pin-actions">
          <button
            type="button"
            class="btn primary"
            disabled={debloat.locked || selectedPins.size === 0}
            onclick={() => debloat.applyStartPins([...selectedPins], `Apply ${selectedPins.size} Start Menu pins`)}
          >
            <Sparkles size={14} /> Apply selected ({selectedPins.size})
          </button>
          <button
            type="button"
            class="btn"
            disabled={debloat.locked}
            onclick={() => debloat.applyStartPins([], "Clear all Start Menu pins")}
          >
            <Trash2 size={14} /> Clear all pins
          </button>
          {#if sm.hasPinsBackup}
            <button
              type="button"
              class="btn"
              disabled={debloat.locked}
              onclick={() => debloat.restoreStartPins()}
            >
              <RotateCcw size={14} /> Restore previous pins
            </button>
          {/if}
        </footer>
      </section>
    </div>
  </div>
{/if}

<style>
  .empty { padding: 20px; color: var(--text-2); font-size: 12.5px; }
  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    align-items: start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }
  .card {
    padding: 16px 18px;
    min-width: 0;
  }
  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgb(255 255 255 / 0.06);
  }
  .head-title {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex: none;
    border: 1px solid rgb(var(--accent-rgb) / 0.22);
    border-radius: 9px;
    background: rgb(var(--accent-rgb) / 0.1);
    color: var(--accent);
  }
  h2 { font-size: 14.5px; }
  .card-head p { margin-top: 2px; color: var(--text-2); font-size: 11.5px; line-height: 1.4; }
  .title-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .quick-links {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    color: var(--text-3);
    font-size: 11.5px;
  }
  .link { color: var(--accent); font-size: 11.5px; font-weight: 560; }
  .link:hover:not(:disabled) { text-decoration: underline; }
  .link:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Segmented controls */
  .control-group {
    padding: 12px 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.045);
  }
  .control-group:last-child { padding-bottom: 2px; border-bottom: 0; }
  .control-label strong { display: block; font-size: 12.5px; font-weight: 560; }
  .control-label span { display: block; margin-top: 2px; color: var(--text-2); font-size: 11.2px; }
  .segmented {
    display: grid;
    gap: 8px;
    margin-top: 9px;
  }
  .segmented.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .segmented.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .seg-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 9px 11px;
    border: 1px solid rgb(255 255 255 / 0.065);
    border-radius: 10px;
    background: rgb(255 255 255 / 0.02);
    text-align: left;
    transition: border-color var(--dur-fast), background var(--dur-fast);
  }
  .seg-btn:hover:not(:disabled) {
    border-color: rgb(255 255 255 / 0.14);
    background: rgb(255 255 255 / 0.04);
  }
  .seg-btn.active {
    border-color: rgb(var(--accent-rgb) / 0.48);
    background: linear-gradient(145deg, rgb(var(--accent-rgb) / 0.2), rgb(var(--accent-rgb) / 0.07));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08);
  }
  .seg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .seg-btn strong { font-size: 12px; font-weight: 600; color: var(--text-1); }
  .seg-btn span { font-size: 10.5px; color: var(--text-3); line-height: 1.3; }
  .seg-btn.active span { color: var(--text-2); }

  /* Quick Folders grid */
  .folder-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    margin-top: 12px;
  }
  .folder-tile {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid rgb(255 255 255 / 0.06);
    border-radius: 9px;
    background: rgb(255 255 255 / 0.02);
    text-align: left;
    transition: border-color var(--dur-fast), background var(--dur-fast);
  }
  .folder-tile:hover:not(:disabled) {
    border-color: rgb(255 255 255 / 0.13);
    background: rgb(255 255 255 / 0.04);
  }
  .folder-tile.active {
    border-color: rgb(var(--accent-rgb) / 0.42);
    background: rgb(var(--accent-rgb) / 0.11);
  }
  .folder-tile:disabled { opacity: 0.5; cursor: not-allowed; }
  .check-box {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    flex: none;
    border: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 5px;
    background: rgb(255 255 255 / 0.03);
    color: #fff;
  }
  .folder-tile.active .check-box,
  .pin-tile.chosen .check-box {
    border-color: rgb(var(--accent-rgb) / 0.8);
    background: rgb(var(--accent-rgb) / 0.75);
  }
  .folder-name {
    overflow: hidden;
    font-size: 11.8px;
    font-weight: 540;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Hero policy toggle & rows */
  .hero-toggle {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    padding: 11px 12px;
    border: 1px solid rgb(var(--accent-rgb) / 0.22);
    border-radius: 10px;
    background: linear-gradient(145deg, rgb(var(--accent-rgb) / 0.1), rgb(255 255 255 / 0.015));
  }
  .hero-toggle.on {
    border-color: rgb(74 222 128 / 0.28);
    background: linear-gradient(145deg, rgb(74 222 128 / 0.1), rgb(255 255 255 / 0.015));
  }
  .toggle-copy strong { font-size: 12.5px; font-weight: 600; }
  .toggle-copy p { margin-top: 3px; color: var(--text-2); font-size: 11.2px; line-height: 1.42; }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 7px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.04);
    color: var(--text-3);
    font-size: 9.8px;
    font-weight: 600;
  }
  .tag.admin {
    border-color: rgb(94 176 255 / 0.18);
    background: rgb(94 176 255 / 0.08);
    color: rgb(142 199 255 / 0.85);
  }
  .tag.done {
    border-color: rgb(74 222 128 / 0.22);
    background: rgb(74 222 128 / 0.09);
    color: var(--ok);
  }

  .rows {
    display: flex;
    flex-direction: column;
    margin-top: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 9px 2px;
    border-bottom: 1px solid rgb(255 255 255 / 0.045);
  }
  .row:last-child { padding-bottom: 2px; border-bottom: 0; }
  .copy strong { font-size: 12.2px; font-weight: 550; }
  .copy p { margin-top: 1px; color: var(--text-2); font-size: 11px; line-height: 1.38; }

  /* Switch */
  .switch { position: relative; display: inline-block; width: 34px; height: 19px; flex: none; cursor: pointer; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch span { position: absolute; inset: 0; border: 1px solid rgb(255 255 255 / 0.12); border-radius: 999px; background: rgb(255 255 255 / 0.07); transition: background var(--dur-fast), border-color var(--dur-fast); }
  .switch span::before { content: ""; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: var(--text-2); transition: transform var(--dur-fast), background var(--dur-fast); }
  .switch input:checked + span { border-color: rgb(var(--accent-rgb) / 0.55); background: rgb(var(--accent-rgb) / 0.45); }
  .switch input:checked + span::before { transform: translateX(15px); background: #fff; }
  .switch input:disabled + span { opacity: 0.45; cursor: not-allowed; }

  /* Pinned apps grid */
  .pin-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    margin-top: 12px;
  }
  .pin-tile {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid rgb(255 255 255 / 0.06);
    border-radius: 9px;
    background: rgb(255 255 255 / 0.02);
    text-align: left;
    transition: border-color var(--dur-fast), background var(--dur-fast);
  }
  .pin-tile:hover:not(:disabled) {
    border-color: rgb(255 255 255 / 0.13);
    background: rgb(255 255 255 / 0.04);
  }
  .pin-tile.chosen {
    border-color: rgb(var(--accent-rgb) / 0.42);
    background: rgb(var(--accent-rgb) / 0.11);
  }
  .pin-tile:disabled { opacity: 0.5; cursor: not-allowed; }
  .pin-copy { display: grid; min-width: 0; }
  .pin-copy strong {
    overflow: hidden;
    font-size: 11.6px;
    font-weight: 560;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pin-copy span {
    color: var(--text-3);
    font-size: 10px;
  }

  .pin-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgb(255 255 255 / 0.055);
  }

  @media (max-width: 980px) {
    .columns { grid-template-columns: 1fr; }
  }
  @media (max-width: 580px) {
    .segmented.cols-3, .folder-grid, .pin-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .card-head { flex-direction: column; }
  }
</style>

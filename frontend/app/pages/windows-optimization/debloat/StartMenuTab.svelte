<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ActionBar from "./ActionBar.svelte";
  import CategoryCard from "./CategoryCard.svelte";
  import CategoryGrid from "./CategoryGrid.svelte";
  import ChoiceButtons from "./ChoiceButtons.svelte";
  import SettingRow from "./SettingRow.svelte";
  import type { StartAlignment, StartAllAppsView, StartLayout, StartMenuStatus } from "./api";
  import { folderCatalog, pinCatalog, startPresets } from "./catalog";
  import { debloat } from "./state.svelte";

  const sm = $derived(debloat.status?.startMenu);
  const disabled = $derived(debloat.locked || !sm?.supported);
  const alignments: { id: StartAlignment; label: string; hint: string }[] = [
    { id: "left", label: "Left", hint: "Classic corner position" },
    { id: "center", label: "Center", hint: "Windows 11 default" },
  ];
  const layouts: { id: StartLayout; label: string; hint: string }[] = [
    { id: "default", label: "Default", hint: "Balanced pins & items" },
    { id: "morePins", label: "More pins", hint: "Extra space for apps" },
    { id: "moreRecommendations", label: "More recent", hint: "Extra space for files" },
  ];
  const views: { id: StartAllAppsView; label: string; hint: string }[] = [
    { id: "category", label: "Category", hint: "Grouped by topic" },
    { id: "grid", label: "Grid", hint: "Alphabetical tiles" },
    { id: "list", label: "List", hint: "Compact A–Z list" },
  ];
  type PrivacyKey = keyof Pick<StartMenuStatus, "hideRecommended" | "showRecentApps" | "showMostUsedApps" | "showRecentFiles" | "showRecommendations" | "showAccountNotifications">;
  const privacyOptions: { key: PrivacyKey; title: string; summary: string }[] = [
    { key: "hideRecommended", title: "Hide Recommended section", summary: "Show only pinned apps and All Apps. This policy requires administrator approval." },
    { key: "showRecentApps", title: "Recently added apps", summary: "Show newly installed apps in Start." },
    { key: "showMostUsedApps", title: "Most used apps", summary: "Track and show frequently launched apps." },
    { key: "showRecentFiles", title: "Recently opened files", summary: "Show recent documents in Start and Explorer jump lists." },
    { key: "showRecommendations", title: "Tips & app suggestions", summary: "Allow Windows to suggest Store apps and tips." },
    { key: "showAccountNotifications", title: "Account notifications", summary: "Show Microsoft account and OneDrive alerts." },
  ];
  function setPrivacy(key: PrivacyKey, want: boolean) {
    if (disabled) return;
    if (key === "hideRecommended") void debloat.setHideRecommended(want);
    else void debloat.setStartMenu({ [key]: want });
  }
  function setFolder(id: string, enabled: boolean) {
    if (disabled || !sm) return;
    const next = new Set(sm.folders);
    if (enabled) next.add(id); else next.delete(id);
    void debloat.setStartMenu({ folders: folderCatalog.map((item) => item.id).filter((item) => next.has(item)) });
  }
  function setFolderPreset(preset: string) {
    if (disabled) return;
    void debloat.setStartMenu({ folders: folderCatalog.filter((item) => preset === "all" || (preset === "essential" && item.essential)).map((item) => item.id) });
  }
</script>

<div class="optimization-ui">
  <p class="save-note">
    {#if debloat.startMenuBusy}<LoaderCircle size={13} class="spin" /> Saving…{:else}<ShieldCheck size={13} /> Changes here take effect at once; pinned apps are applied together.{/if}
  </p>
  {#if !sm}
    <div class="empty-state"><strong>{debloat.error ? "Could not load Start Menu settings" : "Loading Start Menu settings…"}</strong></div>
  {:else}
    {#if !sm.supported}<p class="notice">Start Menu customization is unavailable on this version of Windows. These controls require a supported Windows 11 build.</p>{/if}
    <CategoryGrid>
      <CategoryCard id="layout" title="Layout & View" description="Position, density and the All Apps view.">
        <div class="control-group">
          <strong>Start & Taskbar alignment</strong>
          <p>Where Start and pinned taskbar icons sit.</p>
          <div class="segmented" role="group" aria-label="Start alignment">
            {#each alignments as item (item.id)}
              <button class="seg-btn" class:active={sm.alignment === item.id} aria-pressed={sm.alignment === item.id} {disabled} onclick={() => debloat.setStartMenu({ alignment: item.id })}><strong>{item.label}</strong><span>{item.hint}</span></button>
            {/each}
          </div>
        </div>
        <div class="control-group">
          <strong>Start Menu layout</strong><p>Give more room to apps or recent files.</p>
          <div class="segmented" role="group" aria-label="Start Menu layout">
            {#each layouts as item (item.id)}
              <button class="seg-btn" class:active={sm.layout === item.id} aria-pressed={sm.layout === item.id} {disabled} onclick={() => debloat.setStartMenu({ layout: item.id })}><strong>{item.label}</strong><span>{item.hint}</span></button>
            {/each}
          </div>
        </div>
        <div class="control-group">
          <strong>All Apps view</strong><p>Choose how your installed apps are organized.</p>
          <div class="segmented" role="group" aria-label="All Apps view mode">
            {#each views as item (item.id)}
              <button class="seg-btn" class:active={sm.allAppsView === item.id} aria-pressed={sm.allAppsView === item.id} {disabled} onclick={() => debloat.setStartMenu({ allAppsView: item.id })}><strong>{item.label}</strong><span>{item.hint}</span></button>
            {/each}
          </div>
        </div>
      </CategoryCard>
      <CategoryCard id="recommendations" title="Recommendations & Privacy" description="Control what Windows shows in Start.">
        <div class="rows">
          {#each privacyOptions as item (item.key)}
            <SettingRow title={item.title} summary={item.summary} checked={sm[item.key]} {disabled} onchange={(want) => setPrivacy(item.key, want)} />
          {/each}
        </div>
      </CategoryCard>
      <CategoryCard id="folders" title="Quick Folders" count={sm.folders.length + " / " + folderCatalog.length + " active"} description="Shortcuts next to the Power button.">
        {#snippet tools()}<ChoiceButtons options={startPresets} {disabled} ariaLabel="Quick folder presets" onchange={setFolderPreset} />{/snippet}
        <div class="grid-rows">
          {#each folderCatalog as folder (folder.id)}
            <SettingRow control="check" title={folder.label} checked={sm.folders.includes(folder.id)} {disabled} onchange={(enabled) => setFolder(folder.id, enabled)} />
          {/each}
        </div>
      </CategoryCard>
      <CategoryCard id="pins" title="Pinned Apps" count={debloat.selectedPins.size + " selected"} description="Choose a clean set of pins. Your current layout is backed up before applying." wide>
        {#snippet tools()}
          <ChoiceButtons options={startPresets} {disabled} ariaLabel="Pinned app presets" onchange={(preset) => debloat.selectPins(preset as "essential" | "all" | "none")} />
        {/snippet}
        <div class="grid-rows pins">
          {#each pinCatalog as item (item.id)}
            <SettingRow control="check" title={item.label} subtitle={item.sub} checked={debloat.selectedPins.has(item.id)} {disabled} onchange={() => debloat.togglePin(item.id)} />
          {/each}
        </div>
        <ActionBar title={debloat.selectedPins.size + " pinned apps selected"} detail="The selection is kept when you switch tabs. Apply it when you are ready.">
          <button class="btn primary" disabled={disabled || !debloat.selectedPins.size} onclick={() => debloat.applyStartPins([...debloat.selectedPins], "Apply " + debloat.selectedPins.size + " Start Menu pins")}>
            {#if debloat.startMenuBusy}<LoaderCircle size={14} class="spin" /> Working…{:else}<Sparkles size={14} /> Apply selected ({debloat.selectedPins.size}){/if}
          </button>
          <button class="btn danger-outline" {disabled} onclick={() => debloat.applyStartPins([], "Clear all Start Menu pins")}><Trash2 size={14} /> Clear all pins</button>
          {#if sm.hasPinsBackup}<button class="btn" {disabled} onclick={() => debloat.restoreStartPins()}><RotateCcw size={14} /> Restore previous pins</button>{/if}
        </ActionBar>
      </CategoryCard>
    </CategoryGrid>
  {/if}
</div>

<style>
  .save-note { display: flex; align-items: center; gap: 7px; color: var(--text-2); font-size: 11.5px; }
  .control-group + .control-group { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgb(255 255 255 / 0.06); }
  .control-group { padding: 0 4px; }
  .control-group > strong { color: var(--text-1); font-size: 12.5px; font-weight: 600; }
  .control-group > p { margin-top: 2px; color: var(--text-2); font-size: 11px; line-height: 1.45; }
  .segmented { display: flex; gap: 6px; margin-top: 7px; }
  .seg-btn { display: grid; align-content: start; gap: 2px; flex: 1; min-width: 0; padding: 7px 9px; border: 1px solid rgb(255 255 255 / 0.08); border-radius: 8px; background: rgb(255 255 255 / 0.025); text-align: left; }
  .seg-btn:hover:not(:disabled) { border-color: rgb(var(--accent-rgb) / 0.35); }
  .seg-btn.active { border-color: rgb(var(--accent-rgb) / 0.5); background: rgb(var(--accent-rgb) / 0.13); }
  .seg-btn strong { color: var(--text-1); font-size: 12px; }
  .seg-btn span { overflow: hidden; color: var(--text-2); font-size: 10.5px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
  .seg-btn:disabled { opacity: 0.45; }
  .rows { display: grid; gap: 1px; }
  .grid-rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px 8px; }
  .grid-rows.pins { margin-bottom: 4px; }
  @container optimization-list (min-width: 820px) { .grid-rows.pins { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @container optimization-list (min-width: 1150px) { .grid-rows.pins { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @container optimization-list (max-width: 400px) { .grid-rows { grid-template-columns: minmax(0, 1fr); } }
</style>

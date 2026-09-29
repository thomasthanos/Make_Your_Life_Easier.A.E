<script lang="ts">
  // Every tweak on its own, where it stands on this PC, with Apply and Undo.
  import Bot from "@lucide/svelte/icons/bot";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Package from "@lucide/svelte/icons/package";
  import PanelBottom from "@lucide/svelte/icons/panel-bottom";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import type { Category, TweakState, TweakStatus } from "./api";
  import Progress from "./Progress.svelte";
  import { debloat } from "./state.svelte";

  interface CategoryDef {
    id: Category;
    title: string;
    icon: typeof Bot;
  }

  interface CategoryGroup extends CategoryDef {
    items: TweakStatus[];
  }

  const categories: CategoryDef[] = [
    { id: "privacy", title: "Privacy", icon: EyeOff },
    { id: "system", title: "System", icon: Settings2 },
    { id: "taskbar", title: "Taskbar & Start", icon: PanelBottom },
    { id: "explorer", title: "File Explorer", icon: FolderOpen },
    { id: "ai", title: "AI", icon: Bot },
    { id: "apps", title: "Apps", icon: Package },
  ];

  const labels: Record<TweakState, string> = {
    applied: "On",
    notApplied: "Off",
    partial: "Partly",
    unavailable: "Not on this Windows",
  };

  const undoable = $derived((debloat.status?.tweaks ?? []).filter((tweak) => tweak.canUndo));

  // Pack category cards into 2 height-balanced vertical columns so short
  // categories (AI, Apps, Explorer) never leave dead vertical gaps.
  const columns = $derived.by(() => {
    const tweaks = debloat.status?.tweaks ?? [];
    const groups: CategoryGroup[] = categories
      .map((cat) => ({ ...cat, items: tweaks.filter((t) => t.category === cat.id) }))
      .filter((cat) => cat.items.length > 0);

    const left: CategoryGroup[] = [];
    const right: CategoryGroup[] = [];
    let leftWeight = 0;
    let rightWeight = 0;

    for (const group of groups) {
      const weight = 1.6 + group.items.length;
      if (leftWeight <= rightWeight) {
        left.push(group);
        leftWeight += weight;
      } else {
        right.push(group);
        rightWeight += weight;
      }
    }

    return [left, right];
  });
</script>

<div class="tweaks">
  <div class="bar surface">
    <p>Each change on its own. <strong>On</strong> means it is already in place on this PC, set by MYLE, by Windows or by you.</p>
    <button class="btn undo-all" disabled={debloat.locked || !undoable.length} onclick={() => debloat.undo(undoable)}>
      <Undo2 size={14} /> Undo all MYLE changes{undoable.length ? ` (${undoable.length})` : ""}
    </button>
  </div>

  <Progress />

  <div class="columns">
    {#each columns as col, colIdx (colIdx)}
      <div class="column">
        {#each col as category (category.id)}
          <section class="group surface">
            <header>
              <span class="cat-icon"><category.icon size={14} /></span>
              <h3>{category.title}</h3>
              <span class="cat-count">{category.items.filter((t) => t.state === "applied").length}/{category.items.length}</span>
            </header>
            <ul>
              {#each category.items as tweak (tweak.id)}
                <li class={tweak.state}>
                  <div class="tweak-row">
                    <div class="text">
                      <strong>
                        {tweak.title}
                        {#if tweak.risk === "caution"}<span class="tag caution"><TriangleAlert size={10} /> Caution</span>{/if}
                      </strong>
                      <small>{tweak.summary}</small>
                    </div>
                    <div class="tweak-controls">
                      <span class="state {tweak.state}">{#if tweak.state === "applied"}<ShieldCheck size={11} />{/if}{labels[tweak.state]}</span>
                      {#if tweak.canUndo || tweak.state === "notApplied" || tweak.state === "partial"}
                        <div class="actions">
                          {#if tweak.canUndo}
                            <button class="btn small ghost" disabled={debloat.locked} onclick={() => debloat.undo([tweak])}><Undo2 size={12} /> Undo</button>
                          {/if}
                          {#if tweak.state === "notApplied" || tweak.state === "partial"}
                            <button class="btn small primary" disabled={debloat.locked} onclick={() => debloat.apply(tweak)}>Apply</button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .tweaks {
    display: grid;
    gap: 14px;
  }

  /* ── Top bar ──────────────────────────────────────────────────────────── */

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
  }

  .bar p {
    color: var(--text-2);
    font-size: 12.5px;
    line-height: 1.45;
  }

  .bar strong {
    color: var(--text-1);
  }

  .undo-all {
    flex: none;
    white-space: nowrap;
  }

  /* ── Balanced 2-column masonry stack ──────────────────────────────────── */

  .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 14px;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  /* ── Category card ────────────────────────────────────────────────────── */

  .group {
    padding: 14px 16px 8px;
  }

  .group header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgb(255 255 255 / 0.055);
  }

  .cat-icon {
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
    flex: 1;
    color: var(--text-1);
    font-size: 13.5px;
    font-weight: 650;
  }

  .cat-count {
    padding: 2px 8px;
    border: 1px solid rgb(255 255 255 / 0.06);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.025);
    color: var(--text-3);
    font-size: 10px;
    font-weight: 600;
  }

  /* ── Tweak rows ───────────────────────────────────────────────────────── */

  ul {
    margin: 0;
    padding: 2px 0 0;
    list-style: none;
  }

  li + li {
    border-top: 1px solid rgb(255 255 255 / 0.04);
  }

  li.unavailable {
    opacity: 0.5;
  }

  .tweak-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 6px;
    border-radius: 9px;
    transition: background var(--dur-fast);
  }

  .tweak-row:hover {
    background: rgb(255 255 255 / 0.025);
  }

  .text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }

  .text strong {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 600;
  }

  .text small {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.4;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid rgb(237 170 73 / 0.25);
    border-radius: 999px;
    background: rgb(237 170 73 / 0.05);
    color: rgb(239 191 111 / 0.9);
    font-size: 9.5px;
    font-weight: 600;
  }

  /* ── Controls (state + actions) ───────────────────────────────────────── */

  .tweak-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.02);
    color: var(--text-3);
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }

  .state.applied {
    border-color: rgb(63 203 151 / 0.22);
    background: rgb(63 203 151 / 0.06);
    color: rgb(99 224 177 / 0.9);
  }

  .state.partial {
    border-color: rgb(237 170 73 / 0.2);
    background: rgb(237 170 73 / 0.04);
    color: rgb(239 191 111 / 0.85);
  }

  .actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
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

  /* ── Responsive ───────────────────────────────────────────────────────── */

  @media (max-width: 960px) {
    .columns {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .bar {
      flex-direction: column;
      align-items: stretch;
    }

    .tweak-row {
      flex-wrap: wrap;
    }

    .tweak-controls {
      width: 100%;
      justify-content: space-between;
      padding-left: 2px;
    }
  }
</style>

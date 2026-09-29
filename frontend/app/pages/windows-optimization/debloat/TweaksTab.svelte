<script lang="ts">
  // Every tweak on its own, where it stands on this PC, with Apply and Undo.
  import Bot from "@lucide/svelte/icons/bot";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Package from "@lucide/svelte/icons/package";
  import PanelBottom from "@lucide/svelte/icons/panel-bottom";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import type { Category, TweakState } from "./api";
  import Progress from "./Progress.svelte";
  import { debloat } from "./state.svelte";

  const categories: { id: Category; title: string; icon: typeof Bot }[] = [
    { id: "privacy", title: "Privacy", icon: EyeOff },
    { id: "taskbar", title: "Taskbar and Start", icon: PanelBottom },
    { id: "explorer", title: "File Explorer", icon: FolderOpen },
    { id: "ai", title: "AI", icon: Bot },
    { id: "system", title: "System", icon: Settings2 },
    { id: "apps", title: "Apps", icon: Package },
  ];

  const labels: Record<TweakState, string> = {
    applied: "On",
    notApplied: "Off",
    partial: "Partly",
    unavailable: "Not on this Windows",
  };

  const undoable = $derived((debloat.status?.tweaks ?? []).filter((tweak) => tweak.canUndo));
</script>

<div class="tweaks">
  <div class="bar">
    <p>Each change on its own. <strong>On</strong> means it is already in place on this PC, set by MYLE, by Windows or by you.</p>
    <button class="btn" disabled={debloat.locked || !undoable.length} onclick={() => debloat.undo(undoable)}>
      <Undo2 size={14} /> Undo all MYLE changes{undoable.length ? ` (${undoable.length})` : ""}
    </button>
  </div>

  <Progress />

  <div class="grid">
    {#each categories as category (category.id)}
      {@const items = (debloat.status?.tweaks ?? []).filter((tweak) => tweak.category === category.id)}
      {#if items.length}
        <section class="group surface">
          <header><category.icon size={15} /><h3>{category.title}</h3></header>
          <ul>
            {#each items as tweak (tweak.id)}
              <li class={tweak.state}>
                <div class="text">
                  <strong>
                    {tweak.title}
                    {#if tweak.risk === "caution"}<span class="tag caution"><TriangleAlert size={10} /> Caution</span>{/if}
                  </strong>
                  <small>{tweak.summary}</small>
                </div>
                <span class="state {tweak.state}">{#if tweak.state === "applied"}<ShieldCheck size={11} />{/if}{labels[tweak.state]}</span>
                <div class="actions">
                  {#if tweak.canUndo}
                    <button class="btn small" disabled={debloat.locked} onclick={() => debloat.undo([tweak])}><Undo2 size={12} /> Undo</button>
                  {/if}
                  {#if tweak.state === "notApplied" || tweak.state === "partial"}
                    <button class="btn small primary" disabled={debloat.locked} onclick={() => debloat.apply(tweak)}>Apply</button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  </div>
</div>

<style>
  .tweaks {
    display: grid;
    gap: 14px;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .bar p {
    color: var(--text-2);
    font-size: 12px;
  }

  .bar .btn {
    flex: none;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
    align-items: start;
    gap: 14px;
  }

  .group {
    padding: 12px 14px 6px;
  }

  .group header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 6px;
    color: rgb(176 188 255 / 0.9);
  }

  .group h3 {
    color: var(--text-1);
    font-size: 13px;
    font-weight: 650;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    padding: 9px 2px;
  }

  li + li {
    border-top: 1px solid rgb(255 255 255 / 0.05);
  }

  li.unavailable {
    opacity: 0.55;
  }

  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .text strong {
    display: flex;
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
    padding: 2px 7px;
    border: 1px solid rgb(237 170 73 / 0.25);
    border-radius: 999px;
    color: rgb(239 191 111 / 0.9);
    font-size: 9.5px;
    font-weight: 600;
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 999px;
    color: var(--text-3);
    font-size: 10px;
    font-weight: 600;
    white-space: nowrap;
  }

  .state.applied {
    border-color: rgb(63 203 151 / 0.2);
    color: rgb(99 224 177 / 0.9);
  }

  .state.partial {
    border-color: rgb(237 170 73 / 0.2);
    color: rgb(239 191 111 / 0.85);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    min-width: 72px;
  }

  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .bar {
      flex-direction: column;
      align-items: stretch;
    }

    li {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .actions {
      grid-column: 1 / -1;
      justify-content: flex-start;
    }
  }
</style>

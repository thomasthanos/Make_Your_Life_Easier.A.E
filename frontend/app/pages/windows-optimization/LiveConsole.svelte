<script lang="ts">
  import { tick } from "svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import SquareStop from "@lucide/svelte/icons/square-stop";
  import Terminal from "@lucide/svelte/icons/terminal";
  import { toast } from "../../../lib/toast.svelte";
  import { windowsOptimizationState as tools } from "./state.svelte";

  let scroller = $state<HTMLDivElement>();
  let pinned = $state(true);
  const active = $derived(tools.activeAction === "launchCtt");
  const output = $derived(tools.console.lines.join("\n"));

  $effect(() => {
    tools.console.lines.length;
    if (pinned && tools.console.open) {
      void tick().then(() => {
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
    }
  });

  function onScroll() {
    if (!scroller) return;
    pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 28;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Console output copied.");
    } catch {
      toast.error("Could not copy the console output.");
    }
  }
</script>

<div class="console">
  <div class="bar">
    <button
      class="toggle"
      aria-expanded={tools.console.open}
      aria-controls="ctt-live-console"
      onclick={() => tools.toggleConsole()}
    >
      <Terminal size={14} />
      <span>Live console</span>
      {#if tools.console.lines.length}
        <span class="count">{tools.console.lines.length}{tools.console.dropped ? "+" : ""}</span>
      {/if}
      <ChevronDown size={14} class={tools.console.open ? "flip" : undefined} />
    </button>
    {#if active}
      <span class="phase"><LoaderCircle size={13} class="spin" /> {tools.statusOf("launchCtt")}…</span>
      {#if tools.console.lines.length}
        <button class="icon-btn" title="Copy output" aria-label="Copy console output" onclick={copy}><Copy size={13} /></button>
      {/if}
      <button class="btn small danger" disabled={tools.stopping || !tools.activeJob} onclick={() => tools.cancel()}>
        <SquareStop size={13} /> {tools.stopping ? "Stopping…" : "Stop"}
      </button>
    {:else if tools.console.lines.length}
      <button class="btn small ghost copy" onclick={copy}><Copy size={13} /> Copy</button>
    {/if}
  </div>

  <div id="ctt-live-console" class="collapse" class:open={tools.console.open} aria-hidden={!tools.console.open} inert={!tools.console.open}>
    <div class="inner">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="scroll" bind:this={scroller} onscroll={onScroll} role="region" aria-label="Scrollable Chris Titus Utility output" tabindex="0">
        <div role="log" aria-live="polite" aria-atomic="false" aria-busy={active}>
          {#if tools.console.dropped}<p class="muted">…{tools.console.dropped.toLocaleString()} earlier lines hidden</p>{/if}
          {#if tools.console.lines.length}
            <pre class="selectable">{output}</pre>
          {:else}
            <p class="muted">Output will appear here.</p>
          {/if}
        </div>
      </div>
      {#if !pinned && active}<button class="jump btn small" onclick={() => { pinned = true; if (scroller) scroller.scrollTop = scroller.scrollHeight; }}>Jump to latest</button>{/if}
      {#if active}<p class="stop-note">Stop is best-effort. Changes already applied inside WinUtil cannot be rolled back.</p>{/if}
    </div>
  </div>
</div>

<style>
  .console { margin-top: 14px; border-top: 1px solid rgb(255 255 255 / 0.065); }
  .bar { display: flex; align-items: center; gap: 7px; min-height: 40px; padding-top: 8px; flex-wrap: wrap; }
  .toggle, .phase { display: inline-flex; align-items: center; gap: 7px; color: var(--text-2); font-size: 11.5px; }
  .toggle:hover { color: var(--text-1); }
  .toggle :global(svg:last-child) { transition: transform var(--dur-med) var(--ease-out); }
  .toggle :global(svg.flip) { transform: rotate(180deg); }
  .count { padding: 1px 6px; border-radius: 999px; background: rgb(255 255 255 / 0.07); color: var(--text-3); font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .phase { margin-left: auto; color: var(--text-3); }
  .copy { margin-left: auto; }
  .collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur-med) var(--ease-out); }
  .collapse.open { grid-template-rows: 1fr; }
  .inner { position: relative; min-height: 0; overflow: hidden; }
  .scroll { max-height: 210px; margin-top: 3px; padding: 10px 11px; overflow: auto; border: 1px solid rgb(255 255 255 / 0.055); border-radius: var(--radius-sm); background: rgb(0 0 0 / 0.3); box-shadow: inset 0 1px 3px rgb(0 0 0 / 0.35); }
  pre { margin: 0; color: var(--text-2); font-family: var(--font-mono); font-size: 10.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .muted, .stop-note { color: var(--text-3); font-size: 10.5px; }
  .stop-note { margin-top: 7px; color: rgb(245 188 95 / 0.78); }
  .jump { position: absolute; right: 10px; bottom: 28px; }
  :global(:root.solid) .collapse { transition: none; }
</style>

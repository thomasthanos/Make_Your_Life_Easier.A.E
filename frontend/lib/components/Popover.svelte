<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Props {
    /** The button that opens the panel. */
    trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
    children: Snippet<[{ close: () => void }]>;
    align?: "start" | "end";
    placement?: "bottom" | "top";
    open?: boolean;
  }

  let { trigger, children, align = "start", placement = "bottom", open = $bindable(false) }: Props = $props();
  let root = $state<HTMLElement>();

  const close = () => (open = false);
  const toggle = () => (open = !open);

  function onPointerDown(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === "Escape") close();
  }
</script>

<svelte:window onpointerdown={onPointerDown} onkeydown={onKeydown} />

<div class="popover" bind:this={root}>
  {@render trigger({ toggle, open })}
  {#if open}
    <div
      class="panel {placement}"
      class:end={align === "end"}
      transition:fly={{ y: placement === "top" ? 6 : -6, duration: 150, easing: cubicOut }}
    >
      {@render children({ close })}
    </div>
  {/if}
</div>

<style>
  .popover {
    position: relative;
    display: inline-flex;
  }

  .panel {
    position: absolute;
    z-index: 40;
    left: 0;
    min-width: 100%;
  }

  .panel.end {
    left: auto;
    right: 0;
  }

  .panel.bottom {
    top: calc(100% + 6px);
  }

  .panel.top {
    bottom: calc(100% + 6px);
  }
</style>

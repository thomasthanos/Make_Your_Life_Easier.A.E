<script lang="ts">
  import { cubicOut } from "svelte/easing";
  import { fly } from "svelte/transition";
  import { nav } from "../../lib/nav.svelte";
  import { settings } from "../../lib/settings.svelte";
  import { pages } from "../pages/registry";

  const Page = $derived(pages.find((p) => p.id === nav.current)!.component);
  // A short slide-in; none at all in the lighter mode or with reduced motion,
  // so a slow machine spends its first frames on the page, not the animation.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const enter = $derived(!settings.glass || reducedMotion ? 0 : 160);
  let scroller = $state<HTMLDivElement>();
  // Ignore the scroll events caused by swapping pages.
  let restoring = false;

  // Runs after the new page is in the DOM: put it back where it was left.
  $effect(() => {
    const page = nav.current;
    if (!scroller) return;
    restoring = true;
    scroller.scrollTop = nav.scrollOf(page);
    requestAnimationFrame(() => (restoring = false));
  });

  function onScroll() {
    if (!restoring && scroller) nav.rememberScroll(nav.current, scroller.scrollTop);
  }
</script>

<main class="content glass">
  <div class="scroller" bind:this={scroller} onscroll={onScroll}>
    {#key nav.current}
      <div class="page" in:fly={{ y: 8, duration: enter, easing: cubicOut }}>
        <Page />
      </div>
    {/key}
  </div>
</main>

<style>
  .content {
    grid-area: main;
    min-width: 0;
    min-height: 0;
    border-radius: var(--shell-panel-radius);
  }

  /* Scrolling lives in a child so the glass rim is never clipped or scrolled. */
  .scroller {
    position: absolute;
    inset: 0;
    overflow: auto;
    padding: 28px 32px;
    border-radius: inherit;
    contain: strict;
  }

  /* Keep the scrollbar clear of the panel's rounded top and bottom edges. */
  .scroller::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .scroller::-webkit-scrollbar-track {
    margin-block: 16px;
    background: transparent;
  }

  .scroller::-webkit-scrollbar-thumb {
    border: 3px solid transparent;
    border-radius: 999px;
    background: rgb(210 220 245 / 0.13) padding-box;
  }

  .scroller::-webkit-scrollbar-thumb:hover {
    background-color: rgb(210 220 245 / 0.24);
  }
</style>

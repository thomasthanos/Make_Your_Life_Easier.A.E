<script lang="ts">
  import ConfirmHost from "../lib/components/ConfirmHost.svelte";
  import Toaster from "../lib/components/Toaster.svelte";
  import { onMount } from "svelte";
  import { nav } from "../lib/nav.svelte";
  import { account } from "./account/account.svelte";
  import { gameSavesState } from "./pages/game-saves/state.svelte";
  import ContentArea from "./shell/ContentArea.svelte";
  import Sidebar from "./shell/Sidebar.svelte";
  import Titlebar from "./shell/Titlebar.svelte";

  let maximized = $state(false);

  onMount(() => {
    // Notices game saves changed by playing, whichever page is open.
    gameSavesState.startWatcher();
    // Restores the signed-in account and syncs settings with it.
    void account.init();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      nav.toggleSidebar();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="shell" class:collapsed={nav.collapsed} class:maximized>
  <div class="app-backdrop" aria-hidden="true"></div>
  <Titlebar bind:maximized />
  <Sidebar />
  <ContentArea />
</div>

<Toaster />
<ConfirmHost />

<style>
  .shell {
    --frame-gap: var(--gap);

    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-areas:
      "title title"
      "side main";
    grid-template-rows: var(--titlebar-h) minmax(0, 1fr);
    grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    column-gap: var(--gap);
    row-gap: var(--chrome-gap);
    width: calc(100vw - var(--window-inset) * 2);
    height: calc(100vh - var(--window-inset) * 2);
    margin: var(--window-inset);
    border-radius: var(--window-radius);
    padding: 0 var(--frame-gap) var(--frame-gap);
    overflow: hidden;
    background: linear-gradient(180deg, var(--window-fill-top), var(--window-fill-bottom));
    box-shadow: var(--window-shadow);
    transition: grid-template-columns var(--dur-med) var(--ease-out);
  }

  .shell > :global(.app-backdrop) {
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: inherit;
  }

  .shell > :global(.titlebar),
  .shell > :global(.sidebar),
  .shell > :global(.content) {
    z-index: 1;
  }

  /* One continuous masked rim avoids doubled lines and clipped corner highlights. */
  .shell::before {
    content: "";
    position: absolute;
    z-index: 4;
    inset: 0;
    padding: 1px;
    border-radius: inherit;
    background: var(--window-border);
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask-composite: exclude;
    pointer-events: none;
  }

  .shell.collapsed {
    grid-template-columns: var(--sidebar-w-collapsed) minmax(0, 1fr);
  }

  .shell.maximized {
    --frame-gap: 0px;

    width: 100vw;
    height: 100vh;
    margin: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .shell.maximized::before {
    opacity: 0;
  }

  :global(:root.solid) .shell {
    background: linear-gradient(180deg, rgb(15 19 29 / 0.98), rgb(10 13 20 / 0.98));
  }
</style>

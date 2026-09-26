<script lang="ts">
  import { onMount } from "svelte";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import PageHeader from "../../../lib/components/PageHeader.svelte";
  import CreativeCard from "./CreativeCard.svelte";
  import { creativeState } from "./state.svelte";

  onMount(() => {
    void creativeState.load();
  });
</script>

<PageHeader title="Creative Hub" subtitle="Download and set up your packages in one click." />

{#if creativeState.error}
  <div class="banner surface" role="alert">
    <CircleAlert size={18} />
    <span>{creativeState.error}</span>
  </div>
{/if}

{#if creativeState.loading && !creativeState.apps.length}
  <p class="loading"><LoaderCircle size={16} class="spin" /> Loading…</p>
{:else}
  <div class="grid">
    {#each creativeState.apps as app (app.id)}
      <CreativeCard {app} />
    {/each}
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
    padding: 12px 14px;
    border-color: rgb(229 72 77 / 0.35);
    color: #ffb4b0;
    font-size: 13px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
    gap: 12px;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-3);
    font-size: 13px;
  }
</style>

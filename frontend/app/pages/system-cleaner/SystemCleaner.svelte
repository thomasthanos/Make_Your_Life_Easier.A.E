<script lang="ts">
  import { onMount } from "svelte";
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import RadarIcon from "@lucide/svelte/icons/radar";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import PageHeader from "../../../lib/components/PageHeader.svelte";
  import { formatSize } from "./api";
  import CleanerCard from "./CleanerCard.svelte";
  import { cleanerState } from "./state.svelte";

  onMount(() => {
    void cleanerState.load();
  });

  const lastCleanedLabel = $derived.by(() => {
    const at = cleanerState.lastCleaned;
    if (!at) return "Never";
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  });

  const lastCleanedTitle = $derived(
    cleanerState.lastCleaned ? new Date(cleanerState.lastCleaned).toLocaleString() : "No cleanup yet",
  );

  const cleanLabel = $derived.by(() => {
    const p = cleanerState.progress;
    if (cleanerState.phase !== "cleaning") return "Clean selected";
    if (!p) return "Cleaning…";
    return p.current ? `Cleaning ${p.done + 1}/${p.total} · ${p.current}` : `Cleaning ${p.done}/${p.total}`;
  });
</script>

<PageHeader title="System Cleaner" subtitle="Find and remove the files Windows leaves behind." />

<section class="hero surface">
  <div class="stats">
    <div class="stat">
      <span class="label">Last cleaned</span>
      <strong class="value small" title={lastCleanedTitle}>{lastCleanedLabel}</strong>
    </div>
    <div class="stat">
      <span class="label">Total size</span>
      <strong class="value" class:shimmer={cleanerState.phase === "scanning"}>
        {formatSize(cleanerState.total)}
      </strong>
    </div>
    <div class="stat">
      <span class="label">Selected</span>
      <strong class="value accent">{formatSize(cleanerState.selectedBytes)}</strong>
    </div>
  </div>

  <div class="bar">
    <p class="status">
      {#if cleanerState.phase !== "idle"}
        <LoaderCircle size={13} class="spin" />
      {:else if cleanerState.scanned}
        <CheckCheck size={13} />
      {/if}
      {cleanerState.status}
    </p>

    <div class="actions">
      <button class="btn" disabled={cleanerState.busy} onclick={() => cleanerState.scan()}>
        <RadarIcon size={15} />
        Scan
      </button>
      <button class="btn" disabled={cleanerState.busy || !cleanerState.categories.length} onclick={() => cleanerState.toggleAll()}>
        <CheckCheck size={15} />
        {cleanerState.allSelected ? "Deselect all" : "Select all"}
      </button>
      <button
        class="btn primary"
        disabled={cleanerState.busy || !cleanerState.selected.size}
        onclick={() => cleanerState.clean()}
      >
        <Sparkles size={15} />
        {cleanLabel}
      </button>
    </div>
  </div>
</section>

{#if cleanerState.error}
  <div class="banner surface" role="alert">
    <CircleAlert size={18} />
    <span>{cleanerState.error}</span>
  </div>
{/if}

<div class="grid">
  {#each cleanerState.categories as category (category.id)}
    <CleanerCard {category} />
  {/each}
</div>

<style>
  .hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px 24px;
    margin-bottom: 16px;
    padding: 16px 20px;
  }

  .stats {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 12px 28px;
  }

  .stat {
    display: grid;
    gap: 3px;
  }

  .label {
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .value {
    font-size: 23px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .value.small {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.35;
  }

  .value.accent {
    color: var(--accent);
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    flex: 1 1 380px;
    gap: 10px 16px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-3);
    font-size: 12px;
  }

  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: auto;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    padding: 12px 14px;
    border-color: rgb(229 72 77 / 0.35);
    color: #ffb4b0;
    font-size: 13px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 12px;
  }

  @media (max-width: 860px) {
    .bar {
      flex-basis: 100%;
      padding-top: 12px;
      border-top: 1px solid rgb(255 255 255 / 0.06);
    }
  }

  @media (max-width: 680px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>

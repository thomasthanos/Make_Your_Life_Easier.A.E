<script lang="ts">
  import type { Job } from "./state.svelte";

  let { job }: { job: Job } = $props();

  const phaseLabel = {
    queued: "Queued",
    resolving: "Finding the latest version…",
    downloading: "Downloading",
    verifying: "Verifying",
    extracting: "Unpacking",
    installing: "Installing",
  };
  const text = $derived(
    job.note && job.phase !== "downloading"
      ? job.note
      : `${phaseLabel[job.phase]}${job.progress !== null && job.phase === "downloading" ? ` ${Math.round(job.progress * 100)}%` : job.phase === "installing" ? "…" : ""}`,
  );
</script>

<div class="job">
  <span class="text" title={job.note}>{text}</span>
  <div class="bar" class:indeterminate={job.progress === null} class:queued={job.phase === "queued"}>
    <div class="fill" style:transform={job.progress === null ? undefined : `scaleX(${job.progress})`}></div>
  </div>
</div>

<style>
  .job {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .text {
    overflow: hidden;
    color: var(--text-2);
    font-size: 11.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    position: relative;
    height: 4px;
    overflow: hidden;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.08);
  }

  .fill {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--accent-grad);
    transform-origin: left center;
    transform: scaleX(0);
    transition: transform 160ms linear;
  }

  .indeterminate .fill {
    width: 35%;
    transition: none;
    animation: sweep 1.2s var(--ease-in-out) infinite;
  }

  .queued .fill {
    opacity: 0;
  }

  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(290%);
    }
  }
</style>

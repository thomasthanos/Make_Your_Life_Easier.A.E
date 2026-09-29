<script lang="ts">
  import type { Strength } from "./api";

  let { strength, compact = false }: { strength: Strength; compact?: boolean } = $props();

  const labels: Record<Strength, string> = { none: "No password", weak: "Weak", fair: "Fair", strong: "Strong" };
  const filled = $derived({ none: 0, weak: 1, fair: 2, strong: 3 }[strength]);
</script>

<span class="meter {strength}" class:compact title="Password strength: {labels[strength]}">
  <span class="bars" aria-hidden="true">
    {#each [1, 2, 3] as bar (bar)}<i class:on={bar <= filled}></i>{/each}
  </span>
  {#if !compact}<span class="label">{labels[strength]}</span>{/if}
</span>

<style>
  .meter {
    --tone: var(--text-3);
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--tone);
  }

  .weak {
    --tone: #ff8f8f;
  }

  .fair {
    --tone: #ffc466;
  }

  .strong {
    --tone: #5fd99a;
  }

  .bars {
    display: inline-flex;
    gap: 3px;
  }

  i {
    width: 14px;
    height: 4px;
    border-radius: 2px;
    background: rgb(255 255 255 / 0.1);
    transition: background var(--dur-med);
  }

  .compact i {
    width: 8px;
    height: 3px;
  }

  i.on {
    background: var(--tone);
    box-shadow: 0 0 6px -1px var(--tone);
  }
</style>

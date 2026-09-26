<script lang="ts">
  import { onMount } from "svelte";
  import { getVersion } from "@tauri-apps/api/app";
  import { isTauri } from "@tauri-apps/api/core";
  import PageHeader from "../../lib/components/PageHeader.svelte";
  import { settings } from "../../lib/settings.svelte";

  let version = $state("");

  onMount(() => {
    if (isTauri()) void getVersion().then((v) => (version = v));
  });
</script>

<PageHeader title="Settings" subtitle="Preferences for this device." />

<div class="list">
  <label class="row surface">
    <span class="text">
      <span class="title">Reduce transparency</span>
      <span class="desc">Turns off the blur. Useful on older graphics hardware.</span>
    </span>
    <input
      type="checkbox"
      class="switch"
      checked={settings.perfLite}
      onchange={(e) => settings.setPerfLite(e.currentTarget.checked)}
    />
  </label>

  <div class="row surface">
    <span class="text">
      <span class="title">Version</span>
      <span class="desc">Updates are checked every time the app starts.</span>
    </span>
    <span class="value selectable">{version ? `v${version}` : "dev preview"}</span>
  </div>
</div>

<style>
  .list {
    display: grid;
    gap: 8px;
    max-width: 720px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 14px 16px;
  }

  .text {
    display: grid;
    gap: 2px;
  }

  .title {
    font-weight: 500;
  }

  .desc {
    font-size: 12.5px;
    color: var(--text-3);
  }

  .value {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text-2);
  }

</style>

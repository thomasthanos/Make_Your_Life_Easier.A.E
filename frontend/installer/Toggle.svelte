<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    hint,
    disabled = false,
  }: { checked?: boolean; label: string; hint?: string; disabled?: boolean } = $props();
</script>

<label class="toggle" class:disabled>
  <span class="text">
    <span class="label">{label}</span>
    {#if hint}<span class="hint">{hint}</span>{/if}
  </span>
  <!-- The app's own switch (styles/controls.css), as in Settings. -->
  <input class="switch" type="checkbox" role="switch" bind:checked {disabled} />
</label>

<style>
  .toggle {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 9px 12px;
    border-radius: 11px;
    cursor: pointer;
    transition: background var(--dur-fast);
  }

  .toggle:hover {
    background: rgb(255 255 255 / 0.035);
  }

  .toggle.disabled {
    opacity: 0.5;
    cursor: default;
  }

  .text {
    display: grid;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .label {
    font-size: 13px;
    font-weight: 500;
  }

  .hint {
    font-size: 11.5px;
    color: var(--text-3);
  }

  .switch:focus-visible {
    outline: 2px solid rgb(139 151 255 / 0.7);
    outline-offset: 2px;
  }

  .switch:checked {
    box-shadow: 0 0 12px -2px var(--accent-glow);
  }
</style>

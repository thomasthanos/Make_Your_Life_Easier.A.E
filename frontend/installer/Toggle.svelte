<script lang="ts">
  import type { Component } from "svelte";

  let {
    checked = $bindable(false),
    label,
    hint,
    disabled = false,
    icon: Icon,
  }: {
    checked?: boolean;
    label: string;
    hint?: string;
    disabled?: boolean;
    icon?: Component;
  } = $props();
</script>

<label class="toggle" class:disabled class:checked>
  {#if Icon}<span class="icon"><Icon size={16} strokeWidth={1.8} /></span>{/if}
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
    gap: 10px;
    min-width: 0;
    padding: 9px 10px;
    border: 1px solid rgb(255 255 255 / 0.055);
    border-radius: 13px;
    background: linear-gradient(150deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.018));
    cursor: pointer;
    transition:
      background var(--dur-fast),
      border-color var(--dur-fast),
      transform var(--dur-fast);
  }

  .toggle:hover {
    border-color: rgb(255 255 255 / 0.11);
    background: linear-gradient(150deg, rgb(255 255 255 / 0.065), rgb(255 255 255 / 0.028));
  }

  .toggle:active {
    transform: translateY(1px);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex: none;
    border-radius: 9px;
    color: var(--text-3);
    background: rgb(255 255 255 / 0.045);
    transition:
      color var(--dur-fast),
      background var(--dur-fast),
      box-shadow var(--dur-fast);
  }

  .toggle.checked .icon {
    color: #dce0ff;
    background: rgb(var(--accent-rgb) / 0.16);
    box-shadow: inset 0 0 0 1px rgb(var(--accent-rgb) / 0.12);
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
    line-height: 1.25;
  }

  .hint {
    font-size: 11.5px;
    color: var(--text-3);
  }

  .switch:focus-visible {
    outline: 2px solid rgb(var(--accent-rgb) / 0.7);
    outline-offset: 2px;
  }

  .switch:checked {
    box-shadow: 0 0 12px -2px var(--accent-glow);
  }
</style>

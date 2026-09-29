<script lang="ts">
  import { onMount } from "svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import { readJson, writeJson } from "../../../lib/storage";
  import { passwordsApi as api, type GeneratorOptions, type Strength } from "./api";
  import { passwords as p } from "./state.svelte";
  import StrengthMeter from "./StrengthMeter.svelte";

  /** `onuse` puts the password in the entry being edited. */
  let { onuse }: { onuse?: (password: string) => void } = $props();

  const KEY = "myle.passwords.generator";
  let options = $state<GeneratorOptions>(
    readJson(KEY, { length: 20, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false }),
  );
  let value = $state("");
  let strength = $state<Strength>("none");

  async function next() {
    try {
      value = await api.generate(options);
      strength = await api.strength(value);
      writeJson(KEY, options);
    } catch (error) {
      value = "";
      strength = "none";
      p.error = error instanceof Error ? error.message : String(error);
    }
  }

  onMount(() => void next());

  const kinds = [
    ["lower", "a-z"],
    ["upper", "A-Z"],
    ["digits", "0-9"],
    ["symbols", "!@#"],
  ] as const;
</script>

<div class="generator">
  <div class="result">
    <span class="value selectable">{value || "—"}</span>
    <button type="button" class="icon-btn" title="New password" aria-label="New password" onclick={next}><RefreshCw size={15} /></button>
  </div>
  <StrengthMeter {strength} />

  <label class="length">
    <span>Length <strong>{options.length}</strong></span>
    <input type="range" min="8" max="64" bind:value={options.length} oninput={next} />
  </label>

  <div class="kinds">
    {#each kinds as [key, label] (key)}
      <button type="button"
        class="chip"
        class:active={options[key]}
        aria-pressed={options[key]}
        onclick={() => ((options[key] = !options[key]), next())}>{label}</button
      >
    {/each}
    <button type="button"
      class="chip"
      class:active={options.avoidAmbiguous}
      aria-pressed={options.avoidAmbiguous}
      title="Leave out l, 1, I, O, 0 and similar"
      onclick={() => ((options.avoidAmbiguous = !options.avoidAmbiguous), next())}>No look-alikes</button
    >
  </div>

  <div class="actions">
    <button type="button" class="btn" disabled={!value} onclick={() => p.copyText(value)}><Copy size={14} /> Copy</button>
    {#if onuse}
      <button type="button" class="btn primary" disabled={!value} onclick={() => onuse?.(value)}>Use this password</button>
    {/if}
  </div>
</div>

<style>
  .generator {
    display: grid;
    gap: 12px;
    width: 320px;
    padding: 14px;
  }

  .result {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 6px 8px 12px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 10px;
    background: rgb(0 0 0 / 0.25);
  }

  .value {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: 13.5px;
    line-height: 1.4;
  }

  .length {
    display: grid;
    gap: 6px;
    color: var(--text-2);
    font-size: 12px;
  }

  .length strong {
    color: var(--text-1);
  }

  input[type="range"] {
    width: 100%;
    accent-color: var(--accent);
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .kinds .chip {
    height: 26px;
    padding: 0 10px;
    font-size: 11.5px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>

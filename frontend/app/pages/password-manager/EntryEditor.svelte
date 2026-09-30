<script lang="ts">
  import { onMount, untrack } from "svelte";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Plus from "@lucide/svelte/icons/plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Star from "@lucide/svelte/icons/star";
  import X from "@lucide/svelte/icons/x";
  import Popover from "../../../lib/components/Popover.svelte";
  import { passwordsApi as api, type AppLink, type Strength } from "./api";
  import Generator from "./Generator.svelte";
  import { passwords as p } from "./state.svelte";
  import StrengthMeter from "./StrengthMeter.svelte";

  let { id }: { id: string | null } = $props();

  // Keyed by entry in the parent: a new editor opens for another entry.
  const existing = untrack(() => (id ? p.entry(id) : null));
  let title = $state(existing?.title ?? "");
  let username = $state(existing?.username ?? "");
  /** `null` until typed or loaded: an unchanged password is not sent back. */
  let password = $state<string | null>(null);
  let urls = $state<string[]>(existing?.urls.length ? [...existing.urls] : [""]);
  let apps = $state<AppLink[]>(existing ? existing.apps.map((a) => ({ ...a })) : []);
  let notes = $state(existing?.notes ?? "");
  let folder = $state(existing?.folder ?? "");
  let favorite = $state(existing?.favorite ?? false);
  let show = $state(false);
  let strength = $state<Strength>(existing?.strength ?? "none");
  let generatorOpen = $state(false);
  let newApp = $state("");
  let saving = $state(false);
  let titleInput = $state<HTMLInputElement>();

  onMount(async () => {
    titleInput?.focus();
    if (id && existing?.hasPassword) password = await api.reveal(id).catch(() => null);
  });

  $effect(() => {
    const value = password ?? "";
    void api.strength(value).then((s) => {
      if (value === (password ?? "")) strength = s;
    });
  });

  function addApp() {
    const raw = newApp.trim().replace(/^"|"$/g, "").replaceAll("/", "\\");
    const exe = raw.split("\\").pop() ?? "";
    if (!exe) return;
    const linked = /^(?:[a-z]:\\|\\\\)/i.test(raw) ? raw : exe;
    const withExe = (name: string) => (name.toLowerCase().endsWith(".exe") ? name : `${name}.exe`);
    const file = withExe(linked);
    // A full path takes the place of the same program added by name only.
    if (linked !== exe) {
      apps = apps.filter((app) => app.exe.toLowerCase() !== withExe(exe).toLowerCase());
    }
    if (!apps.some((a) => a.exe.toLowerCase() === file.toLowerCase())) {
      apps = [...apps, { exe: file, name: exe.replace(/\.exe$/i, "") }];
    }
    newApp = "";
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!title.trim() || saving) return;
    saving = true;
    const ok = await p.save({
      id: id ?? undefined,
      title,
      username,
      password: password ?? undefined,
      urls: urls.map((u) => u.trim()).filter(Boolean),
      apps,
      notes,
      folder,
      favorite,
    });
    saving = false;
    if (ok) password = null;
  }

  function cancel() {
    p.panel = id ? { kind: "view", id } : { kind: "none" };
  }
</script>

<form class="editor" onsubmit={submit}>
  <header>
    <h2>{id ? "Edit entry" : "New entry"}</h2>
    <button
      type="button"
      class="icon-btn star"
      class:on={favorite}
      aria-pressed={favorite}
      title="Favorite"
      aria-label="Favorite"
      onclick={() => (favorite = !favorite)}><Star size={16} /></button
    >
  </header>

  <label class="field">
    <span>Name</span>
    <input class="input" bind:value={title} bind:this={titleInput} placeholder="GitHub, Steam, Bank…" required />
  </label>

  <label class="field">
    <span>Email or user name</span>
    <input class="input" bind:value={username} autocomplete="off" spellcheck="false" />
  </label>

  <div class="field">
    <span>Password</span>
    <div class="password-row">
      <input
        class="input mono"
        type={show ? "text" : "password"}
        value={password ?? ""}
        oninput={(e) => (password = e.currentTarget.value)}
        autocomplete="new-password"
        spellcheck="false"
      />
      <button type="button" class="icon-btn" title={show ? "Hide" : "Show"} aria-label={show ? "Hide password" : "Show password"} onclick={() => (show = !show)}>
        {#if show}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
      </button>
      <Popover align="end" bind:open={generatorOpen}>
        {#snippet trigger({ toggle })}
          <button type="button" class="btn small" onclick={toggle}><Sparkles size={13} /> Generate</button>
        {/snippet}
        {#snippet children({ close })}
          <div class="menu">
            <Generator
              onuse={(value) => {
                password = value;
                show = true;
                close();
              }}
            />
          </div>
        {/snippet}
      </Popover>
    </div>
    <StrengthMeter {strength} />
  </div>

  <div class="field">
    <span>Websites</span>
    {#each urls as _, i (i)}
      <div class="row">
        <input class="input" bind:value={urls[i]} placeholder="https://example.com" spellcheck="false" />
        {#if urls.length > 1}
          <button type="button" class="icon-btn" aria-label="Remove website" onclick={() => (urls = urls.filter((_, j) => j !== i))}><X size={14} /></button>
        {/if}
      </div>
    {/each}
    <button type="button" class="add" onclick={() => (urls = [...urls, ""])}><Plus size={13} /> Another website</button>
  </div>

  <div class="field">
    <span>Windows programs <small>Use the full .exe path for Ctrl+Shift+L filling</small></span>
    {#if apps.length}
      <div class="apps">
        {#each apps as app (app.exe)}
          <span class="app-chip">
            {app.name} <code>{app.exe}</code>
            <button type="button" aria-label="Unlink {app.name}" onclick={() => (apps = apps.filter((a) => a.exe !== app.exe))}><X size={11} /></button>
          </span>
        {/each}
      </div>
    {/if}
    <div class="row">
      <input
        class="input"
        bind:value={newApp}
        placeholder="C:\Program Files\Riot Games\RiotClientUx.exe"
        spellcheck="false"
        onkeydown={(e) => e.key === "Enter" && (e.preventDefault(), addApp())}
      />
      <button type="button" class="btn small" disabled={!newApp.trim()} onclick={addApp}>Link</button>
      {#if p.windowsTarget}
        <button type="button" class="btn small" title={p.windowsTarget.path} onclick={() => ((newApp = p.windowsTarget!.path), addApp())}>Use detected program</button>
      {/if}
    </div>
  </div>

  <div class="two">
    <label class="field">
      <span>Folder</span>
      <input class="input" bind:value={folder} list="password-folders" placeholder="None" />
      <datalist id="password-folders">
        {#each p.folders as name (name)}<option value={name}></option>{/each}
      </datalist>
    </label>
  </div>

  <label class="field">
    <span>Notes</span>
    <textarea class="input notes" bind:value={notes} rows="3"></textarea>
  </label>

  <footer>
    <button type="button" class="btn ghost" onclick={cancel}>Cancel</button>
    <button type="submit" class="btn primary" disabled={!title.trim() || saving}>{id ? "Save" : "Add to vault"}</button>
  </footer>
</form>

<style>
  /* The same readable width as the entry it edits. */
  .editor {
    display: grid;
    gap: 14px;
    width: min(100%, 760px);
    margin: 0 auto;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    font-size: 17px;
  }

  .star.on {
    color: #ffd166;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  .field > span {
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
  }

  .field small {
    margin-left: 6px;
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 400;
  }

  .password-row,
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .password-row .input,
  .row .input {
    flex: 1;
    min-width: 0;
  }

  .mono {
    font-family: var(--font-mono);
  }

  .menu {
    padding: 0;
  }

  .add {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    justify-self: start;
    color: var(--text-3);
    font-size: 12px;
  }

  .add:hover {
    color: var(--text-1);
  }

  .apps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .app-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-width: 0;
    padding: 3px 5px 3px 10px;
    border: 1px solid rgb(var(--accent-rgb) / 0.25);
    border-radius: 999px;
    background: rgb(var(--accent-rgb) / 0.1);
    font-size: 12px;
  }

  .app-chip code {
    min-width: 0;
    overflow: hidden;
    color: var(--text-3);
    font-size: 10.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-chip button {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    flex: none;
    border-radius: 50%;
    color: var(--text-3);
  }

  .app-chip button:hover {
    background: var(--hover);
    color: var(--text-1);
  }

  .notes {
    height: auto;
    padding: 9px 12px;
    resize: vertical;
    line-height: 1.45;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 4px;
  }
</style>

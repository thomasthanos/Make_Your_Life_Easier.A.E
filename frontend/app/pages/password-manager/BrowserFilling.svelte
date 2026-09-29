<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, scale } from "svelte/transition";
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import X from "@lucide/svelte/icons/x";
  import { portal } from "../../../lib/portal";
  import { toast } from "../../../lib/toast.svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { passwordsApi as api, type BrowserSetup } from "./api";

  /** The extension's store page, once it is published (package.json). */
  const storeUrl: string = import.meta.env.VITE_EXTENSION_URL ?? "";

  let { onclose }: { onclose: () => void } = $props();

  let setup = $state<BrowserSetup | null>(null);
  let saving = $state(false);
  let setupError = $state<string | null>(null);

  onMount(async () => {
    try {
      setup = await api.browserGet();
      setupError = setup.registrationError;
    } catch (error) {
      setupError = error instanceof Error ? error.message : String(error);
    }
  });

  async function toggle(enabled: boolean) {
    if (!setup) return;
    saving = true;
    try {
      await api.browserSet(enabled);
      setup = { ...setup, enabled, registrationError: null };
      setupError = null;
      toast.success(enabled ? "Browser filling is on." : "Browser filling is off.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      saving = false;
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    toast.success("Copied.");
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && onclose()} />

<div class="backdrop" role="presentation" transition:fade={{ duration: 140 }} {@attach portal}>
  <div
    class="dialog glass glass--3"
    role="dialog"
    aria-modal="true"
    aria-labelledby="browser-filling-title"
    transition:scale={{ start: 0.96, duration: 180, easing: cubicOut }}
  >
    <div class="dialog-body">
      <header>
        <h2 id="browser-filling-title">Fill in logins in your browser</h2>
        <button type="button" class="icon-btn" aria-label="Close" onclick={onclose}><X size={16} /></button>
      </header>

      <label class="toggle">
        <span>
          <strong>Browser filling</strong>
          <small>Chrome, Edge and Firefox can ask for the logins saved for the site you are on, while your vault is unlocked.</small>
        </span>
        <input
          type="checkbox"
          class="switch"
          checked={setup?.enabled ?? false}
          disabled={!setup || saving}
          onchange={(e) => toggle(e.currentTarget.checked)}
        />
      </label>

      {#if setupError}<p class="setup-error">Could not register the browser connection: {setupError}</p>{/if}

      <section>
        <h3>Add the extension</h3>
        {#if storeUrl.startsWith("https://")}
          <button type="button" class="btn primary small store" onclick={() => void openUrl(storeUrl).catch(() => {})}>
            <Download size={13} /> Get the extension
          </button>
          <p class="or">Or load it from its folder:</p>
        {/if}
        <div class="path">
          <code class="selectable" title={setup?.extensionDir ?? undefined}>{setup?.extensionDir ?? "The extension's folder was not found."}</code>
          {#if setup?.extensionDir}
            <button type="button" class="icon-btn" title="Copy the folder" aria-label="Copy the folder" onclick={() => copy(setup!.extensionDir!)}><Copy size={14} /></button>
            <button type="button" class="btn small" onclick={() => api.openExtensionDir()}><FolderOpen size={13} /> Open</button>
          {/if}
        </div>

        <div class="browser">
          <strong>Chrome, Edge, Brave</strong>
          <ol>
            <li>
              Open
              <button type="button" class="link" onclick={() => copy("chrome://extensions")}><code>chrome://extensions</code></button>
              (Edge: <button type="button" class="link" onclick={() => copy("edge://extensions")}><code>edge://extensions</code></button>) in the address bar.
            </li>
            <li>Turn on <b>Developer mode</b>.</li>
            <li><b>Load unpacked</b>, and choose the folder above.</li>
          </ol>
        </div>

        <div class="browser">
          <strong>Firefox</strong>
          <ol>
            <li>
              Open
              <button type="button" class="link" onclick={() => copy("about:debugging#/runtime/this-firefox")}><code>about:debugging</code></button>
              → This Firefox.
            </li>
            <li><b>Load Temporary Add-on</b>, and choose <code>firefox/manifest.json</code> inside the folder above.</li>
          </ol>
          <p class="hint">Firefox keeps it until it restarts; a signed version that stays comes later.</p>
        </div>
      </section>

      <p class="hint">
        Click a user name or password field on a sign-in page, and pick the login. Nothing is filled in without your
        click, only on secure (https) pages, and only with logins saved for that site.
      </p>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 91;
    display: grid;
    place-items: center;
    padding: clamp(12px, 3vh, 24px);
    background: rgb(4 6 12 / 0.58);
  }

  /* Never set overflow on a .glass element: .glass::before sits at inset: -1px
     and would cause a permanent 1px scrollbar. */
  .dialog {
    display: flex;
    flex-direction: column;
    width: min(520px, 100%);
    max-height: calc(100dvh - clamp(24px, 6vh, 48px));
    border-radius: var(--radius-xl);
  }

  .dialog-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(10px, 1.8vh, 14px);
    min-height: 0;
    padding: clamp(16px, 2.5vh, 20px);
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: none;
    border-radius: inherit;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  header :global(.icon-btn) {
    flex: none;
  }

  h2 {
    min-width: 0;
    margin: 0;
    font-size: 17px;
  }

  h3 {
    margin: 0;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
    padding: 12px 14px;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: 12px;
    background: rgb(0 0 0 / 0.16);
    cursor: pointer;
  }

  .toggle span {
    display: grid;
    flex: 1 1 0%;
    min-width: 0;
    gap: 3px;
  }

  .toggle small {
    color: var(--text-3);
    font-size: 12px;
    line-height: 1.4;
    overflow-wrap: break-word;
  }

  .toggle .switch {
    flex: none;
  }

  section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(8px, 1.5vh, 12px);
    min-width: 0;
  }

  .store {
    justify-self: start;
  }

  .or {
    margin: 0;
    color: var(--text-3);
    font-size: 12px;
  }

  .path {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    padding: 6px 6px 6px 10px;
    border: 1px solid rgb(255 255 255 / 0.06);
    border-radius: 10px;
    background: rgb(0 0 0 / 0.22);
  }

  .path code {
    flex: 1 1 0%;
    min-width: 0;
    overflow: hidden;
    font-size: 11.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path button {
    flex: none;
  }

  .browser {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    min-width: 0;
  }

  .browser strong {
    font-size: 13px;
  }

  ol {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    min-width: 0;
    margin: 2px 0 0;
    padding-left: 20px;
    color: var(--text-2);
    font-size: 12.5px;
    line-height: 1.45;
  }

  li {
    min-width: 0;
    overflow-wrap: break-word;
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .link {
    display: inline;
    padding: 0;
    color: #b9c2ff;
  }

  .link:hover {
    text-decoration: underline;
  }

  .hint {
    min-width: 0;
    margin: 0;
    color: var(--text-3);
    font-size: 11.5px;
    line-height: 1.5;
    overflow-wrap: break-word;
  }

  .setup-error {
    min-width: 0;
    margin: 0;
    color: #ffb6a8;
    font-size: 12px;
    overflow-wrap: break-word;
  }

  @media (max-width: 480px) {
    .path {
      flex-wrap: wrap;
    }

    .path code {
      flex-basis: 100%;
    }
  }
</style>

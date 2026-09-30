<script lang="ts">
  import { onMount, tick } from "svelte";
  import Fingerprint from "@lucide/svelte/icons/fingerprint";
  import LifeBuoy from "@lucide/svelte/icons/life-buoy";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import LockKeyholeOpen from "@lucide/svelte/icons/lock-keyhole-open";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import { passwords as p } from "./state.svelte";

  let recovering = $state(false);
  let master = $state("");
  let code = $state("");
  let newMaster = $state("");
  /** The new master password again: one typo would lock the vault. */
  let newAgain = $state("");
  const mismatch = $derived(newAgain.length > 0 && newAgain !== newMaster);
  let input = $state<HTMLInputElement>();
  let helloButton = $state<HTMLButtonElement>();

  onMount(async () => {
    await tick();
    // Windows Hello first when it is on: one key press opens the vault.
    (p.hello.enabled ? helloButton : input)?.focus();
    // Just came to the page: Windows Hello asks at once.
    if (p.takeHelloOnOpen() && !p.busy) void p.unlockWithHello(true);
  });

  async function unlockWithHello() {
    if (p.busy) return;
    await p.unlockWithHello();
  }

  async function unlock(event: SubmitEvent) {
    event.preventDefault();
    if (!master || p.busy) return;
    if (await p.unlock(master)) master = "";
    else input?.select();
  }

  async function recover(event: SubmitEvent) {
    event.preventDefault();
    if (!code || !newMaster || newAgain !== newMaster || p.busy) return;
    if (await p.recover(code, newMaster)) {
      code = "";
      newMaster = "";
      newAgain = "";
    }
  }
</script>

<section class="unlock glass">
  <span class="lock" class:open={p.busy}>
    {#if p.busy}<LockKeyholeOpen size={26} />{:else}<LockKeyhole size={26} />{/if}
  </span>

  {#if !recovering}
    <h2>Your vault is locked</h2>
    {#if p.hello.enabled}
      <p>Open it with Windows Hello, or with your master password.</p>
      <button class="btn primary hello" bind:this={helloButton} disabled={p.busy} onclick={unlockWithHello}>
        {#if p.busy}<LoaderCircle size={16} class="spin" /> Waiting for Windows Hello…{:else}<Fingerprint size={16} /> Unlock with Windows Hello{/if}
      </button>
      <div class="or"><span>or</span></div>
    {:else}
      <p>Enter your master password to open it.</p>
    {/if}
    <form onsubmit={unlock}>
      <input
        class="input"
        type="password"
        autocomplete="current-password"
        placeholder="Master password"
        bind:value={master}
        bind:this={input}
      />
      {#if p.error}<p class="error">{p.error}</p>{/if}
      <button class="btn" class:primary={!p.hello.enabled} type="submit" disabled={!master || p.busy}>
        {#if p.busy && !p.hello.enabled}<LoaderCircle size={15} class="spin" /> Unlocking…{:else}Unlock{/if}
      </button>
    </form>
    <button class="link" onclick={() => ((recovering = true), (p.error = null))}>
      <LifeBuoy size={13} /> Forgot it? Use your recovery code
    </button>
  {:else}
    <h2>Use your recovery code</h2>
    <p>It opens the vault and sets a new master password.</p>
    <form onsubmit={recover}>
      <input class="input mono" placeholder="XXXX-XXXX-XXXX-…" bind:value={code} spellcheck="false" />
      <input class="input" type="password" autocomplete="new-password" placeholder="New master password (10+ characters)" bind:value={newMaster} />
      <input class="input" type="password" autocomplete="new-password" placeholder="Type it again" bind:value={newAgain} />
      {#if mismatch}<p class="error">The two passwords are not the same.</p>
      {:else if p.error}<p class="error">{p.error}</p>{/if}
      <button class="btn primary" type="submit" disabled={!code || !newMaster || newAgain !== newMaster || p.busy}>
        {#if p.busy}<LoaderCircle size={15} class="spin" /> Opening…{:else}Open and set new password{/if}
      </button>
    </form>
    <button class="link" onclick={() => ((recovering = false), (p.error = null))}>Back to the master password</button>
  {/if}
</section>

<style>
  .unlock {
    display: grid;
    justify-items: center;
    gap: 10px;
    width: min(400px, 100%);
    margin: 40px auto 0;
    padding: 30px 28px 22px;
    text-align: center;
  }

  .lock {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    margin-bottom: 4px;
    border-radius: 18px;
    color: #cfd6ff;
    background:
      radial-gradient(circle at 50% 20%, rgb(var(--accent-rgb) / 0.32), transparent 70%),
      rgb(var(--accent-rgb) / 0.1);
    box-shadow: inset 0 0 0 1px rgb(var(--accent-rgb) / 0.25), 0 10px 30px -12px var(--accent-glow);
    transition: transform var(--dur-med) var(--ease-out);
  }

  .lock.open {
    transform: scale(1.06);
  }

  h2 {
    font-size: 18px;
  }

  p {
    color: var(--text-2);
    font-size: 12.5px;
  }

  form {
    display: grid;
    gap: 10px;
    width: 100%;
    margin-top: 8px;
  }

  .input {
    height: 38px;
    text-align: center;
  }

  .mono {
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
  }

  .error {
    color: #ff9d9d;
    font-size: 12px;
  }

  .btn.primary {
    height: 38px;
  }

  .hello {
    width: 100%;
    height: 42px;
    margin-top: 8px;
    font-size: 13.5px;
  }

  .or {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    color: var(--text-3);
    font-size: 11.5px;
  }

  .or::before,
  .or::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgb(255 255 255 / 0.08);
  }

  .link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    color: var(--text-3);
    font-size: 12px;
  }

  .link:hover {
    color: var(--text-1);
  }
</style>

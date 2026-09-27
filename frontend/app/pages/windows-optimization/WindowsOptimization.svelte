<script lang="ts">
  import { onMount } from "svelte";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import Download from "@lucide/svelte/icons/download";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Gauge from "@lucide/svelte/icons/gauge";
  import GitFork from "@lucide/svelte/icons/git-fork";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import LogIn from "@lucide/svelte/icons/log-in";
  import Power from "@lucide/svelte/icons/power";
  import Play from "@lucide/svelte/icons/play";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import UserRound from "@lucide/svelte/icons/user-round";
  import BiosRestartDialog from "./BiosRestartDialog.svelte";
  import LiveConsole from "./LiveConsole.svelte";
  import { windowsOptimizationState as tools } from "./state.svelte";

  onMount(() => {
    void tools.load();
  });

  const state = $derived(tools.snapshot);
  const sparkleProgress = $derived(tools.progressOf("launchSparkle"));
  const sparkleActive = $derived(tools.activeAction === "launchSparkle");
  const cttActive = $derived(tools.activeAction === "launchCtt");
  const autoLogon = $derived(state?.autoLogon);
  const autoLogonActive = $derived(tools.autoLogonBusy);
  const autoLogonAction = $derived(
    tools.autoLogonRequest ?? autoLogon?.activeOperation ?? null,
  );
  const firmwareRestart = $derived(state?.firmwareRestart);
  const firmwareStatus = $derived(tools.firmwareRestartStatus());
  const cancellableDownload = $derived(
    sparkleActive &&
      ["resolvingRelease", "downloading", "verifying", "extracting"].includes(
        tools.activeJob?.stage ?? "",
      ),
  );

  function statusTone(status: string) {
    if (status === "Completed" || status === "Enabled") return "ok";
    if (["Cancelled", "Waiting for UAC", "Conflict", "Unavailable"].includes(status)) return "warn";
    if (status === "Error") return "error";
    if (["Preparing", "Running", "Launching", "Downloading", "Verifying", "Extracting", "Resolving release", "Working", "Processing", "Enabling", "Disabling", "Checking"].includes(status)) return "active";
    return "idle";
  }

  function accountTypeLabel(value: string | undefined) {
    if (value === "microsoft") return "Microsoft account";
    if (value === "domain") return "Domain account";
    if (value === "entra") return "Microsoft Entra";
    if (value === "local") return "Local account";
    return "Windows account";
  }
</script>

<div class="page">
  <div class="top">
    <header>
      <div class="title">
        <span class="title-icon"><Gauge size={19} /></span>
        <h1>Windows Optimization &amp; Debloat</h1>
      </div>
      <p>Use built-in Windows controls or launch trusted tools for system optimization. You stay in control of every change.</p>
    </header>
    <span class="mutex"><ShieldCheck size={13} /> One privileged tool at a time</span>
  </div>

  <div class="warning surface" role="note">
    <CircleAlert size={16} />
    <span>These actions can make system-wide changes. Review every option and create a restore point before applying tweaks.</span>
  </div>

  {#if tools.error}
    <div class="error-banner surface" role="alert"><CircleAlert size={16} /><span>{tools.error}</span></div>
  {/if}
  {#if tools.externallyLocked && !tools.ownBusy}
    <div class="lock-banner surface"><LoaderCircle size={14} class="spin" /><span>Another app task is running. Optimization tools are temporarily locked.</span></div>
  {/if}

  <div class="cards">
    <article class="tool-card surface ctt" class:active={cttActive}>
      <span class="rim"></span>
      <div class="card-head">
        <span class="tool-icon"><img src="/icons/Chris-Titus-Windows-Utility.svg" alt="" width="42" height="42" /></span>
        <div class="identity">
          <div class="name-row"><h2>Chris Titus Utility</h2><span class="badge admin"><ShieldCheck size={11} /> Admin required</span></div>
          <p>Complete Windows toolbox for performance, privacy, software and maintenance.</p>
        </div>
        <span class="status {statusTone(tools.statusOf('launchCtt'))}"><i></i>{tools.statusOf("launchCtt")}</span>
      </div>

      <div class="feature-grid ctt-grid">
        <div>
          <div class="cell-top"><strong>System Tweaks</strong><em>01</em></div>
          <span>Responsiveness &amp; OS config</span>
        </div>
        <div>
          <div class="cell-top"><strong>Privacy &amp; Security</strong><em>02</em></div>
          <span>Telemetry &amp; policy controls</span>
        </div>
        <div>
          <div class="cell-top"><strong>Bloatware Removal</strong><em>03</em></div>
          <span>Remove preinstalled apps</span>
        </div>
        <div>
          <div class="cell-top"><strong>Fixes &amp; Updates</strong><em>04</em></div>
          <span>Maintenance &amp; repair tools</span>
        </div>
      </div>

      <div class="info-box trust-note">
        <CircleAlert size={15} />
        <div>
          <strong>Official remote bootstrap</strong>
          <p>Executes the official script directly. Confirmation is required before launch.</p>
        </div>
      </div>

      <div class="actions">
        <button class="btn primary launch" disabled={tools.locked} onclick={() => tools.launchCtt()}>
          {#if cttActive}<LoaderCircle size={14} class="spin" /> Running{:else}<Play size={14} /> Launch Tool{/if}
        </button>
        <button class="btn github" disabled={tools.ownBusy} onclick={() => tools.openGithub("ctt")}><GitFork size={14} /> GitHub <ExternalLink size={11} /></button>
      </div>
    </article>

    <article class="tool-card surface sparkle" class:active={sparkleActive}>
      <span class="rim"></span>
      <div class="card-head">
        <span class="tool-icon"><img src="/icons/Sparkle.svg" alt="" width="42" height="42" /></span>
        <div class="identity">
          <div class="name-row"><h2>Sparkle</h2><span class="badge portable">Portable Tool</span><span class="badge beta">Beta</span></div>
          <p>Debloat and optimize Windows through a verified portable release.</p>
        </div>
        <span class="status {statusTone(tools.statusOf('launchSparkle'))}"><i></i>{tools.statusOf("launchSparkle")}</span>
      </div>

      <div class="feature-grid sparkle-grid">
        <div>
          <div class="cell-top"><strong>Remove Bloatware</strong><em>01</em></div>
          <span>Windows and OEM apps</span>
        </div>
        <div>
          <div class="cell-top"><strong>Privacy &amp; Telemetry</strong><em>02</em></div>
          <span>Tracking and suggestions</span>
        </div>
        <div>
          <div class="cell-top"><strong>Performance Tweaks</strong><em>03</em></div>
          <span>Background and startup load</span>
        </div>
        <div>
          <div class="cell-top"><strong>Portable Release</strong><em>04</em></div>
          <span>Verified local GitHub cache</span>
        </div>
      </div>

      <div class="info-box cache surface">
        <span class="cache-icon" class:ready={state?.sparkle.cached}>{#if state?.sparkle.cached}<ShieldCheck size={15} />{:else}<Download size={15} />{/if}</span>
        <div>
          <strong>{tools.loading && !state ? "Checking portable cache…" : state?.sparkle.cached ? "Ready to launch" : "Downloads automatically on first use"}</strong>
          <p>{state?.sparkle.cached ? `Verified Sparkle ${state.sparkle.version ?? "build"}` : "The latest stable portable ZIP will be verified before extraction."}</p>
        </div>
      </div>

      {#if sparkleActive}
        <div class="progress-block">
          <div class="progress-label"><span>{tools.statusOf("launchSparkle")}</span><strong>{sparkleProgress !== null ? `${Math.round(sparkleProgress * 100)}%` : tools.transferOf("launchSparkle") ?? "Working…"}</strong></div>
          <div class="track" role="progressbar" aria-label="Sparkle operation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={sparkleProgress !== null ? Math.round(sparkleProgress * 100) : undefined}>
            <span class:indeterminate={sparkleProgress === null} style:width={sparkleProgress !== null ? `${sparkleProgress * 100}%` : "28%"}></span>
          </div>
          {#if tools.transferOf("launchSparkle")}<small>{tools.transferOf("launchSparkle")}</small>{/if}
        </div>
      {/if}

      <div class="actions">
        {#if sparkleActive}
          <button class="btn danger launch" disabled={tools.stopping || !tools.activeJob} onclick={() => tools.cancel()}>
            {tools.stopping ? "Stopping…" : cancellableDownload ? "Cancel download" : "Stop"}
          </button>
        {:else}
          <button class="btn primary launch" disabled={tools.locked} onclick={() => tools.launchSparkle()}><Sparkles size={14} /> Launch Sparkle</button>
        {/if}
        <button class="btn github" disabled={tools.ownBusy} onclick={() => tools.openGithub("sparkle")}><GitFork size={14} /> GitHub <ExternalLink size={11} /></button>
      </div>
    </article>

    <article class="tool-card surface autologon" class:active={autoLogonActive}>
      <span class="rim"></span>
      <div class="card-head">
        <span class="tool-icon"><img src="/icons/Windows-AutoLogon.svg" alt="" width="42" height="42" /></span>
        <div class="identity">
          <div class="name-row">
            <h2>Windows Auto-Logon</h2>
            <span class="badge admin"><ShieldCheck size={11} /> Admin required</span>
          </div>
          <p>Sign in to the current Windows account automatically after startup.</p>
        </div>
        <span class="status {statusTone(tools.autoLogonStatus())}"><i></i>{tools.autoLogonStatus()}</span>
      </div>

      <div class="account surface" class:account-conflict={autoLogon?.status === "conflict"}>
        <span class="account-icon"><UserRound size={18} /></span>
        <div class="account-copy">
          <span>Current Windows user</span>
          <strong>{autoLogon?.displayName || "Detecting current user…"}</strong>
          <code>{autoLogon?.accountName || "Waiting for Windows account details"}</code>
        </div>
        <span class="badge account-type">{accountTypeLabel(autoLogon?.accountType)}</span>
      </div>

      <div class="auto-details">
        <div>
          <ShieldCheck size={13} />
          <div>
            <strong>SID Verified</strong>
            <span>No extra account created</span>
          </div>
        </div>
        <div>
          <KeyRound size={13} />
          <div>
            <strong>Native Control</strong>
            <span>Built directly into app</span>
          </div>
        </div>
      </div>

      {#if autoLogon?.status === "conflict"}
        <div class="info-box auto-message conflict" role="alert">
          <CircleAlert size={15} />
          <div>
            <strong>Account conflict detected</strong>
            <p>Configured for <strong>{autoLogon.configuredUser ?? "another account"}</strong>. You can safely disable it below.</p>
          </div>
        </div>
      {:else if autoLogon?.blockedReason}
        <div class="info-box auto-message unavailable" role="note">
          <CircleAlert size={15} />
          <div>
            <strong>Auto-Logon unavailable</strong>
            <p>{autoLogon.blockedReason}</p>
          </div>
        </div>
      {:else}
        <div class="info-box auto-message secure">
          <KeyRound size={15} />
          <div>
            <strong>Zero-knowledge credential prompt</strong>
            <p>Windows asks for your password directly; credentials never pass through IPC.</p>
          </div>
        </div>
      {/if}

      <div class="actions auto-actions">
        <button
          class="btn primary launch"
          disabled={tools.locked || autoLogon?.status !== "disabled"}
          onclick={() => tools.setAutoLogon(true)}
        >
          {#if autoLogonAction === "enable"}<LoaderCircle size={14} class="spin" /> Enabling…{:else}<LogIn size={14} /> Enable Auto-Logon{/if}
        </button>
        <button
          class="btn disable"
          disabled={tools.locked || !autoLogon?.accountName || autoLogon?.status === "disabled"}
          onclick={() => tools.setAutoLogon(false)}
        >
          {#if autoLogonAction === "disable"}<LoaderCircle size={14} class="spin" /> Disabling…{:else}<Power size={14} /> Disable{/if}
        </button>
      </div>
    </article>
  </div>

  <section class="console-drawer surface" aria-label="Chris Titus Utility live console">
    <LiveConsole />
  </section>

  <section
    class="firmware-action surface"
    class:active={tools.firmwareRestartBusy}
    aria-labelledby="firmware-action-title"
  >
    <span class="firmware-rim" aria-hidden="true"></span>
    <span class="tool-icon firmware-icon"><img src="/icons/Restart-to-BIOS.svg" alt="" width="42" height="42" /></span>
    <div class="firmware-copy">
      <div class="firmware-title">
        <h2 id="firmware-action-title">Restart to BIOS / UEFI</h2>
        <span class="badge firmware-badge">BIOS / UEFI</span>
        <span class="badge admin"><ShieldCheck size={11} /> Admin required</span>
      </div>
      <p>
        {#if firmwareRestart?.available}
          Restart directly into this PC's UEFI firmware settings—no startup key required.
        {:else if firmwareRestart?.blockedReason}
          {firmwareRestart.blockedReason}
        {:else}
          Checking whether this Windows installation supports direct UEFI startup…
        {/if}
      </p>
    </div>
    <span class="firmware-status status {statusTone(firmwareStatus)}"><i></i>{firmwareStatus}</span>
    <button
      class="btn firmware-button"
      disabled={tools.locked || !firmwareRestart?.available}
      onclick={() => tools.openBiosDialog()}
    >
      {#if tools.firmwareRestartBusy}
        <LoaderCircle size={14} class="spin" /> Processing…
      {:else}
        <RotateCw size={14} /> Restart to BIOS
      {/if}
    </button>
  </section>
</div>

{#if tools.biosDialogOpen}<BiosRestartDialog />{/if}

<style>
  .page { min-width: 0; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
  header { min-width: 0; }
  .title { display: flex; align-items: center; gap: 10px; }
  .title-icon { display: grid; place-items: center; width: 31px; height: 31px; border: 1px solid rgb(139 151 255 / 0.22); border-radius: 10px; background: rgb(121 138 255 / 0.1); color: rgb(176 188 255 / 0.95); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08); }
  h1 { font-size: 24px; }
  header > p { margin: 5px 0 0 41px; color: var(--text-2); font-size: 12.5px; }
  .mutex { display: inline-flex; align-items: center; gap: 6px; flex: none; margin-top: 4px; padding: 5px 9px; border: 1px solid rgb(255 255 255 / 0.07); border-radius: 999px; background: rgb(255 255 255 / 0.035); color: var(--text-3); font-size: 10.5px; }
  .warning, .error-banner, .lock-banner { display: flex; align-items: center; gap: 9px; margin-top: 18px; padding: 10px 12px; color: rgb(229 218 176 / 0.78); font-size: 11.5px; }
  .warning :global(svg) { color: rgb(241 187 84 / 0.9); flex: none; }
  .error-banner { color: rgb(255 170 170 / 0.9); }
  .lock-banner { color: var(--text-2); }

  /* 3-Column Equal Height Grid */
  .cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
    gap: 14px;
    margin-top: 16px;
  }
  .tool-card {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    padding: 18px;
    box-shadow: var(--elev-1);
    transition: transform var(--dur-med) var(--ease-out), border-color var(--dur-fast), box-shadow var(--dur-med);
  }
  .tool-card:hover:not(.active) { transform: translateY(-2px); border-color: rgb(255 255 255 / 0.095); box-shadow: var(--elev-2); }
  .tool-card.active { border-color: rgb(125 151 255 / 0.22); }

  .rim { position: absolute; inset: 0 14% auto; height: 1px; pointer-events: none; }
  .ctt .rim { background: linear-gradient(90deg, transparent, rgb(99 194 255 / 0.62), transparent); box-shadow: 0 0 15px rgb(81 179 255 / 0.25); }
  .sparkle .rim { background: linear-gradient(90deg, transparent, rgb(167 126 255 / 0.66), transparent); box-shadow: 0 0 15px rgb(143 103 255 / 0.25); }
  .autologon .rim { background: linear-gradient(90deg, transparent, rgb(71 217 166 / 0.62), transparent); box-shadow: 0 0 15px rgb(48 199 148 / 0.22); }

  .card-head { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 11px; position: relative; padding-right: 82px; }
  .tool-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 18px -11px rgb(0 0 0 / 0.8); }
  .tool-icon img { width: 100%; height: 100%; display: block; object-fit: cover; }
  .identity { min-width: 0; }
  .identity h2 { font-size: 16px; }
  .identity > p { margin-top: 4px; color: var(--text-2); font-size: 11.5px; line-height: 1.48; min-height: 34px; }
  .name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border: 1px solid rgb(255 255 255 / 0.07); border-radius: 999px; color: var(--text-3); background: rgb(255 255 255 / 0.035); font-size: 9px; font-weight: 600; letter-spacing: 0.02em; }
  .badge.admin { border-color: rgb(94 176 255 / 0.14); color: rgb(142 199 255 / 0.72); }
  .badge.portable { border-color: rgb(149 119 255 / 0.18); color: rgb(190 171 255 / 0.76); }
  .badge.beta { border-color: rgb(240 177 73 / 0.16); color: rgb(239 191 111 / 0.72); }

  .status { position: absolute; top: 1px; right: 0; display: inline-flex; align-items: center; gap: 5px; color: var(--text-3); font-size: 10px; }
  .status i { width: 6px; height: 6px; border-radius: 50%; background: var(--idle); }
  .status.ok i { background: var(--ok); box-shadow: 0 0 7px var(--ok-glow); }
  .status.active i { background: var(--update); box-shadow: 0 0 7px var(--update-glow); }
  .status.warn i { background: #e8ad55; }
  .status.error i { background: var(--danger); }

  /* Unified 2x2 Feature Grids */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 15px;
  }
  .feature-grid > div {
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 10px 11px;
    border: 1px solid rgb(255 255 255 / 0.05);
    border-radius: 10px;
  }
  .ctt-grid > div {
    background: linear-gradient(145deg, rgb(76 169 255 / 0.045), rgb(255 255 255 / 0.014));
  }
  .sparkle-grid > div {
    background: linear-gradient(145deg, rgb(152 116 255 / 0.045), rgb(255 255 255 / 0.015));
  }
  .cell-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .feature-grid strong {
    color: rgb(231 236 251 / 0.88);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cell-top em {
    font-style: normal;
    font-family: var(--font-mono);
    font-size: 8.5px;
    color: rgb(148 163 184 / 0.45);
  }
  .feature-grid span {
    color: var(--text-3);
    font-size: 9.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Unified Info Strip across all 3 cards */
  .info-box {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 54px;
    margin-top: 12px;
    padding: 10px 11px;
    border-radius: 10px;
  }
  .info-box strong {
    display: block;
    font-size: 10.8px;
    font-weight: 600;
    color: rgb(232 238 250 / 0.88);
  }
  .info-box p {
    margin-top: 2px;
    font-size: 9.6px;
    line-height: 1.4;
    color: var(--text-3);
  }

  .trust-note {
    border: 1px solid rgb(96 179 255 / 0.12);
    background: rgb(72 158 245 / 0.04);
  }
  .trust-note :global(svg) {
    flex: none;
    color: rgb(110 190 255 / 0.85);
  }

  .cache {
    border: 1px solid rgb(255 255 255 / 0.055);
    background: rgb(255 255 255 / 0.02);
  }
  .cache-icon { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 8px; background: rgb(105 139 255 / 0.09); color: rgb(139 169 255 / 0.85); }
  .cache-icon.ready { background: rgb(62 207 142 / 0.08); color: rgb(80 214 157 / 0.88); }

  .progress-block { margin-top: 12px; }
  .progress-label { display: flex; justify-content: space-between; gap: 12px; color: var(--text-3); font-size: 10px; }
  .progress-label strong { color: var(--text-2); font-variant-numeric: tabular-nums; }
  .track { overflow: hidden; height: 4px; margin-top: 6px; border-radius: 999px; background: rgb(255 255 255 / 0.06); }
  .track > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #8c78ff, #55cae6); transition: width var(--dur-med) var(--ease-out); }
  .track > span.indeterminate { animation: seek 1.2s ease-in-out infinite alternate; }
  .progress-block > small { display: block; margin-top: 5px; color: var(--text-3); font-size: 9.5px; text-align: right; }

  /* Auto-Logon Specifics */
  .account {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    margin-top: 15px;
    padding: 10px 11px;
  }
  .account.account-conflict { border-color: rgb(237 170 73 / 0.16); }
  .account-icon { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgb(81 215 166 / 0.12); border-radius: 10px; background: rgb(66 204 153 / 0.07); color: rgb(99 224 177 / 0.86); }
  .account-copy { display: grid; min-width: 0; }
  .account-copy > span { color: var(--text-3); font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; }
  .account-copy strong { overflow: hidden; margin-top: 1px; color: rgb(235 241 248 / 0.9); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
  .account-copy code { overflow: hidden; margin-top: 1px; color: var(--text-3); font-family: var(--font-mono); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .badge.account-type { justify-self: end; border-color: rgb(77 209 159 / 0.12); color: rgb(117 218 181 / 0.7); white-space: nowrap; }

  .auto-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .auto-details > div {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid rgb(255 255 255 / 0.045);
    border-radius: 9px;
    background: linear-gradient(145deg, rgb(63 203 151 / 0.035), rgb(255 255 255 / 0.012));
    color: rgb(93 211 167 / 0.72);
  }
  .auto-details :global(svg) { flex: none; }
  .auto-details > div > div { display: grid; min-width: 0; }
  .auto-details strong { color: rgb(228 235 244 / 0.86); font-size: 10.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .auto-details span { color: var(--text-3); font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .auto-message {
    border: 1px solid rgb(255 255 255 / 0.05);
    background: rgb(255 255 255 / 0.018);
  }
  .auto-message :global(svg) { flex: none; }
  .auto-message.secure { border-color: rgb(63 203 151 / 0.11); background: rgb(63 203 151 / 0.03); }
  .auto-message.secure :global(svg) { color: rgb(81 216 165 / 0.8); }
  .auto-message.conflict, .auto-message.unavailable { border-color: rgb(237 170 73 / 0.12); background: rgb(237 170 73 / 0.035); }
  .auto-message.conflict :global(svg), .auto-message.unavailable :global(svg) { color: rgb(236 174 78 / 0.85); }

  /* Card Actions Pinned to Bottom */
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 16px;
  }
  .launch { flex: 1; min-width: 126px; justify-content: center; }
  .github { color: var(--text-2); }
  .disable { color: rgb(225 230 240 / 0.72); }

  /* Full-width Console Drawer */
  .console-drawer {
    margin-top: 12px;
    padding: 4px 14px 8px;
    box-shadow: var(--elev-1);
  }
  .console-drawer :global(.console) {
    margin-top: 0;
    border-top: none;
  }
  .console-drawer :global(.bar) {
    min-height: 36px;
    padding-top: 4px;
  }

  /* Restart to BIOS / UEFI Card */
  .firmware-action {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    padding: 14px 18px;
    overflow: hidden;
    box-shadow: var(--elev-1);
    transition: border-color var(--dur-fast), box-shadow var(--dur-med);
  }
  .firmware-action.active { border-color: rgb(112 157 242 / 0.22); }
  .firmware-rim {
    position: absolute;
    inset: 0 22% auto;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgb(102 163 255 / 0.58), transparent);
    box-shadow: 0 0 14px rgb(86 143 242 / 0.2);
    pointer-events: none;
  }
  .firmware-copy { min-width: 0; }
  .firmware-title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .firmware-title h2 { font-size: 14.5px; }
  .badge.firmware-badge { border-color: rgb(106 165 255 / 0.15); color: rgb(147 188 255 / 0.72); }
  .firmware-copy p {
    overflow: hidden;
    margin-top: 3px;
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .firmware-status.status { position: static; white-space: nowrap; }
  .firmware-button { min-width: 146px; white-space: nowrap; }

  @keyframes seek { from { transform: translateX(-40%); } to { transform: translateX(300%); } }
  :global(:root.perf-lite) .tool-card, :global(:root.perf-lite) .tool-card:hover:not(.active) { transform: none; box-shadow: none; }
  :global(:root.perf-lite) .rim { box-shadow: none; }
  :global(:root.perf-lite) .firmware-action { box-shadow: none; }
  :global(:root.perf-lite) .firmware-rim { box-shadow: none; }
  :global(:root.perf-lite) .track > span.indeterminate { animation: none; }

  @media (max-width: 1150px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 860px) { .cards { grid-template-columns: 1fr; } }
  @media (max-width: 720px) {
    .top { display: block; }
    .mutex { margin: 10px 0 0 41px; }
    .card-head { padding-right: 0; }
    .status { position: static; grid-column: 2; justify-self: start; }
    .firmware-action { grid-template-columns: auto minmax(0, 1fr) auto; }
    .firmware-status.status { grid-column: 2; justify-self: start; }
    .firmware-button { grid-column: 3; grid-row: 1 / span 2; }
  }
  @media (max-width: 520px) {
    .feature-grid, .auto-details { grid-template-columns: 1fr; }
    .account { grid-template-columns: auto minmax(0, 1fr); }
    .account .account-type { grid-column: 2; justify-self: start; }
    .actions { align-items: stretch; flex-direction: column; }
    .auto-actions { display: flex; }
    .actions .btn { width: 100%; }
    .firmware-action { grid-template-columns: auto minmax(0, 1fr); }
    .firmware-status.status { grid-column: 2; }
    .firmware-button { grid-column: 1 / -1; grid-row: auto; width: 100%; }
    .firmware-copy p { white-space: normal; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tool-card, .track > span { transition: none; }
    .tool-card:hover:not(.active) { transform: none; }
    .track > span.indeterminate { animation: none; }
  }
</style>

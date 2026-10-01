<script lang="ts">
  // The guided start: pick a profile, see what it would change, then review
  // and apply from the bar below. Settings and Apps hold the same choices.
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Check from "@lucide/svelte/icons/check";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import X from "@lucide/svelte/icons/x";
  import ProfileCard from "./ProfileCard.svelte";
  import { profilePlan, type Profile } from "./selection";
  import { debloat } from "./state.svelte";

  const cards: { profile: Profile; name: string; tagline: string; text: string }[] = [
    {
      profile: "light",
      name: "Light",
      tagline: "Privacy only",
      text: "Less data sent to Microsoft, no ads or suggested apps, and promotional apps removed. Windows looks and works the same.",
    },
    {
      profile: "recommended",
      name: "Recommended",
      tagline: "Cleaner and quieter",
      text: "Light, plus no Bing or Copilot, fewer apps and services running in the background, and the preinstalled apps few people use removed.",
    },
    {
      profile: "maximum",
      name: "Maximum",
      tagline: "The leanest Windows",
      text: "Recommended, plus location off, taskbar search and Widgets hidden, the classic right-click menu and a few more apps removed.",
    },
  ];
  /** Chips shown per group before "+ N more". */
  const SHOWN = 14;

  const apps = $derived(debloat.status?.apps ?? []);
  const plans = $derived(Object.fromEntries(cards.map((card) => [card.profile, profilePlan(debloat.tweaks, apps, card.profile)])));
  const available = $derived(debloat.tweaks.filter((tweak) => tweak.state !== "unavailable"));
  const applied = $derived(available.filter((tweak) => tweak.state === "applied").length);
  const settingChanges = $derived([
    ...debloat.pending.on.map((tweak) => ({ id: tweak.id, title: tweak.title, on: true })),
    ...debloat.pending.off.map((tweak) => ({ id: tweak.id, title: tweak.title, on: false })),
  ]);
</script>

<div class="optimization-ui quick">
  <p class="lead">
    Pick how far to go. Nothing changes until you review and apply: a restore point comes first, and every change can be undone.
  </p>

  <div class="profiles" role="group" aria-label="Quick setup profiles">
    {#each cards as card (card.profile)}
      <ProfileCard
        {...card}
        settings={plans[card.profile].tweaks.length}
        apps={plans[card.profile].apps.length}
        best={card.profile === "recommended"}
        selected={debloat.profile === card.profile}
        disabled={debloat.locked || !debloat.status}
        onchoose={() => debloat.chooseProfile(card.profile)}
      />
    {/each}
  </div>

  <section class="changes surface" aria-labelledby="changes-title">
    <header>
      <h3 id="changes-title">What will change</h3>
      {#if debloat.pendingCount && !debloat.profile}<span class="custom">Your own choice</span>{/if}
      <span class="customize">
        Customize in
        <button type="button" class="link" onclick={() => (debloat.tab = "settings")}>Settings <ArrowRight size={12} /></button>
        <button type="button" class="link" onclick={() => (debloat.tab = "apps")}>Apps <ArrowRight size={12} /></button>
      </span>
    </header>
    {#if !debloat.status}
      <p class="muted">{debloat.error ? "This PC could not be checked." : "Checking this PC…"}</p>
    {:else if !debloat.pendingCount}
      <p class="muted">Nothing yet. Pick a profile above, or choose settings and apps yourself.</p>
    {:else}
      {#if settingChanges.length}
        <div class="group">
          <span class="group-label">Settings · {settingChanges.length}</span>
          <ul class="chips">
            {#each settingChanges.slice(0, SHOWN) as change (change.id)}
              <li class:off={!change.on}>{#if change.on}<Check size={11} />{:else}<X size={11} />{/if}{change.title}</li>
            {/each}
            {#if settingChanges.length > SHOWN}
              <li class="more"><button type="button" onclick={() => (debloat.reviewing = true)}>+ {settingChanges.length - SHOWN} more</button></li>
            {/if}
          </ul>
        </div>
      {/if}
      {#if debloat.pendingApps.length}
        <div class="group">
          <span class="group-label">Apps to remove · {debloat.pendingApps.length}</span>
          <ul class="chips">
            {#each debloat.pendingApps.slice(0, SHOWN) as app (app.id)}
              <li class="app"><Trash2 size={11} />{app.title}</li>
            {/each}
            {#if debloat.pendingApps.length > SHOWN}
              <li class="more"><button type="button" onclick={() => (debloat.reviewing = true)}>+ {debloat.pendingApps.length - SHOWN} more</button></li>
            {/if}
          </ul>
        </div>
      {/if}
    {/if}
  </section>

  {#if debloat.status}
    <footer class="pc-state">
      <span>{debloat.status.windows.name}</span>
      <span aria-hidden="true">·</span>
      <span>{applied} of {available.length} settings already on</span>
      {#if debloat.undoable.length}
        <button type="button" class="link" disabled={debloat.locked} onclick={() => debloat.undo(debloat.undoable)}>
          <Undo2 size={12} /> Undo everything MYLE changed ({debloat.undoable.length})
        </button>
      {/if}
    </footer>
  {/if}
</div>

<style>
  .quick { gap: 12px; }
  .lead { max-width: 90ch; color: var(--text-2); font-size: 12.5px; line-height: 1.55; }
  .profiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  @container optimization-page (max-width: 600px) { .profiles { grid-template-columns: minmax(0, 1fr); } }

  .changes { display: grid; gap: 10px; padding: 12px 14px; }
  .changes header { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
  .changes h3 { color: var(--text-1); font-size: 13px; font-weight: 600; }
  .custom { padding: 2px 7px; border-radius: 6px; background: rgb(255 255 255 / 0.05); color: var(--text-2); font-size: 10.5px; }
  .customize { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: var(--text-3); font-size: 11.5px; }
  .muted { color: var(--text-2); font-size: 12px; }
  .group { display: grid; gap: 6px; }
  .group-label { color: var(--text-3); font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 0; list-style: none; }
  .chips li { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border: 1px solid rgb(var(--accent-rgb) / 0.2); border-radius: 7px; background: rgb(var(--accent-rgb) / 0.08); color: var(--text-1); font-size: 11.5px; white-space: nowrap; }
  .chips li :global(svg) { flex: none; color: rgb(var(--accent-soft-rgb)); }
  .chips li.off { border-color: rgb(255 255 255 / 0.1); background: rgb(255 255 255 / 0.04); }
  .chips li.off :global(svg) { color: var(--text-3); }
  .chips li.app { border-color: rgb(229 72 77 / 0.2); background: rgb(229 72 77 / 0.06); }
  .chips li.app :global(svg) { color: #ff9ea2; }
  .chips li.more { padding: 0; border: 0; background: none; }
  .chips li.more button { height: 24px; padding: 0 8px; border-radius: 7px; color: rgb(var(--accent-soft-rgb)); font-size: 11.5px; }
  .chips li.more button:hover { background: var(--hover); }

  .link { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 6px; color: rgb(var(--accent-soft-rgb)); font-size: 11.5px; font-weight: 550; }
  .link:hover:not(:disabled) { background: var(--hover); color: var(--text-1); }
  .link:disabled { opacity: 0.45; }

  .pc-state { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; color: var(--text-3); font-size: 11.5px; }
  .pc-state .link { margin-left: auto; }
</style>

<script lang="ts">
  import Gamepad2 from "@lucide/svelte/icons/gamepad-2";
  import HardDrive from "@lucide/svelte/icons/hard-drive";
  import PackagePlus from "@lucide/svelte/icons/package-plus";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import { account } from "../../account/account.svelte";

  const synced = [
    {
      icon: SlidersHorizontal,
      title: "App preferences",
      detail: "Transparency, sidebar, page layouts, filters and sort order",
    },
    {
      icon: PackagePlus,
      title: "Install Apps",
      detail: "The apps you checked and the catalog picks you pinned",
    },
    {
      icon: Gamepad2,
      title: "Game Saves setup",
      detail: "Custom games, the backup schedule and each game's auto-backup switch",
    },
  ];
</script>

<section class="panel" aria-labelledby="synced-title">
  <header>
    <h2 id="synced-title">What's saved</h2>
    <span class="scope" class:on={account.signedIn}>
      {account.signedIn ? "Synced to your account" : "Saved on this PC only"}
    </span>
  </header>

  <ul>
    {#each synced as item (item.title)}
      <li>
        <span class="icon"><item.icon size={16} /></span>
        <span class="text">
          <strong>{item.title}</strong>
          <small>{item.detail}</small>
        </span>
        <span class="chip" class:synced={account.signedIn}>{account.signedIn ? "Synced" : "This PC"}</span>
      </li>
    {/each}
    <li class="local">
      <span class="icon"><HardDrive size={16} /></span>
      <span class="text">
        <strong>Stays on this PC</strong>
        <small>Backup and game folders, restore locations, the save files themselves and which apps are installed</small>
      </span>
      <span class="chip">This PC</span>
    </li>
  </ul>

  <p class="note">
    When two PCs change settings, the most recent change wins. Game Saves custom games only come over with the save
    folders that exist on this PC.
  </p>
</section>

<style>
  .panel {
    display: grid;
    gap: 12px;
    padding: 18px;
    border: 1px solid rgb(255 255 255 / 0.07);
    border-radius: var(--radius-lg);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0.018));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  h2 {
    font-size: 14.5px;
  }

  .scope {
    color: var(--text-3);
    font-size: 11px;
  }

  .scope.on {
    color: rgb(var(--accent-soft-rgb) / 0.9);
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid rgb(255 255 255 / 0.05);
    border-radius: 11px;
    background: rgb(0 0 0 / 0.12);
  }

  li.local {
    border-style: dashed;
    background: transparent;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: none;
    border: 1px solid rgb(var(--accent-rgb) / 0.16);
    border-radius: 9px;
    background: rgb(var(--accent-rgb) / 0.07);
    color: rgb(var(--accent-soft-rgb) / 0.9);
  }

  .local .icon {
    border-color: rgb(255 255 255 / 0.08);
    background: rgb(255 255 255 / 0.03);
    color: var(--text-3);
  }

  .text {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  strong {
    font-size: 12.5px;
    font-weight: 600;
  }

  small {
    color: var(--text-3);
    font-size: 11.5px;
    line-height: 1.45;
  }

  .chip {
    flex: none;
    padding: 2px 9px;
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: 999px;
    color: var(--text-3);
    font-size: 10.5px;
    font-weight: 600;
  }

  .chip.synced {
    border-color: rgb(62 207 142 / 0.3);
    background: rgb(62 207 142 / 0.08);
    color: rgb(110 225 175);
  }

  .note {
    color: var(--text-3);
    font-size: 11px;
    line-height: 1.5;
  }
</style>

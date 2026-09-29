<script lang="ts">
  import CoderScene from "../splash/CoderScene.svelte";

  let {
    version,
    note,
    paused = false,
  }: { version: string; note: string; paused?: boolean } = $props();
</script>

<!-- The left panel: the app's animated mark, name and version. -->
<aside class="brand">
  <div class="halo" aria-hidden="true"></div>
  <div class="scene"><CoderScene size={132} {paused} /></div>
  <h1>MYLE</h1>
  <span class="version">Version {version}</span>
  <p class="note">{note}</p>
  <p class="copyright">© 2026 ThomasThanos</p>
</aside>

<style>
  .brand {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 244px;
    flex: none;
    padding: 34px 22px 18px;
    overflow: hidden;
    text-align: center;
    background:
      radial-gradient(90% 60% at 50% 22%, rgb(92 108 255 / 0.2), transparent 70%),
      linear-gradient(180deg, rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.01));
    box-shadow: inset -1px 0 0 rgb(255 255 255 / 0.05);
  }

  .halo {
    position: absolute;
    top: 8px;
    left: 50%;
    width: 220px;
    height: 220px;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.28), transparent);
    transform: translateX(-50%);
    pointer-events: none;
  }

  .scene {
    position: relative;
    filter: drop-shadow(0 16px 26px rgb(0 0 0 / 0.55));
  }

  h1 {
    position: relative;
    margin-top: 18px;
    font-size: 17px;
    letter-spacing: -0.01em;
  }

  .version {
    position: relative;
    margin-top: 8px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #cfd6ff;
    background: rgb(var(--accent-rgb) / 0.14);
    box-shadow: inset 0 0 0 1px rgb(var(--accent-rgb) / 0.24);
  }

  .note {
    position: relative;
    margin-top: 14px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-3);
  }

  .copyright {
    margin-top: auto;
    font-size: 11px;
    color: rgb(200 210 240 / 0.28);
  }
</style>

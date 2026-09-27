<script lang="ts">
  import CoderScene from "./CoderScene.svelte";

  let { tone = "busy" }: { tone?: "busy" | "done" | "error" } = $props();
</script>

<!-- Every animated layer is its own element that only moves via transform or
     opacity, so the compositor animates it without repainting. -->
<div class="splash-logo {tone}">
  <div class="halo"></div>
  <div class="halo error-halo"></div>
  <div class="mark"><CoderScene size={124} paused={tone === "error"} /></div>
</div>

<style>
  .splash-logo {
    position: relative;
    display: grid;
    place-items: center;
    width: 164px;
    height: 164px;
  }

  .halo {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.55), rgb(79 209 232 / 0.12) 62%, transparent);
    transition: opacity var(--dur-slow) var(--ease-out);
    will-change: transform, opacity;
  }

  .error-halo {
    background: radial-gradient(closest-side, rgb(229 72 77 / 0.45), transparent);
    opacity: 0;
  }

  .error .halo:not(.error-halo) {
    opacity: 0;
  }

  .error .error-halo {
    opacity: 1;
  }

  .mark {
    position: relative;
    will-change: transform;
  }

  /* Drop shadow under the tile, which sits 64/1024 inside the scene box. */
  .mark::before {
    content: "";
    position: absolute;
    inset: 6.25%;
    border-radius: 24.5%;
    box-shadow: 0 16px 32px -12px rgb(0 0 0 / 0.85);
  }

  @media (prefers-reduced-motion: no-preference) {
    .halo {
      animation: halo 2.4s var(--ease-in-out) infinite alternate;
    }

    .mark {
      animation:
        rise 620ms var(--ease-out) both,
        float 3.2s var(--ease-in-out) 620ms infinite alternate;
    }

    .done .mark {
      animation: done 420ms var(--ease-out) both;
    }
  }

  @keyframes halo {
    from {
      transform: scale(0.88);
    }
    to {
      transform: scale(1.06);
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.9);
    }
  }

  @keyframes float {
    to {
      transform: translateY(-3px);
    }
  }

  /* A small pop as the app is about to open. */
  @keyframes done {
    50% {
      transform: scale(1.045);
    }
  }
</style>

<script lang="ts">
  import Logo from "../lib/components/Logo.svelte";

  let { busy = true }: { busy?: boolean } = $props();
</script>

<!-- Every animated layer is its own element that only moves via transform or
     opacity, so the compositor animates it without repainting. -->
<div class="splash-logo" class:busy>
  <div class="halo"></div>
  <div class="track"></div>
  <div class="ring"></div>
  <div class="mark"><Logo size={68} /></div>
</div>

<style>
  .splash-logo {
    position: relative;
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
  }

  .halo,
  .track,
  .ring {
    position: absolute;
    border-radius: 50%;
  }

  .halo {
    inset: 4px;
    background: radial-gradient(closest-side, rgb(118 134 255 / 0.5), transparent);
    animation: halo 2.4s var(--ease-in-out) infinite alternate;
    will-change: transform, opacity;
  }

  .track {
    inset: 0;
    border: 1px solid rgb(255 255 255 / 0.06);
  }

  .ring {
    inset: 0;
    background: conic-gradient(
      from 0turn,
      transparent 0turn 0.42turn,
      rgb(139 151 255 / 0.9) 0.82turn,
      #7ee6f5 1turn
    );
    mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px));
    opacity: 0;
    transition: opacity var(--dur-slow) var(--ease-out);
    animation: spin 1.1s linear infinite;
    will-change: transform;
  }

  .busy .ring {
    opacity: 1;
  }

  .mark {
    position: relative;
    animation: breathe 2.4s var(--ease-in-out) infinite alternate;
    will-change: transform;
  }

  @keyframes spin {
    to {
      transform: rotate(1turn);
    }
  }

  @keyframes breathe {
    from {
      transform: scale(0.95);
    }
    to {
      transform: scale(1.03);
    }
  }

  @keyframes halo {
    from {
      opacity: 0.5;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1.06);
    }
  }
</style>

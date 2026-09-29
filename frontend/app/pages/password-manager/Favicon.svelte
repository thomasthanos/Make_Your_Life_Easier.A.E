<script lang="ts">
  // An entry's website icon, or its first letter on a colour of its own.
  import { iconHost, passwords as p } from "./state.svelte";

  let { title, urls, size = 36 }: { title: string; urls: string[]; size?: number } = $props();

  const src = $derived(p.iconFor(urls));
  /** An icon the webview could not draw: the letter instead. */
  let broken = $state<string | null>(null);
  const letter = $derived((title.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase());
  // The same site always gets the same colour.
  const hue = $derived.by(() => {
    let hash = 7;
    for (const char of urls.map(iconHost).find(Boolean) ?? title.toLowerCase()) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return hash % 360;
  });
</script>

<span class="favicon" class:image={src && src !== broken} style:--size="{size}px" style:--hue={hue} aria-hidden="true">
  {#if src && src !== broken}
    <img {src} alt="" draggable="false" decoding="async" onerror={() => (broken = src)} />
  {:else}
    {letter}
  {/if}
</span>

<style>
  .favicon {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    overflow: hidden;
    border: 1px solid hsl(var(--hue) 55% 70% / 0.2);
    border-radius: calc(var(--size) * 0.3);
    background: linear-gradient(145deg, hsl(var(--hue) 55% 62% / 0.34), hsl(var(--hue) 55% 50% / 0.1));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08);
    color: hsl(var(--hue) 75% 88%);
    font-family: var(--font-brand);
    font-size: calc(var(--size) * 0.4);
    font-weight: 600;
    line-height: 1;
    user-select: none;
  }

  /* Most icons are drawn for a light page: a light tile shows them all. */
  .favicon.image {
    border-color: rgb(255 255 255 / 0.16);
    background: linear-gradient(160deg, #fbfbfe, #e9ebf3);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  }

  img {
    width: 64%;
    height: 64%;
    object-fit: contain;
  }
</style>

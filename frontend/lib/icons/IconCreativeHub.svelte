<script lang="ts">
  let { size = 20, class: cls = "" }: { size?: number; strokeWidth?: number; class?: string } = $props();
  const uid = $props.id();
</script>

<!-- Creative Hub: Sculpted Artist Palette with Multi-Color Paint Wells -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  class="custom-nav-icon {cls}"
  aria-hidden="true"
>
  <defs>
    <linearGradient id="{uid}-fill" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#F472B6" stop-opacity="0.26" />
      <stop offset="50%" stop-color="#A855F7" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.1" />
    </linearGradient>
    <linearGradient id="{uid}-stroke" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FBCFE8" />
      <stop offset="50%" stop-color="#C084FC" />
      <stop offset="100%" stop-color="#60A5FA" />
    </linearGradient>
  </defs>

  <!-- Classic Kidney Artist Palette Silhouette -->
  <path
    d="M12 2.25C6.62 2.25 2.25 6.62 2.25 12C2.25 17.38 6.62 21.75 12 21.75C13.52 21.75 14.75 20.52 14.75 19C14.75 18.32 14.49 17.71 14.07 17.23C13.66 16.77 13.42 16.19 13.42 15.53C13.42 14.01 14.65 12.78 16.17 12.78H17.5C20.4 12.78 21.75 10.68 21.75 8.25C21.75 4.72 17.38 2.25 12 2.25Z"
    fill="url(#{uid}-fill)"
    stroke="url(#{uid}-stroke)"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Four Paint Wells -->
  <circle cx="6.6" cy="11.8" r="1.35" fill="#F472B6" />
  <circle cx="9.2" cy="7.4" r="1.35" fill="#FBBF24" />
  <circle cx="14.2" cy="6.8" r="1.35" fill="#34D399" />
  <circle cx="17.4" cy="9.4" r="1.25" fill="#38BDF8" />
</svg>

<script lang="ts">
  let { size = 24 }: { size?: number } = $props();
  const uid = $props.id();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".16" />
      <stop offset="1" stop-color="#fff" stop-opacity=".035" />
    </linearGradient>
    <linearGradient id="{uid}-rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".6" />
      <stop offset=".45" stop-color="#fff" stop-opacity=".08" />
      <stop offset="1" stop-color="#fff" stop-opacity=".18" />
    </linearGradient>
    <linearGradient id="{uid}-spark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c3c9ff" />
      <stop offset=".5" stop-color="#7486ff" />
      <stop offset="1" stop-color="#4fd1e8" />
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="54" height="54" rx="17" fill="url(#{uid}-tile)" stroke="url(#{uid}-rim)" stroke-width="1.5" />
  <path
    d="M32 13c1.4 11.2 6.3 16.6 19 19-12.7 2.4-17.6 7.8-19 19-1.4-11.2-6.3-16.6-19-19 12.7-2.4 17.6-7.8 19-19z"
    fill="url(#{uid}-spark)"
  />
  <path d="M46.5 11.5c.5 3.4 1.9 4.9 5.5 5.5-3.6.6-5 2.1-5.5 5.5-.5-3.4-1.9-4.9-5.5-5.5 3.6-.6 5-2.1 5.5-5.5z" fill="#e3e7ff" opacity=".85" />
</svg>

<script lang="ts">
  let { title, subtitle = "" }: { title: string; subtitle?: string } = $props();
</script>

<header>
  <h1>{title}</h1>
  {#if subtitle}<p>{subtitle}</p>{/if}
</header>

<style>
  header {
    margin-bottom: 24px;
  }

  h1 {
    font-size: 26px;
    line-height: 1.2;
  }

  p {
    margin-top: 4px;
    color: var(--text-2);
  }
</style>

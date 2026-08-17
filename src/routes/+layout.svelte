<script lang="ts">
  import { onMount } from "svelte";
  let { children } = $props();

  onMount(async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.("landscape");
    } catch {}
  });
</script>

<div class="w-screen h-dvh overflow-hidden">
  {@render children()}
</div>

<style>
  @import "tailwindcss";
</style>
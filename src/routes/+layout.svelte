<style>
	@import 'tailwindcss';
</style>

<script lang="ts">
	import { onMount } from 'svelte';

	let { children } = $props();

	let needsLandscape = $state(false);

	function updateOrientation() {
		needsLandscape = window.innerHeight > window.innerWidth;
	}

	async function goFullscreen() {
		try {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
			}
		} catch (err) {
			console.warn('Fullscreen unavailable:', err);
		}

		try {
			if (screen.orientation?.lock) {
				await screen.orientation.lock('landscape');
			}
		} catch (err) {
			console.warn('Orientation lock unavailable:', err);
		}

		updateOrientation();
	}

	function handleFullscreenChange() {
		if (document.fullscreenElement) {
			screen.orientation?.lock?.('landscape').catch(() => {});
		}

		updateOrientation();
	}

	onMount(() => {
		updateOrientation();

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		window.addEventListener('resize', updateOrientation);
		screen.orientation?.addEventListener?.('change', updateOrientation);

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			window.removeEventListener('resize', updateOrientation);
			screen.orientation?.removeEventListener?.('change', updateOrientation);
		};
	});
</script>

{#if needsLandscape}
	<div class="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white">
		<div class="mb-6 text-6xl">↻</div>

		<h1 class="text-2xl font-bold">Rotate your device</h1>

		<p class="mt-2 text-center text-white/60">Please rotate your phone to landscape.</p>

		<button type="button" onclick={goFullscreen} class="mt-8 rounded-xl bg-white px-6 py-3 font-semibold text-black">
			Continue
		</button>
	</div>
{:else}
	<div class="h-dvh w-screen overflow-auto">
		{@render children()}
	</div>
{/if}
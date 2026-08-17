<script lang="ts">
	import { onMount } from 'svelte';

	let { children } = $props();
    
	let needsLandscape = $state(false);

	async function goFullscreen() {
		// Must happen from a user gesture.
		try {
			if (!document.fullscreenElement) {
				const el = document.documentElement;

				if (el.requestFullscreen) {
					await el.requestFullscreen();
				}
			}
		} catch (err) {
			console.warn('Fullscreen unavailable:', err);
		}

		// Try locking the orientation AFTER fullscreen.
		try {
			if (screen.orientation?.lock) {
				await screen.orientation.lock('landscape');
			}
		} catch (err) {
			// Expected on browsers that don't support orientation locking.
			console.warn('Orientation lock unavailable:', err);
		}

		updateOrientation();
	}

	function updateOrientation() {
		needsLandscape = window.innerHeight > window.innerWidth;
	}

	function handleFullscreenChange() {
		let isFullscreen = !!document.fullscreenElement;

		// Try orientation lock again after fullscreen changes.
		if (document.fullscreenElement) {
			screen.orientation?.lock?.('landscape').catch(() => {});
		}
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

<!-- Landscape warning / fallback -->
{#if needsLandscape}
	<div
		class="fixed inset-0 z-[9999] flex flex-col items-center justify-center
           bg-black text-white"
	>
		<div class="text-6xl mb-6">↻</div>

		<h1 class="text-2xl font-bold">Rotate your device</h1>

		<p class="mt-2 text-center text-white/60">Please rotate your phone to landscape.</p>

		<button
			onclick={goFullscreen}
			class="mt-8 rounded-xl bg-white px-6 py-3
             font-semibold text-black"
		>
			Continue
		</button>
	</div>
{:else}
	<div class="h-dvh w-screen overflow-hidden">
		{@render children()}
	</div>
{/if}

<style>
	@import 'tailwindcss';
</style>

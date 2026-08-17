<script lang="ts">
	import { signature } from 'svelte-signature-pad';
	import { enhance } from '$app/forms';

	let { form } = $props();

	type Stroke = {
		path: string;
		width: number;
		height: number;
	};

	let name = $state('');
	let strokes = $state<Stroke[]>([]);
	let preview = $state('');
	let submitted = $state(false);
	let submitting = $state(false);

	let width = $state(600);
	let height = $state(360);

	let pathInput = $state<HTMLInputElement>();

	const ondraw = (path: string) => {
		preview = path;
	};

	const oncomplete = (path: string) => {
		if (!path) return;

		strokes = [
			...strokes,
			{
				path,
				width,
				height,
			},
		];

		preview = '';
		updateHiddenInput();
	};

	const updateHiddenInput = () => {
		if (!pathInput) return;

		pathInput.value = JSON.stringify(strokes);
	};

	const clear = () => {
		strokes = [];
		preview = '';

		if (pathInput) {
			pathInput.value = '';
		}
	};

	const newSignature = () => {
		name = '';
		strokes = [];
		preview = '';
		submitted = false;

		if (pathInput) {
			pathInput.value = '';
		}
	};

	const exit = async () => {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			}
		} catch (error) {
			console.warn('Could not exit fullscreen:', error);
		}

		window.location.href = '/';
	};

	const signatureOptions = {
		ondraw,
		oncomplete,
	};
</script>

<form
	method="POST"
	class="w-full max-w-2xl"
	use:enhance={() => {
		submitting = true;

		return async ({ update }) => {
			await update();

			submitting = false;

			// Only hide the signature pad when the server
			// confirms the signature was saved.
			if (form?.success) {
				submitted = true;
			}
		};
	}}
>
	<!-- Header / actions -->
	<div class="mb-4 flex w-full items-end gap-2">
		{#if submitted}
			<div class="flex min-w-0 flex-1 items-center">
				<p class="text-sm font-medium text-green-600">
					Signature saved successfully.
				</p>
			</div>

			<button
				type="button"
				onclick={newSignature}
				class="shrink-0 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
			>
				New signature
			</button>
		{:else}
			<div class="min-w-0 flex-1">
				<label
					for="name"
					class="mb-1 block text-sm font-medium text-gray-700"
				>
					Name
				</label>

				<input
					id="name"
					name="name"
					type="text"
					bind:value={name}
					required
					placeholder="Enter signature name"
					class="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<button
				type="submit"
				disabled={submitting || !strokes.length || !name.trim()}
				class="shrink-0 rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? 'Saving...' : 'Submit'}
			</button>
		{/if}

		<!-- Data -->
		<a
			href="/data"
			aria-label="View saved data"
			title="View saved data"
			class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
			>
				<path d="M3 7c0 2.21 4.03 4 9 4s9-1.79 9-4" />
				<path d="M3 7v5c0 2.21 4.03 4 9 4s9-1.79 9-4V7" />
				<path d="M3 12v5c0 2.21 4.03 4 9 4s9-1.79 9-4v-5" />
				<ellipse cx="12" cy="7" rx="9" ry="4" />
			</svg>
		</a>

		<!-- Exit -->
		<button
			type="button"
			onclick={exit}
			class="shrink-0 rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
		>
			Exit
		</button>
	</div>

	<!-- Server error -->
	{#if form?.error}
		<p class="mb-3 text-sm text-red-600">
			{form.error}
		</p>
	{/if}

	<!-- Signature pad -->
	{#if !submitted}
		<input
			bind:this={pathInput}
			type="hidden"
			name="path"
		/>

		<div
			class="relative h-[360px] w-full border border-dashed border-gray-300 bg-gray-100"
		>
			<div
				class="pointer-events-none absolute bottom-24 left-4 right-4 border-t border-dotted border-gray-300"
			></div>

			<div
				role="application"
				class="relative h-full w-full touch-none"
				use:signature={signatureOptions}
				bind:clientWidth={width}
				bind:clientHeight={height}
				ontouchmove={(event) => event.preventDefault()}
			>
				<!-- Existing strokes -->
				{#each strokes as stroke}
					<svg
						class="pointer-events-none absolute inset-0 h-full w-full"
						viewBox={`0 0 ${stroke.width} ${stroke.height}`}
						preserveAspectRatio="none"
					>
						<path
							d={stroke.path}
							fill="black"
						/>
					</svg>
				{/each}

				<!-- Current stroke -->
				{#if preview}
					<svg
						class="pointer-events-none absolute inset-0 h-full w-full"
						viewBox={`0 0 ${width} ${height}`}
						preserveAspectRatio="none"
					>
						<path
							d={preview}
							fill="black"
						/>
					</svg>
				{/if}
			</div>

			<!-- Clear -->
			<button
				type="button"
				onclick={clear}
				class="absolute right-2 top-2 z-10 rounded border border-gray-200 bg-white px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
			>
				Clear
			</button>
		</div>
	{/if}
</form>
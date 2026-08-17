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

	let showPasswordModal = $state(false);
	let password = $state('');

	let width = $state(600);
	let height = $state(360);

	let pathInput = $state<HTMLInputElement>();
	let formElement = $state<HTMLFormElement>();
	let passwordInput = $state<HTMLInputElement>();

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
				height
			}
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

	// Open password prompt
	const requestSubmit = () => {
		if (!strokes.length || !name.trim() || submitting) return;

		password = '';
		showPasswordModal = true;

		setTimeout(() => {
			passwordInput?.focus();
		}, 0);
	};

	// Cancel password prompt
	const cancelPassword = () => {
		if (submitting) return;

		showPasswordModal = false;
		password = '';
	};

	// Submit after password is entered
	const confirmSubmit = () => {
		if (!password) return;

		showPasswordModal = false;

		formElement?.requestSubmit();
	};

	const newSignature = () => {
		name = '';
		strokes = [];
		preview = '';
		password = '';
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

	const handleKeydown = (event: KeyboardEvent) => {
		if (!showPasswordModal) return;

		if (event.key === 'Escape') {
			cancelPassword();
		}

		if (event.key === 'Enter') {
			confirmSubmit();
		}
	};

	const signatureOptions = {
		ondraw,
		oncomplete
	};
</script>

<svelte:window onkeydown={handleKeydown} />

<form
	bind:this={formElement}
	method="POST"
	class="w-full max-w-2xl"
	use:enhance={() => {
		submitting = true;

		return async ({ update }) => {
			await update();

			submitting = false;

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

			<!-- Submit -->
			<button
				type="button"
				onclick={requestSubmit}
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
				<path d="M3 7v5c0 2.21 4 4 9 4s9-1.79 9-4V7" />
				<path d="M3 12v5c0 2.21 4 4 9 4s9-1.79 9-4v-5" />
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

	<!-- Hidden fields -->
	<input
		bind:this={pathInput}
		type="hidden"
		name="path"
	/>

	<input
		type="hidden"
		name="password"
		value={password}
	/>

	<!-- Signature pad -->
	{#if !submitted}
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
				{#each strokes as stroke}
					<svg
						class="pointer-events-none absolute inset-0 h-full w-full"
						viewBox={`0 0 ${stroke.width} ${stroke.height}`}
						preserveAspectRatio="none"
					>
						<path d={stroke.path} fill="black" />
					</svg>
				{/each}

				{#if preview}
					<svg
						class="pointer-events-none absolute inset-0 h-full w-full"
						viewBox={`0 0 ${width} ${height}`}
						preserveAspectRatio="none"
					>
						<path d={preview} fill="black" />
					</svg>
				{/if}
			</div>

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

<!-- Password modal -->
{#if showPasswordModal}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				cancelPassword();
			}
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="password-title"
			class="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
		>
			<h2
				id="password-title"
				class="text-lg font-semibold text-gray-900"
			>
				Enter Password
			</h2>

			<p class="mt-1 text-sm text-gray-500">
				Enter your PIN to save this signature.
			</p>

			<div class="mt-4">
				<label
					for="password"
					class="mb-1 block text-sm font-medium text-gray-700"
				>
					PIN
				</label>

				<input
					bind:this={passwordInput}
					id="password"
					type="password"
					inputmode="numeric"
					pattern="[0-9]*"
					autocomplete="off"
					bind:value={password}
					class="w-full rounded border border-gray-300 px-3 py-3 text-center text-xl tracking-[0.4em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					placeholder="••••••"
				/>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={cancelPassword}
					class="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>

				<button
					type="button"
					onclick={confirmSubmit}
					disabled={!password || submitting}
					class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Confirm
				</button>
			</div>
		</div>
	</div>
{/if}
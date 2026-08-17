<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';

	type Stroke = {
		path: string;
		width: number;
		height: number;
	};

	type ImageData = {
		_id: string;
		name: string;
		image: string;
	};

	type AccessResult = {
		success?: boolean;
		images?: ImageData[];
		error?: string;
	};

	let { data } = $props();

	// ---------------------------------------------------------
	// Data state
	// ---------------------------------------------------------

	let images = $state<ImageData[]>([]);
	let pngImages = $state<Record<string, string>>({});

	let copied = $state<string | null>(null);
	let deleting = $state<string | null>(null);

	// ---------------------------------------------------------
	// Authentication state
	// ---------------------------------------------------------

	let authenticated = $state(false);
	let showPasswordModal = $state(true);

	let password = $state('');
	let passwordError = $state('');
	let checkingPassword = $state(false);

	// ---------------------------------------------------------
	// Delete modal state
	// ---------------------------------------------------------

	let deleteTarget = $state<ImageData | null>(null);

	// ---------------------------------------------------------
	// XML helpers
	// ---------------------------------------------------------

	const escapeXml = (value: string): string => {
		return value
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/'/g, '&apos;');
	};

	// ---------------------------------------------------------
	// Convert stored strokes to SVG
	// ---------------------------------------------------------

	const strokesToSvg = (image: string): string => {
		let strokes: Stroke[];

		try {
			strokes = JSON.parse(image);
		} catch {
			// Supports older records containing SVG directly.
			return image;
		}

		if (!strokes.length) {
			return '';
		}

		const width = strokes[0].width || 600;
		const height = strokes[0].height || 360;

		const paths = strokes
			.map(
				(stroke) =>
					`<path d="${escapeXml(stroke.path)}" fill="black"/>`
			)
			.join('');

		return `
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 ${width} ${height}"
			>
				${paths}
			</svg>
		`;
	};

	// ---------------------------------------------------------
	// Convert SVG to PNG
	// ---------------------------------------------------------

	const svgToPng = async (image: string): Promise<string> => {
		const svg = strokesToSvg(image);

		if (!svg) {
			throw new Error('Empty signature');
		}

		const blob = new Blob([svg], {
			type: 'image/svg+xml;charset=utf-8',
		});

		const url = URL.createObjectURL(blob);

		try {
			const img = new Image();

			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();

				img.onerror = () => {
					reject(new Error('Failed to load SVG'));
				};

				img.src = url;
			});

			const canvas = document.createElement('canvas');

			canvas.width = 600;
			canvas.height = 240;

			const ctx = canvas.getContext('2d');

			if (!ctx) {
				throw new Error('Could not create canvas context');
			}

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			const sourceWidth = img.naturalWidth || 600;
			const sourceHeight = img.naturalHeight || 360;

			const scale = Math.min(
				canvas.width / sourceWidth,
				canvas.height / sourceHeight
			);

			const width = sourceWidth * scale;
			const height = sourceHeight * scale;

			const x = (canvas.width - width) / 2;
			const y = (canvas.height - height) / 2;

			ctx.drawImage(img, x, y, width, height);

			return canvas.toDataURL('image/png');
		} finally {
			URL.revokeObjectURL(url);
		}
	};

	// ---------------------------------------------------------
	// Load PNG previews
	// ---------------------------------------------------------

	const loadPngImages = async (items: ImageData[]) => {
		pngImages = {};

		for (const image of items) {
			try {
				const png = await svgToPng(image.image);

				pngImages[image._id] = png;
			} catch (error) {
				console.error(
					`Failed to convert signature "${image.name}":`,
					error
				);
			}
		}
	};

	// ---------------------------------------------------------
	// Copy signature image
	// ---------------------------------------------------------

	const copyImage = async (_id: string, image: string) => {
		try {
			const pngDataUrl = await svgToPng(image);

			const response = await fetch(pngDataUrl);

			if (!response.ok) {
				throw new Error('Failed to create PNG blob');
			}

			const blob = await response.blob();

			if (
				!navigator.clipboard ||
				typeof ClipboardItem === 'undefined'
			) {
				throw new Error(
					'Clipboard image support is unavailable'
				);
			}

			await navigator.clipboard.write([
				new ClipboardItem({
					'image/png': blob,
				}),
			]);

			copied = _id;

			setTimeout(() => {
				if (copied === _id) {
					copied = null;
				}
			}, 1500);
		} catch (error) {
			console.error('Failed to copy image:', error);

			alert(
				'Could not copy the image. Your browser may not support image clipboard access.'
			);
		}
	};

	// ---------------------------------------------------------
	// Delete modal
	// ---------------------------------------------------------

	const confirmDelete = (image: ImageData) => {
		if (deleting) return;

		deleteTarget = image;
	};

	const cancelDelete = () => {
		if (deleting) return;

		deleteTarget = null;
	};

	// ---------------------------------------------------------
	// Delete signature
	// ---------------------------------------------------------

	const deleteImage = async (_id: string) => {
		deleteTarget = null;
		deleting = _id;

		try {
			const response = await fetch('?', {
				method: 'POST',
				headers: {
					'Content-Type':
						'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					_id,
					action: 'delete',
				}),
			});

			const result = await response.json().catch(() => null);

			if (!response.ok) {
				throw new Error(
					result?.error || 'Failed to delete signature'
				);
			}

			images = images.filter((image) => image._id !== _id);

			const nextPngImages = { ...pngImages };

			delete nextPngImages[_id];

			pngImages = nextPngImages;

			if (copied === _id) {
				copied = null;
			}
		} catch (error) {
			console.error('Failed to delete signature:', error);

			alert(
				error instanceof Error
					? error.message
					: 'Failed to delete signature. Please try again.'
			);
		} finally {
			deleting = null;
		}
	};

	// ---------------------------------------------------------
	// Exit
	// ---------------------------------------------------------

	const exit = async () => {
		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			}
		} catch (error) {
			console.warn(
				'Could not exit fullscreen:',
				error
			);
		}

		window.location.href = '/';
	};

	// ---------------------------------------------------------
	// Cancel password
	// ---------------------------------------------------------

	const cancelPassword = () => {
		if (checkingPassword) return;

		window.location.href = '/';
	};

	// ---------------------------------------------------------
	// Keyboard handling
	// ---------------------------------------------------------

	const handleKeydown = (event: KeyboardEvent) => {
		if (
			event.key === 'Escape' &&
			deleteTarget &&
			!deleting
		) {
			cancelDelete();
		}

		if (
			event.key === 'Escape' &&
			showPasswordModal &&
			!checkingPassword
		) {
			cancelPassword();
		}
	};

	// ---------------------------------------------------------
	// Mount
	// ---------------------------------------------------------

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener(
				'keydown',
				handleKeydown
			);
		};
	});
</script>

<!-- =========================================================
     PASSWORD MODAL
     ========================================================= -->

{#if showPasswordModal}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="password-title"
			class="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
		>
			<div class="mb-5">
				<div
					class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect
							width="18"
							height="11"
							x="3"
							y="11"
							rx="2"
							ry="2"
						/>
						<path d="M7 11V7a5 5 0 0 1 10 0v4" />
					</svg>
				</div>

				<h2
					id="password-title"
					class="mt-4 text-center text-xl font-semibold text-gray-900"
				>
					Enter password
				</h2>

				<p class="mt-1 text-center text-sm text-gray-500">
					Enter the numeric password to view saved
					signatures.
				</p>
			</div>

			<form
				method="POST"
				use:enhance={() => {
					checkingPassword = true;
					passwordError = '';

					return async ({ result, update }) => {
						checkingPassword = false;

						if (result.type === 'failure') {
							const resultData =
								result.data as AccessResult;

							passwordError =
								resultData?.error ||
								'Incorrect password.';

							return;
						}

						if (result.type === 'success') {
							const resultData =
								result.data as AccessResult;

							if (
								resultData.success &&
								resultData.images
							) {
								images = resultData.images;

								authenticated = true;
								showPasswordModal = false;

								password = '';
								passwordError = '';

								await loadPngImages(
									resultData.images
								);
							}
						}

						await update({
							reset: false,
						});
					};
				}}
			>
				<input
					type="hidden"
					name="action"
					value="access"
				/>

				<label
					for="access-password"
					class="mb-1 block text-sm font-medium text-gray-700"
				>
					Password
				</label>

				<input
					id="access-password"
					name="password"
					type="password"
					inputmode="numeric"
					pattern="[0-9]*"
					autocomplete="off"
					bind:value={password}
					disabled={checkingPassword}
					placeholder="••••••"
					class="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-xl tracking-[0.35em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
				/>

				{#if passwordError}
					<div
						class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
					>
						<p class="text-sm text-red-600">
							{passwordError}
						</p>
					</div>
				{/if}

				<div class="mt-6 flex justify-end gap-2">
					<button
						type="button"
						onclick={cancelPassword}
						disabled={checkingPassword}
						class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancel
					</button>

					<button
						type="submit"
						disabled={
							checkingPassword ||
							!password.trim()
						}
						class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{checkingPassword
							? 'Checking...'
							: 'Continue'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- =========================================================
     SAVED SIGNATURES
     ========================================================= -->

{#if authenticated}
	<div class="min-h-screen bg-gray-50">
		<div class="mx-auto w-full max-w-6xl px-4 py-6">
			<!-- Header -->
			<div
				class="mb-6 flex items-center justify-between gap-4"
			>
				<div class="min-w-0">
					<h1
						class="text-2xl font-semibold text-gray-900"
					>
						Saved Signatures
					</h1>

					<p class="mt-1 text-sm text-gray-500">
						{images.length}
						{images.length === 1
							? 'signature'
							: 'signatures'}
					</p>
				</div>

				<div
					class="flex shrink-0 items-center gap-2"
				>
					<a
						href="/"
						class="rounded border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
					>
						New signature
					</a>

					<button
						type="button"
						onclick={exit}
						class="shrink-0 rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700"
					>
						Exit
					</button>
				</div>
			</div>

			<!-- Error from initial page -->
			{#if data?.error}
				<div
					class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
				>
					{data.error}
				</div>

			<!-- Empty state -->
			{:else if images.length === 0}
				<div
					class="rounded-lg border border-gray-200 bg-white p-12 text-center"
				>
					<div
						class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M3 17c3 3 6 3 9 0s6-3 9 0" />
							<path d="M3 12c3 3 6 3 9 0s6-3 9 0" />
							<path d="M3 7c3 3 6 3 9 0s6-3 9 0" />
						</svg>
					</div>

					<p class="mt-4 text-gray-500">
						No signatures found.
					</p>

					<a
						href="/"
						class="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
					>
						Create a signature
					</a>
				</div>

			<!-- Signature list -->
			{:else}
				<div
					class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
				>
					{#each images as image}
						<div
							class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
						>
							<!-- Name -->
							<div
								class="border-b border-gray-200 px-3 py-2"
							>
								<p
									class="truncate text-sm font-medium text-gray-900"
									title={image.name}
								>
									{image.name}
								</p>
							</div>

							<!-- Signature preview -->
							<div
								class="flex h-32 w-full items-center justify-center bg-gray-50 p-3"
							>
								{#if pngImages[image._id]}
									<img
										src={pngImages[image._id]}
										alt={image.name}
										class="max-h-full max-w-full object-contain"
									/>
								{:else}
									<div
										class="flex flex-col items-center gap-2 text-gray-400"
									>
										<svg
											class="h-5 w-5 animate-spin"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>

											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
											></path>
										</svg>

										<span class="text-xs">
											Loading...
										</span>
									</div>
								{/if}
							</div>

							<!-- Card actions -->
							<div
								class="flex gap-2 border-t border-gray-200 p-2"
							>
								<button
									type="button"
									disabled={
										!pngImages[image._id] ||
										deleting === image._id
									}
									onclick={() =>
										copyImage(
											image._id,
											image.image
										)}
									class="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{copied === image._id
										? 'Copied!'
										: 'Copy'}
								</button>

								<button
									type="button"
									disabled={
										deleting === image._id
									}
									onclick={() =>
										confirmDelete(image)}
									class="flex-1 rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{deleting === image._id
										? 'Deleting...'
										: 'Delete'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- =========================================================
     DELETE CONFIRMATION MODAL
     ========================================================= -->

{#if deleteTarget}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				cancelDelete();
			}
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-title"
			class="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
		>
			<div class="flex items-start gap-4">
				<!-- Warning icon -->
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 9v4" />
						<path d="M12 17h.01" />
						<path
							d="M10.3 3.9 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
						/>
					</svg>
				</div>

				<div class="min-w-0">
					<h2
						id="delete-title"
						class="text-lg font-semibold text-gray-900"
					>
						Delete signature?
					</h2>

					<p class="mt-1 text-sm text-gray-500">
						Are you sure you want to delete

						<strong
							class="font-medium text-gray-700"
						>
							{deleteTarget.name}
						</strong>

						?
					</p>

					<p class="mt-1 text-xs text-gray-400">
						This action cannot be undone.
					</p>
				</div>
			</div>

			<!-- Modal actions -->
			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={cancelDelete}
					disabled={!!deleting}
					class="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Cancel
				</button>

				<button
					type="button"
					onclick={() =>
						deleteImage(deleteTarget!._id)}
					disabled={!!deleting}
					class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{deleting
						? 'Deleting...'
						: 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
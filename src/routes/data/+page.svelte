<script lang="ts">
	import { enhance } from '$app/forms';

	type ImageData = {
		_id: string;
		name: string;
		image: string;
	};

	type ActionData = {
		success?: boolean;
		images?: ImageData[];
		error?: string;
	};

	let images = $state<ImageData[]>([]);
	let pngImages = $state<Record<string, string>>({});

	let password = $state('');
	let passwordError = $state('');
	let checkingPassword = $state(false);
	let authenticated = $state(false);

	let deleteTarget = $state<ImageData | null>(null);
	let deleteError = $state('');
	let deleting = $state(false);

	let copied = $state<string | null>(null);
	let pageError = $state('');

	const escapeXml = (value: string) =>
		value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;');

	const toSvg = (image: string): string => {
		try {
			const strokes = JSON.parse(image);

			if (!Array.isArray(strokes) || !strokes.length) {
				return '';
			}

			const width = strokes[0]?.width || 600;
			const height = strokes[0]?.height || 360;

			const paths = strokes.map((stroke) => `<path d="${escapeXml(stroke.path)}" fill="black"/>`).join('');

			return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
		} catch {
			return image;
		}
	};

	const toPng = async (image: string): Promise<string> => {
		const svg = toSvg(image);

		if (!svg) {
			throw new Error('Empty signature.');
		}

		const blob = new Blob([svg], {
			type: 'image/svg+xml',
		});

		const url = URL.createObjectURL(blob);

		try {
			const img = new Image();

			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Could not load signature.'));
				img.src = url;
			});

			const canvas = document.createElement('canvas');
			canvas.width = 600;
			canvas.height = 240;

			const ctx = canvas.getContext('2d');

			if (!ctx) {
				throw new Error('Canvas unavailable.');
			}

			const sourceWidth = img.naturalWidth || 600;
			const sourceHeight = img.naturalHeight || 360;

			const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);

			const width = sourceWidth * scale;
			const height = sourceHeight * scale;

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);

			return canvas.toDataURL('image/png');
		} finally {
			URL.revokeObjectURL(url);
		}
	};

	const loadImages = async (items: ImageData[]) => {
		const result: Record<string, string> = {};

		for (const image of items) {
			try {
				result[image._id] = await toPng(image.image);
			} catch {
				// Ignore individual conversion failures.
			}
		}

		pngImages = result;
	};

	const copyImage = async (image: ImageData) => {
		pageError = '';

		try {
			const dataUrl = await toPng(image.image);
			const response = await fetch(dataUrl);
			const blob = await response.blob();

			if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
				throw new Error('Image copying is not supported on this device.');
			}

			await navigator.clipboard.write([
				new ClipboardItem({
					'image/png': blob,
				}),
			]);

			copied = image._id;

			setTimeout(() => {
				if (copied === image._id) {
					copied = null;
				}
			}, 1500);
		} catch (error) {
			pageError = error instanceof Error ? error.message : 'Could not copy the signature.';
		}
	};

	const openDelete = (image: ImageData) => {
		deleteError = '';
		deleteTarget = image;
	};

	const cancelDelete = () => {
		if (deleting) return;

		deleteTarget = null;
		deleteError = '';
	};

	const back = () => {
		window.location.href = '/';
	};
</script>

<!-- PASSWORD -->

{#if !authenticated}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
			<h1 class="text-center text-xl font-semibold text-gray-900">Enter password</h1>

			<p class="mt-1 text-center text-sm text-gray-500">Enter the password to view saved signatures.</p>

			<form
				method="POST"
				class="mt-6"
				use:enhance={() => {
					checkingPassword = true;
					passwordError = '';

					return async ({ result, update }) => {
						checkingPassword = false;

						if (result.type === 'failure') {
							passwordError = (result.data as ActionData)?.error || 'Incorrect password.';

							return;
						}

						if (result.type === 'success') {
							const data = result.data as ActionData;

							if (data.success && data.images) {
								images = data.images;
								authenticated = true;
								passwordError = '';

								await loadImages(data.images);
							} else {
								passwordError = data.error || 'Incorrect password.';
							}
						}

						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="action" value="access" />

				<label for="password" class="mb-1 block text-sm font-medium text-gray-700"> Password </label>

				<input
					id="password"
					name="password"
					type="password"
					inputmode="numeric"
					pattern="[0-9]*"
					autocomplete="off"
					bind:value={password}
					disabled={checkingPassword}
					placeholder="••••••"
					class="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-xl tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>

				{#if passwordError}
					<div class="mt-3 rounded-lg bg-red-50 px-3 py-2">
						<p class="text-sm text-red-600">
							{passwordError}
						</p>
					</div>
				{/if}

				<div class="mt-5 flex gap-2">
					<button
						type="button"
						onclick={back}
						disabled={checkingPassword}
						class="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700"
					>
						Cancel
					</button>

					<button
						type="submit"
						disabled={checkingPassword || !password.trim()}
						class="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
					>
						{checkingPassword ? 'Checking...' : 'Continue'}
					</button>
				</div>
			</form>
		</div>
	</div>
{:else}
	<!-- SAVED SIGNATURES -->

	<div class="min-h-screen bg-gray-50">
		<div class="mx-auto w-full max-w-6xl px-4 py-5">
			<div class="mb-5 flex items-center justify-between gap-3">
				<div>
					<h1 class="text-xl font-semibold text-gray-900">Saved Signatures</h1>

					<p class="text-sm text-gray-500">
						{images.length}
						{images.length === 1 ? 'signature' : 'signatures'}
					</p>
				</div>

				<button type="button" onclick={back} class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"> Back </button>
			</div>

			{#if pageError}
				<div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
					<p class="text-sm text-red-700">
						{pageError}
					</p>

					<button type="button" onclick={() => (pageError = '')} class="mt-2 text-xs font-medium text-red-600"> Dismiss </button>
				</div>
			{/if}

			{#if images.length === 0}
				<div class="rounded-lg bg-white p-10 text-center">
					<p class="text-gray-500">No signatures found.</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
					{#each images as image}
						<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
							<div class="border-b px-3 py-2">
								<p class="truncate text-sm font-medium text-gray-900" title={image.name}>
									{image.name}
								</p>
							</div>

							<div class="flex h-32 items-center justify-center bg-gray-50 p-3">
								{#if pngImages[image._id]}
									<img src={pngImages[image._id]} alt={image.name} class="max-h-full max-w-full object-contain" />
								{:else}
									<span class="text-xs text-gray-400"> Loading... </span>
								{/if}
							</div>

							<div class="flex gap-2 border-t p-2">
								<button
									type="button"
									disabled={!pngImages[image._id] || deleting}
									onclick={() => copyImage(image)}
									class="flex-1 rounded bg-blue-600 px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
								>
									{copied === image._id ? 'Copied!' : 'Copy'}
								</button>

								<button
									type="button"
									disabled={deleting}
									onclick={() => openDelete(image)}
									class="flex-1 rounded bg-red-600 px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
								>
									Delete
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- DELETE -->

{#if deleteTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
			<h2 class="text-lg font-semibold text-gray-900">Delete signature?</h2>

			<p class="mt-2 text-sm text-gray-500">
				Delete
				<strong class="font-medium text-gray-700">
					{deleteTarget.name}
				</strong>
				?
			</p>

			{#if deleteError}
				<div class="mt-4 rounded-lg bg-red-50 px-3 py-2">
					<p class="text-sm text-red-600">
						{deleteError}
					</p>
				</div>
			{/if}

			<form
				method="POST"
				class="mt-6 flex gap-2"
				use:enhance={() => {
					// Capture the ID BEFORE the request.
					const id = deleteTarget?._id;

					if (!id) {
						deleteError = 'No signature selected.';
						return;
					}

					deleting = true;
					deleteError = '';

					return async ({ result, update }) => {
						deleting = false;

						if (result.type === 'failure') {
							deleteError = (result.data as ActionData)?.error || 'Could not delete signature.';

							await update({ reset: false });
							return;
						}

						if (result.type === 'success') {
							const data = result.data as ActionData;

							if (!data.success) {
								deleteError = data.error || 'Could not delete signature.';

								await update({ reset: false });
								return;
							}

							// Remove it locally immediately.
							images = images.filter((image) => image._id !== id);

							const next = { ...pngImages };
							delete next[id];
							pngImages = next;

							if (copied === id) {
								copied = null;
							}

							deleteTarget = null;
							deleteError = '';

							await update({ reset: false });
						}
					};
				}}
			>
				<input type="hidden" name="action" value="delete" />
				<input type="hidden" name="_id" value={deleteTarget._id} />
				<input type="hidden" name="password" value={password} />

				<button
					type="button"
					onclick={cancelDelete}
					disabled={deleting}
					class="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 disabled:opacity-50"
				>
					Cancel
				</button>

				<button type="submit" disabled={deleting} class="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			</form>
		</div>
	</div>
{/if}

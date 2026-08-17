<style>
	@import 'tailwindcss';
</style>

<script lang="ts">
	import { onMount } from 'svelte';

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

	let { data } = $props();

	let images = $state<ImageData[]>([]);
	let pngImages = $state<Record<string, string>>({});
	let copied = $state<string | null>(null);
	let deleting = $state<string | null>(null);

	const strokesToSvg = (image: string): string => {
		let strokes: Stroke[];

		try {
			strokes = JSON.parse(image);
		} catch {
			// Allows old SVG records to continue working.
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

	const escapeXml = (value: string): string => {
		return value
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/'/g, '&apos;');
	};

	const svgToPng = async (
		image: string
	): Promise<string> => {
		const svg = strokesToSvg(image);

		const blob = new Blob([svg], {
			type: 'image/svg+xml;charset=utf-8'
		});

		const url = URL.createObjectURL(blob);

		try {
			const img = new Image();

			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () =>
					reject(
						new Error('Failed to load SVG')
					);

				img.src = url;
			});

			const canvas =
				document.createElement('canvas');

			canvas.width = 600;
			canvas.height = 240;

			const ctx = canvas.getContext('2d');

			if (!ctx) {
				throw new Error(
					'Could not create canvas context'
				);
			}

			ctx.clearRect(
				0,
				0,
				canvas.width,
				canvas.height
			);

			const sourceWidth =
				img.naturalWidth || 600;

			const sourceHeight =
				img.naturalHeight || 360;

			const scale = Math.min(
				canvas.width / sourceWidth,
				canvas.height / sourceHeight
			);

			const width =
				sourceWidth * scale;

			const height =
				sourceHeight * scale;

			const x =
				(canvas.width - width) / 2;

			const y =
				(canvas.height - height) / 2;

			ctx.drawImage(
				img,
				x,
				y,
				width,
				height
			);

			return canvas.toDataURL('image/png');
		} finally {
			URL.revokeObjectURL(url);
		}
	};

	const copyImage = async (
		_id: string,
		image: string
	) => {
		try {
			const pngDataUrl =
				await svgToPng(image);

			const response =
				await fetch(pngDataUrl);

			const blob =
				await response.blob();

			await navigator.clipboard.write([
				new ClipboardItem({
					'image/png': blob
				})
			]);

			copied = _id;

			setTimeout(() => {
				if (copied === _id) {
					copied = null;
				}
			}, 1500);
		} catch (error) {
			console.error(
				'Failed to copy image:',
				error
			);
		}
	};

	const deleteImage = async (
		_id: string,
		name: string
	) => {
		const confirmed = confirm(
			`Are you sure you want to delete "${name}"?\n\nThis cannot be undone.`
		);

		if (!confirmed) {
			return;
		}

		deleting = _id;

		try {
			const response = await fetch('?', {
				method: 'POST',
				headers: {
					'Content-Type':
						'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({
					_id,
					action: 'delete'
				})
			});

			if (!response.ok) {
				throw new Error(
					'Failed to delete signature'
				);
			}

			images = images.filter(
				(image) => image._id !== _id
			);

			delete pngImages[_id];

			if (copied === _id) {
				copied = null;
			}
		} catch (error) {
			console.error(
				'Failed to delete signature:',
				error
			);

			alert(
				'Failed to delete signature. Please try again.'
			);
		} finally {
			deleting = null;
		}
	};

	onMount(async () => {
		images = data.images as ImageData[];

		for (const image of images) {
			try {
				pngImages[image._id] =
					await svgToPng(image.image);
			} catch (error) {
				console.error(
					`Failed to convert ${image.name}:`,
					error
				);
			}
		}
	});
</script>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto max-w-6xl">
		<div
			class="mb-6 flex items-center justify-between"
		>
			<div>
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

			<a
				href="/"
				class="rounded border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
			>
				New signature
			</a>
		</div>

		{#if data.error}
			<div
				class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
			>
				{data.error}
			</div>
		{:else if images.length === 0}
			<div
				class="rounded-lg border border-gray-200 bg-white p-12 text-center"
			>
				<p class="text-gray-500">
					No signatures found.
				</p>

				<a
					href="/"
					class="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
				>
					Create a signature
				</a>
			</div>
		{:else}
			<div
				class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
			>
				{#each images as image}
					<div
						class="overflow-hidden rounded-lg border border-gray-200 bg-white"
					>
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
								<span
									class="text-xs text-gray-400"
								>
									Loading...
								</span>
							{/if}
						</div>

						<div
							class="flex gap-2 border-t border-gray-200 p-2"
						>
							<button
								type="button"
								disabled={
									!pngImages[image._id]
								}
								onclick={() =>
									copyImage(
										image._id,
										image.image
									)}
								class="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
									deleteImage(
										image._id,
										image.name
									)}
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
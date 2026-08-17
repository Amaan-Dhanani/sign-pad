import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { Image } from '$lib/server/models';

type Stroke = {
	path: string;
	width: number;
	height: number;
};

export const actions: Actions = {
	default: async ({ request }) => {
		try {
			const formData = await request.formData();
			const name = String(formData.get('name') || '').trim();
			const path = String(formData.get('path') || '').trim();

			if (!name) {
				return fail(400, {
					error: 'Please provide a name',
				});
			}

			if (!path) {
				return fail(400, {
					error: 'Please provide a signature',
				});
			}

			let strokes: Stroke[];

			try {
				strokes = JSON.parse(path);
			} catch {
				return fail(400, {
					error: 'Invalid signature data',
				});
			}

			if (!Array.isArray(strokes) || strokes.length === 0) {
				return fail(400, {
					error: 'Please provide a signature',
				});
			}

			for (const stroke of strokes) {
				if (typeof stroke.path !== 'string' || typeof stroke.width !== 'number' || typeof stroke.height !== 'number') {
					return fail(400, {
						error: 'Invalid signature data',
					});
				}
			}

			const image = await Image.create({
				name,
				image: JSON.stringify(strokes),
			});

			return {
				success: true,
				id: image._id.toString(),
			};
		} catch (error) {
			console.error('Failed to save signature:', error);

			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to save signature',
			});
		}
	},
};

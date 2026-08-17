import type {
	Actions,
	PageServerLoad
} from './$types';

import { fail } from '@sveltejs/kit';
import { Image } from '$lib/server/models';

export const load: PageServerLoad = async () => {
	try {
		const images = await Image.find({})
			.select('_id name image')
			.sort({ _id: -1 })
			.lean();

		return {
			images: images.map((image) => ({
				_id: image._id.toString(),
				name: image.name,
				image: image.image
			}))
		};
	} catch (error) {
		console.error(
			'Failed to retrieve images:',
			error
		);

		return {
			images: [],
			error:
				error instanceof Error
					? error.message
					: 'Failed to retrieve images'
		};
	}
};

export const actions: Actions = {
	default: async ({ request }) => {
		try {
			const formData = await request.formData();

			const action = String(
				formData.get('action') || ''
			);

			const _id = String(
				formData.get('_id') || ''
			);

			if (action !== 'delete') {
				return fail(400, {
					error: 'Invalid action'
				});
			}

			if (!_id) {
				return fail(400, {
					error: 'Missing image ID'
				});
			}

			const image =
				await Image.findByIdAndDelete(_id);

			if (!image) {
				return fail(404, {
					error: 'Signature not found'
				});
			}

			return {
				success: true
			};
		} catch (error) {
			console.error(
				'Failed to delete signature:',
				error
			);

			return fail(500, {
				error:
					error instanceof Error
						? error.message
						: 'Failed to delete signature'
			});
		}
	}
};
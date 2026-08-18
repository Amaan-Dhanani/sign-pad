import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { Image } from '$lib/server/models';
import { FORM_PASSWORD } from '$env/static/private';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();

		const action = String(form.get('action') ?? '');
		const password = String(form.get('password') ?? '').trim();

		// -----------------------------
		// Password
		// -----------------------------

		if (!FORM_PASSWORD) {
			console.error('FORM_PASSWORD is not configured.');

			return fail(500, {
				error: 'Server password is not configured.'
			});
		}

		if (!password) {
			return fail(401, {
				error: 'Password is required.'
			});
		}

		if (password !== FORM_PASSWORD) {
			return fail(401, {
				error: 'Incorrect password.'
			});
		}

		// -----------------------------
		// Access
		// -----------------------------

		if (action === 'access') {
			try {
				const images = await Image.find({})
					.select('_id name image')
					.sort({ _id: -1 })
					.lean();

				return {
					success: true,
					images: images.map((image) => ({
						_id: image._id.toString(),
						name: image.name,
						image: image.image
					}))
				};
			} catch (error) {
				console.error('Load signatures failed:', error);

				return fail(500, {
					error: 'Failed to load signatures.'
				});
			}
		}

		// -----------------------------
		// Delete
		// -----------------------------

		if (action === 'delete') {
			const id = String(form.get('_id') ?? '').trim();

			if (!id) {
				return fail(400, {
					error: 'Missing signature ID.'
				});
			}

			try {
				const result = await Image.deleteOne({
					_id: id
				});

				if (result.deletedCount !== 1) {
					return fail(404, {
						error: 'Signature not found.'
					});
				}

				return {
					success: true
				};
			} catch (error) {
				console.error('Delete signature failed:', error);

				return fail(500, {
					error: 'Failed to delete signature.'
				});
			}
		}

		return fail(400, {
			error: 'Invalid action.'
		});
	}
};
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { Image } from '$lib/server/models';
import { FORM_PASSWORD } from '$env/static/private';

export const load: PageServerLoad = async () => {
	// Do not load signatures here.
	// Signatures are only returned after successful password authentication.
	return {
		authenticated: false,
		images: []
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		try {
			const formData = await request.formData();

			const action = String(formData.get('action') ?? '');
			const password = String(formData.get('password') ?? '').trim();

			/*
			 * ---------------------------------------------------------
			 * AUTHENTICATE
			 * ---------------------------------------------------------
			 */
			if (action === 'access') {
				if (!password) {
					return fail(400, {
						action: 'access',
						error: 'Password is required.'
					});
				}

				if (!/^\d+$/.test(password)) {
					return fail(400, {
						action: 'access',
						error: 'Password must contain numbers only.'
					});
				}

				if (!FORM_PASSWORD) {
					console.error('FORM_PASSWORD is not configured.');

					return fail(500, {
						action: 'access',
						error: 'Server password is not configured.'
					});
				}

				if (password !== FORM_PASSWORD) {
					return fail(401, {
						action: 'access',
						error: 'Incorrect password.'
					});
				}

				/*
				 * Password is correct.
				 *
				 * hooks.server.ts has already connected
				 * Mongoose to MongoDB.
				 */
				const images = await Image.find({})
					.select('_id name image')
					.sort({ _id: -1 })
					.lean();

				return {
					action: 'access',
					success: true,
					authenticated: true,
					images: images.map((image) => ({
						_id: image._id.toString(),
						name: image.name,
						image: image.image
					}))
				};
			}

			/*
			 * ---------------------------------------------------------
			 * DELETE SIGNATURE
			 * ---------------------------------------------------------
			 */
			if (action === 'delete') {
				const _id = String(formData.get('_id') ?? '').trim();

				if (!_id) {
					return fail(400, {
						action: 'delete',
						error: 'Missing image ID.'
					});
				}

				/*
				 * Require the same numeric password before deletion.
				 */
				if (!password) {
					return fail(401, {
						action: 'delete',
						error: 'Password is required.'
					});
				}

				if (!/^\d+$/.test(password)) {
					return fail(400, {
						action: 'delete',
						error: 'Password must contain numbers only.'
					});
				}

				if (!FORM_PASSWORD) {
					console.error('FORM_PASSWORD is not configured.');

					return fail(500, {
						action: 'delete',
						error: 'Server password is not configured.'
					});
				}

				if (password !== FORM_PASSWORD) {
					return fail(401, {
						action: 'delete',
						error: 'Incorrect password.'
					});
				}

				const image = await Image.findByIdAndDelete(_id);

				if (!image) {
					return fail(404, {
						action: 'delete',
						error: 'Signature not found.'
					});
				}

				return {
					action: 'delete',
					success: true,
					_id
				};
			}

			/*
			 * ---------------------------------------------------------
			 * INVALID ACTION
			 * ---------------------------------------------------------
			 */
			return fail(400, {
				error: 'Invalid action.'
			});
		} catch (error) {
			console.error('Data action failed:', error);

			return fail(500, {
				error: 'Request failed.'
			});
		}
	}
};
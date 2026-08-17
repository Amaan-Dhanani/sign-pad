import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { FORM_PASSWORD } from '$env/static/private';
import { Image } from '$lib/server/models';

export const actions: Actions = {
	default: async ({ request }) => {
		try {
			const formData = await request.formData();

			const name = String(formData.get('name') ?? '').trim();
			const path = String(formData.get('path') ?? '');
			const password = String(formData.get('password') ?? '');

			// Validate password format
			if (!password) {
				return fail(400, {
					error: 'Password is required.',
					success: false
				});
			}

			if (!/^\d+$/.test(password)) {
				return fail(400, {
					error: 'Password must contain numbers only.',
					success: false
				});
			}

			// Validate password
			if (password !== FORM_PASSWORD) {
				return fail(401, {
					error: 'Incorrect password.',
					success: false
				});
			}

			// Validate name
			if (!name) {
				return fail(400, {
					error: 'Name is required.',
					success: false
				});
			}

			// Validate signature
			if (!path) {
				return fail(400, {
					error: 'Signature is required.',
					success: false
				});
			}

			// Make sure the submitted signature is valid JSON
			let strokes: unknown;

			try {
				strokes = JSON.parse(path);
			} catch {
				return fail(400, {
					error: 'Invalid signature data.',
					success: false
				});
			}

			if (!Array.isArray(strokes) || strokes.length === 0) {
				return fail(400, {
					error: 'Signature is required.',
					success: false
				});
			}

			// Save using the existing Mongoose connection.
			// hooks.server.ts has already connected MongoDB.
			await Image.create({
				name,
				image: path,
				createdAt: new Date()
			});

			return {
				success: true
			};
		} catch (error) {
			console.error('Failed to save signature:', error);

			return fail(500, {
				error: 'Failed to save signature.',
				success: false
			});
		}
	}
};
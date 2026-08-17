import mongoose, { Schema } from 'mongoose';

const imageSchema = new Schema({
	name: {
		type: String,
		required: true,
	},
	image: {
		type: String,
		required: true,
	},
});

export const Image = mongoose.models.Image || mongoose.model('Image', imageSchema);

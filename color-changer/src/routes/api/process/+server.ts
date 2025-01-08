import { json } from '@sveltejs/kit';
import { Jimp } from 'jimp';
import { Vibrant } from 'node-vibrant/node';

export const POST = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;

		if (!file) {
			return json({ error: 'No image provided' }, { status: 400 });
		}

		// Read the image buffer
		const buffer = Buffer.from(await file.arrayBuffer());
		const image = await Jimp.read(buffer);

		// Extract color palette
		const palette = await Vibrant.from(buffer).getPalette();
		const colorPalette = Object.values(palette)
			.filter((swatch) => swatch)
			.map((swatch) => swatch._rgb);

		// Process the image
		image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
			const red = this.bitmap.data[idx];
			const green = this.bitmap.data[idx + 1];
			const blue = this.bitmap.data[idx + 2];

			// Find the closest color in the palette
			const closestColor = colorPalette.reduce((prev, curr) => {
				const prevDistance = Math.sqrt(
					Math.pow(prev[0] - red, 2) + Math.pow(prev[1] - green, 2) + Math.pow(prev[2] - blue, 2)
				);
				const currDistance = Math.sqrt(
					Math.pow(curr[0] - red, 2) + Math.pow(curr[1] - green, 2) + Math.pow(curr[2] - blue, 2)
				);
				return currDistance < prevDistance ? curr : prev;
			});

			// Update the pixel color
			this.bitmap.data[idx] = closestColor[0];
			this.bitmap.data[idx + 1] = closestColor[1];
			this.bitmap.data[idx + 2] = closestColor[2];
		});

		// Convert processed image to Base64
		const processedBuffer = await image.getBuffer('image/png');
		const processedImage = `data:image/png;base64,${processedBuffer.toString('base64')}`;

		// Respond with the processed image and color palette
		return json({
			processedImage,
			colorPalette
		});
	} catch (error) {
		return json({ error: error.message }, { status: 500 });
	}
};

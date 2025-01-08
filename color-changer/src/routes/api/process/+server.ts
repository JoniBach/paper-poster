import { json } from '@sveltejs/kit';
import { Jimp } from 'jimp';
import { Vibrant } from 'node-vibrant/node';
import { trace } from 'potrace';

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

		const rgbToHex = (rgb) => '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
		const colorPalletHex = colorPalette.map(rgbToHex);
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

		const seperatedColorImages = await Promise.all(
			colorPalette.map(async (color) => {
				const newImage = image
					.clone()
					.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
						const red = this.bitmap.data[idx];
						const green = this.bitmap.data[idx + 1];
						const blue = this.bitmap.data[idx + 2];

						if (red !== color[0] || green !== color[1] || blue !== color[2]) {
							this.bitmap.data[idx] = 255; // Set non-matching colors to white
							this.bitmap.data[idx + 1] = 255;
							this.bitmap.data[idx + 2] = 255;
						}
					});

				const newProcessedBuffer = await newImage.getBuffer('image/png'); // Use `getBufferAsync`
				const newProcessedImage = `data:image/png;base64,${newProcessedBuffer.toString('base64')}`;
				return newProcessedImage;
			})
		);

		const seperatedColorSvgs = await Promise.all(
			seperatedColorImages.map((base64Image, i) => {
				return new Promise((resolve, reject) => {
					// Decode Base64 to a Buffer
					const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64');

					// Trace the image and get SVG
					trace(imageBuffer, { color: colorPalletHex[i] }, (error, svg) => {
						if (error) {
							reject(error);
						} else {
							resolve(svg);
						}
					});
				});
			})
		);

		const mergeSvgs = (svgs) => {
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			const mergedSvgContent = svgs
				.map((svg) => {
					const viewBoxMatch = svg.match(/viewBox="([\d\s.-]+)"/);
					const widthMatch = svg.match(/width="([\d.]+)"/);
					const heightMatch = svg.match(/height="([\d.]+)"/);

					let contentMinX = 0,
						contentMinY = 0,
						contentWidth = 0,
						contentHeight = 0;

					if (viewBoxMatch) {
						const [x, y, width, height] = viewBoxMatch[1].split(' ').map(parseFloat);
						contentMinX = x;
						contentMinY = y;
						contentWidth = width;
						contentHeight = height;
					} else if (widthMatch && heightMatch) {
						contentWidth = parseFloat(widthMatch[1]);
						contentHeight = parseFloat(heightMatch[1]);
					}

					// Update overall bounds
					minX = Math.min(minX, contentMinX);
					minY = Math.min(minY, contentMinY);
					maxX = Math.max(maxX, contentMinX + contentWidth);
					maxY = Math.max(maxY, contentMinY + contentHeight);

					// Extract and return content inside the <svg> tags
					const contentMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
					return contentMatch ? contentMatch[1] : '';
				})
				.join('\n');

			const finalWidth = maxX - minX;
			const finalHeight = maxY - minY;

			const mergedSvgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${finalWidth} ${finalHeight}" width="${finalWidth}" height="${finalHeight}">`;
			const mergedSvgFooter = `</svg>`;

			// Return the merged SVG as a single string
			return `${mergedSvgHeader}\n${mergedSvgContent}\n${mergedSvgFooter}`;
		};
		const mergedSvg = mergeSvgs(seperatedColorSvgs, 500, 500);

		// Respond with the processed image and color palette
		return json({
			processedImage,
			colorPalette,
			seperatedColorImages,
			seperatedColorSvgs,
			colorPalletHex,
			mergedSvg
		});
	} catch (error) {
		return json({ error: error.message }, { status: 500 });
	}
};

import { json } from '@sveltejs/kit';
import { Jimp } from 'jimp';
import { Vibrant } from 'node-vibrant/node';
import { trace } from 'potrace';

// Utility functions
const rgbToHex = (rgb) => '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
const computeEuclideanDistance = (a, b) =>
	Math.sqrt(a.reduce((acc, val, i) => acc + Math.pow(val - b[i], 2), 0));
const findClosestColor = (color, palette) =>
	palette.reduce((prev, curr) =>
		computeEuclideanDistance(curr, color) < computeEuclideanDistance(prev, color) ? curr : prev
	);

// Function to process the image and update its colors
const processImage = (image, colorPalette) => {
	image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
		const red = this.bitmap.data[idx];
		const green = this.bitmap.data[idx + 1];
		const blue = this.bitmap.data[idx + 2];

		const closestColor = findClosestColor([red, green, blue], colorPalette);

		this.bitmap.data[idx] = closestColor[0];
		this.bitmap.data[idx + 1] = closestColor[1];
		this.bitmap.data[idx + 2] = closestColor[2];
	});
	return image;
};

// Function to separate colors in the image
const separateColors = async (image, colorPalette) => {
	return Promise.all(
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

			const newProcessedBuffer = await newImage.getBuffer('image/png');
			return `data:image/png;base64,${newProcessedBuffer.toString('base64')}`;
		})
	);
};

// Function to trace images and get SVGs
const traceImagesToSvgs = async (separatedColorImages, colorPalletHex) => {
	return Promise.all(
		separatedColorImages.map((base64Image, i) => {
			return new Promise((resolve, reject) => {
				const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64');
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
};

// Function to merge SVGs
const mergeSvgs = (svgs, width, height) => {
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

			minX = Math.min(minX, contentMinX);
			minY = Math.min(minY, contentMinY);
			maxX = Math.max(maxX, contentMinX + contentWidth);
			maxY = Math.max(maxY, contentMinY + contentHeight);

			const contentMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
			return contentMatch ? contentMatch[1] : '';
		})
		.join('\n');

	const finalWidth = maxX - minX;
	const finalHeight = maxY - minY;

	const mergedSvgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${finalWidth} ${finalHeight}" width="${finalWidth}" height="${finalHeight}">`;
	const mergedSvgFooter = `</svg>`;

	return `${mergedSvgHeader}\n${mergedSvgContent}\n${mergedSvgFooter}`;
};

// Main POST handler
export const POST = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;

		if (!file) {
			return json({ error: 'No image provided' }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const image = await Jimp.read(buffer);

		const palette = await Vibrant.from(buffer).getPalette();
		if (!palette) {
			return json({ error: 'Unable to extract color palette' }, { status: 500 });
		}

		const colorPalette = Object.values(palette)
			.filter((swatch) => swatch && swatch._rgb)
			.map((swatch) => swatch._rgb);

		if (colorPalette.length === 0) {
			return json({ error: 'Unable to extract color palette' }, { status: 500 });
		}

		const colorPalletHex = colorPalette.map(rgbToHex);

		const processedImage = await processImage(image, colorPalette);
		const processedBuffer = await processedImage.getBuffer('image/png');
		const processedImageBase64 = `data:image/png;base64,${processedBuffer.toString('base64')}`;

		const separatedColorImages = await separateColors(image, colorPalette);
		const separatedColorSvgs = await traceImagesToSvgs(separatedColorImages, colorPalletHex);
		const mergedSvg = mergeSvgs(separatedColorSvgs, 500, 500);

		return json({
			processedImage: processedImageBase64,
			colorPalette,
			separatedColorImages,
			separatedColorSvgs,
			colorPalletHex,
			mergedSvg
		});
	} catch (error) {
		console.error('Error processing image:', error);
		return json({ error: error.message }, { status: 500 });
	}
};

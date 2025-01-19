import { Jimp } from 'jimp';
import { Vibrant } from 'node-vibrant/node';
import { trace } from 'potrace';

/* ======================================
   1) Fundamental Utilities
   ====================================== */

/**
 * Converts an RGB array ([R, G, B]) to a hex string (#rrggbb).
 *
 * @param {number[]} rgb - The color array ([R, G, B]).
 * @returns {string} A hex string (e.g., "#ff00aa").
 */
function rgbArrayToHex(rgb) {
	return '#' + rgb.map((val) => Math.round(val).toString(16).padStart(2, '0')).join('');
}

/**
 * Calculates the Euclidean distance between two RGB color arrays.
 *
 * @param {number[]} colorA - The first color ([R, G, B]).
 * @param {number[]} colorB - The second color ([R, G, B]).
 * @returns {number} The Euclidean distance (0 -> identical, higher -> more different).
 */
function calculateEuclideanDistance(colorA, colorB) {
	return Math.sqrt(colorA.reduce((acc, val, idx) => acc + (val - colorB[idx]) ** 2, 0));
}

/**
 * Given a target [R, G, B], finds the nearest color in a palette of [R, G, B] arrays.
 *
 * @param {number[]} targetColor - The [R, G, B] color to match.
 * @param {number[][]} palette - An array of [R, G, B] colors to search.
 * @returns {number[]} The closest color ([R, G, B]) from the palette.
 */
function findNearestColorInPalette(targetColor, palette) {
	return palette.reduce((closest, current) => {
		const distCurrent = calculateEuclideanDistance(current, targetColor);
		const distClosest = calculateEuclideanDistance(closest, targetColor);
		return distCurrent < distClosest ? current : closest;
	});
}

/**
 * Converts a hex string (#rrggbb) to an [R, G, B] array.
 *
 * @param {string} hex - A hex string (e.g., "#ff00aa").
 * @returns {number[]} The corresponding [R, G, B] array.
 */
function hexToRgbArray(hex) {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return [r, g, b];
}

/* ======================================
   2) Core Image Transformations
   ====================================== */

/**
 * Applies a given palette (array of [R, G, B]) to each pixel of a Jimp image.
 * Every pixel is replaced with its nearest color from the palette.
 *
 * @param {import('jimp').default} baseImage - A Jimp image to transform.
 * @param {number[][]} rgbPalette - Array of [R, G, B] colors used as the palette.
 * @returns {import('jimp').default} A new Jimp image with palette colors applied.
 */
function applyPaletteToImage(baseImage, rgbPalette) {
	const imgCopy = baseImage.clone();
	imgCopy.scan(0, 0, imgCopy.bitmap.width, imgCopy.bitmap.height, function (x, y, idx) {
		const r = this.bitmap.data[idx];
		const g = this.bitmap.data[idx + 1];
		const b = this.bitmap.data[idx + 2];
		const [nr, ng, nb] = findNearestColorInPalette([r, g, b], rgbPalette);
		this.bitmap.data[idx + 0] = nr;
		this.bitmap.data[idx + 1] = ng;
		this.bitmap.data[idx + 2] = nb;
	});
	return imgCopy;
}

/**
 * Converts a Jimp image to greyscale and returns the result as a base64 PNG string.
 *
 * @param {import('jimp').default} baseImage - A Jimp image to convert.
 * @returns {Promise<string>} A base64-encoded PNG string of the greyscale image.
 */
async function convertToGreyscaleBase64(baseImage) {
	const greyscaleImg = baseImage.clone().greyscale();
	const pngBuffer = await greyscaleImg.getBuffer('image/png');
	return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

/* ======================================
   3) Color & Grayscale Separation
   ====================================== */

/**
 * For each [R, G, B] color in `rgbPalette`, creates a new image (base64 PNG)
 * where only that color remains and all others are turned white.
 *
 * @param {import('jimp').default} baseImage - The original image to process.
 * @param {number[][]} rgbPalette - Array of colors ([R, G, B]) used for separation.
 * @returns {Promise<string[]>} An array of base64 PNG strings, one per color.
 */
async function filterByPaletteColors(baseImage, rgbPalette) {
	return Promise.all(
		rgbPalette.map(async (colorArr) => {
			const imgCopy = baseImage.clone();
			imgCopy.scan(0, 0, imgCopy.bitmap.width, imgCopy.bitmap.height, function (x, y, idx) {
				const r = this.bitmap.data[idx];
				const g = this.bitmap.data[idx + 1];
				const b = this.bitmap.data[idx + 2];
				if (r !== colorArr[0] || g !== colorArr[1] || b !== colorArr[2]) {
					this.bitmap.data[idx + 0] = 255;
					this.bitmap.data[idx + 1] = 255;
					this.bitmap.data[idx + 2] = 255;
				}
			});
			const pngBuffer = await imgCopy.getBuffer('image/png');
			return `data:image/png;base64,${pngBuffer.toString('base64')}`;
		})
	);
}

const TOLERANCE = 5;

/**
 * For each hex color in `grayscalePalette`, creates a new image (base64 PNG)
 * where only that approximate grayscale is kept and all others become white.
 *
 * @param {import('jimp').default} baseImage - The original image to process.
 * @param {string[]} grayscalePalette - An array of hex colors (e.g. "#5f5f5f") to keep.
 * @returns {Promise<string[]>} An array of base64 PNG strings, one per grayscale swatch.
 */
async function filterByGreyscalePalette(baseImage, grayscalePalette) {
	return Promise.all(
		grayscalePalette.map(async (hex) => {
			const [r, g, b] = hexToRgbArray(hex);
			const approximateGrey = Math.round(0.3 * r + 0.59 * g + 0.11 * b);

			const imgCopy = baseImage.clone();
			imgCopy.scan(0, 0, imgCopy.bitmap.width, imgCopy.bitmap.height, function (x, y, idx) {
				const cr = this.bitmap.data[idx + 0];
				const cg = this.bitmap.data[idx + 1];
				const cb = this.bitmap.data[idx + 2];
				const pixelGrey = Math.round(0.3 * cr + 0.59 * cg + 0.11 * cb);

				if (Math.abs(pixelGrey - approximateGrey) <= TOLERANCE) {
					this.bitmap.data[idx + 0] = approximateGrey;
					this.bitmap.data[idx + 1] = approximateGrey;
					this.bitmap.data[idx + 2] = approximateGrey;
				} else {
					this.bitmap.data[idx + 0] = 255;
					this.bitmap.data[idx + 1] = 255;
					this.bitmap.data[idx + 2] = 255;
				}
			});
			const pngBuffer = await imgCopy.getBuffer('image/png');
			return `data:image/png;base64,${pngBuffer.toString('base64')}`;
		})
	);
}

/* ======================================
   4) SVG Generation and Merging
   ====================================== */

/**
 * Uses potrace to convert an array of base64 PNG images into SVG strings.
 * A corresponding hexPalette is used for each image's traced color.
 *
 * @param {string[]} base64Images - An array of base64-encoded PNG strings.
 * @param {string[]} hexPalette - An array of hex colors (e.g., ['#ff0000', '#00ff00']).
 * @returns {Promise<string[]>} An array of SVG strings, one per image.
 */
async function traceBase64ImagesToSvgs(base64Images, hexPalette) {
	return Promise.all(
		base64Images.map((base64Img, idx) => {
			return new Promise((resolve, reject) => {
				const buffer = Buffer.from(base64Img.split(',')[1], 'base64');
				trace(buffer, { color: hexPalette[idx] }, (error, svg) => {
					if (error) return reject(error);
					resolve(svg);
				});
			});
		})
	);
}

/**
 * Merges multiple SVG strings into one by concatenating their contents inside a single
 * <svg> tag, adjusting the viewBox to encompass all paths.
 *
 * @param {string[]} svgList - An array of SVG strings.
 * @returns {string} A single merged SVG string.
 */
function combineSvgLayers(svgList) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	const combinedContent = svgList
		.map((svg) => {
			const viewBoxMatch = svg.match(/viewBox="([\d\s.-]+)"/);
			const widthMatch = svg.match(/width="([\d.]+)"/);
			const heightMatch = svg.match(/height="([\d.]+)"/);

			let localMinX = 0;
			let localMinY = 0;
			let localWidth = 0;
			let localHeight = 0;

			if (viewBoxMatch) {
				const [x, y, w, h] = viewBoxMatch[1].split(' ').map(parseFloat);
				localMinX = x;
				localMinY = y;
				localWidth = w;
				localHeight = h;
			} else if (widthMatch && heightMatch) {
				localWidth = parseFloat(widthMatch[1]);
				localHeight = parseFloat(heightMatch[1]);
			}

			minX = Math.min(minX, localMinX);
			minY = Math.min(minY, localMinY);
			maxX = Math.max(maxX, localMinX + localWidth);
			maxY = Math.max(maxY, localMinY + localHeight);

			const contentMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
			return contentMatch ? contentMatch[1] : '';
		})
		.join('\n');

	const finalWidth = maxX - minX;
	const finalHeight = maxY - minY;
	const header = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${finalWidth} ${finalHeight}" width="${finalWidth}" height="${finalHeight}">`;
	const footer = '</svg>';

	return `${header}\n${combinedContent}\n${footer}`;
}

/**
 * Takes an array of SVG strings and converts any fill attributes to 'none'
 * while applying a black stroke.
 *
 * @param {string[]} svgList - An array of SVG strings.
 * @returns {string[]} A new array of SVG strings, each outlined (fill=none).
 */
function outlineSvgPaths(svgList) {
	return svgList.map((svg) =>
		svg
			.replace(/fill="[^"]*"/g, 'fill="none"')
			.replace(/stroke="[^"]*"/g, 'stroke="black" stroke-width="1"')
	);
}

/* ======================================
   5) Helper Functions
   ====================================== */

/**
 * Converts a File object (from FormData) into a Node.js Buffer.
 *
 * @param {File} file - A File from form data.
 * @returns {Promise<Buffer>} The buffer representation of that file.
 */
async function fileToBuffer(file) {
	return Buffer.from(await file.arrayBuffer());
}

/**
 * Converts a Buffer to a Jimp image.
 *
 * @param {Buffer} buffer - Binary data of an image file.
 * @returns {Promise<import('jimp').default>} A Jimp image instance.
 */
async function bufferToJimpImage(buffer) {
	return Jimp.read(buffer);
}

/**
 * Creates a Vibrant palette from a buffer, optionally limiting the max color count.
 *
 * @param {Buffer} buffer - An image buffer.
 * @param {number} [maxColorCount=6] - Maximum number of swatches to extract.
 * @returns {Promise<any>} A Vibrant palette object containing swatches.
 */
async function extractVibrantPalette(buffer, maxColorCount = 6) {
	return Vibrant.from(buffer).quality(2).maxColorCount(maxColorCount).getPalette();
}

/**
 * Extracts the [R, G, B] arrays from a Vibrant palette object.
 *
 * @param {any} vibrantObject - The palette object returned by Vibrant.
 * @returns {number[][]} An array of [R, G, B] colors.
 */
function extractRgbFromVibrantObject(vibrantObject) {
	return Object.values(vibrantObject)
		.filter((swatch) => swatch && swatch._rgb)
		.map((swatch) => swatch._rgb);
}

/**
 * Converts an array of [R, G, B] arrays into an array of hex strings (#rrggbb).
 *
 * @param {number[][]} rgbPalette - Array of [R, G, B] colors.
 * @returns {string[]} An array of hex strings.
 */
function convertRgbPaletteToHex(rgbPalette) {
	return rgbPalette.map(rgbArrayToHex);
}

/**
 * Scans a Jimp image, extracting every unique [R, G, B] color and
 * returning them as hex strings.
 *
 * @param {import('jimp').default} jimpImage - A Jimp image instance.
 * @returns {string[]} An array of all unique hex colors found in the image.
 */
function extractAllColorsInImage(jimpImage) {
	const colorSet = new Set();
	jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, function (x, y, idx) {
		const r = this.bitmap.data[idx + 0];
		const g = this.bitmap.data[idx + 1];
		const b = this.bitmap.data[idx + 2];
		colorSet.add(rgbArrayToHex([r, g, b]));
	});
	return Array.from(colorSet);
}

/* ======================================
   6) Main Vectori Function
   ====================================== */

/**
 * Main function that takes an image File, extracts vibrant color and grayscale palettes,
 * generates separated images and SVGs, and returns a structured object with dot-notation
 * access (e.g. .image({ fill: 'color' }), .palette.vibrant({ fill: 'greyscale' }), etc.).
 *
 * @param {File} file - The image file input (e.g., from an HTML form).
 * @returns {Promise<{
 *  image: (opts: { fill: 'color' | 'greyscale' }) => string,
 *  palette: {
 *    vibrant: (opts: { fill?: 'color' | 'greyscale' }) => string[],
 *    all: (opts: { fill?: 'color' | 'greyscale' }) => string[]
 *  },
 *  components: {
 *    image: (opts: { fill: 'color' | 'greyscale' }) => string[],
 *    svg: (opts: { fill: 'color' | 'greyscale' | 'outline' }) => string[]
 *  },
 *  svg: (opts: { fill: 'color' | 'greyscale' | 'outline' | 'color-outline' | 'greyscale-outline' }) => string
 * }>}
 * An object with various methods to retrieve processed images, palettes, separated components, and SVGs.
 */
export async function vectori(file) {
	// 1) Convert file -> buffer -> Jimp image
	const fileBuffer = await fileToBuffer(file);
	const originalJimpImage = await bufferToJimpImage(fileBuffer);

	// 2) Vibrant color palette (6 color swatches) from the original
	const vibrantColorObject = await extractVibrantPalette(fileBuffer, 6);
	const colorRgbPalette = extractRgbFromVibrantObject(vibrantColorObject);
	const colorHexPalette = convertRgbPaletteToHex(colorRgbPalette);

	// 3) Apply the color palette to the original image
	const paletteAppliedImage = applyPaletteToImage(originalJimpImage, colorRgbPalette);
	const paletteImageBuffer = await paletteAppliedImage.getBuffer('image/png');
	const paletteImageBase64 = `data:image/png;base64,${paletteImageBuffer.toString('base64')}`;

	// 4) Generate a greyscale version (base64) of the original
	const greyscaleImageBase64 = await convertToGreyscaleBase64(originalJimpImage);

	// 5) Vibrant grayscale palette (6 swatches)
	const greyscaleClone = originalJimpImage.clone().greyscale();
	const grayscaleBuffer = await greyscaleClone.getBuffer('image/png');
	const vibrantGrayscaleObject = await extractVibrantPalette(grayscaleBuffer, 6);
	const grayscaleRgbPalette = extractRgbFromVibrantObject(vibrantGrayscaleObject);
	const grayscaleHexPalette = convertRgbPaletteToHex(grayscaleRgbPalette);

	// 6) Separated images (color & grayscale)
	const separatedColorImages = await filterByPaletteColors(originalJimpImage, colorRgbPalette);
	const separatedGrayscaleImages = await filterByGreyscalePalette(
		originalJimpImage,
		grayscaleHexPalette
	);

	// 7) Trace to SVG
	const colorSvgs = await traceBase64ImagesToSvgs(separatedColorImages, colorHexPalette);
	const grayscaleSvgs = await traceBase64ImagesToSvgs(
		separatedGrayscaleImages,
		grayscaleHexPalette
	);

	// 8) Create outlined color SVGs
	const outlinedColorSvgs = outlineSvgPaths(colorSvgs);

	// 9) Merge as needed
	const mergedColorSvg = combineSvgLayers(colorSvgs);
	const mergedGrayscaleSvg = combineSvgLayers(grayscaleSvgs);
	const mergedOutlinedSvg = combineSvgLayers(outlinedColorSvgs);
	const mergedColorOutlinedSvg = combineSvgLayers([...colorSvgs, ...outlinedColorSvgs]);
	const mergedGrayscaleOutlinedSvg = combineSvgLayers([...grayscaleSvgs, ...outlinedColorSvgs]);

	// 10) Get ALL unique colors from the original and from the greyscale version
	const allColorHexList = extractAllColorsInImage(originalJimpImage);
	const allGreyscaleHexList = extractAllColorsInImage(greyscaleClone);

	// ============================
	// Return the final structured object
	// ============================
	const res = {
		/**
		 * Returns a single base64 PNG string representing either the color-applied image
		 * or the greyscale image.
		 *
		 * @param {{ fill: 'color' | 'greyscale' }} opts - Fill option.
		 * @returns {string} Base64-encoded PNG data URI.
		 */
		image: ({ fill = 'color' }) => {
			if (fill === 'color') return paletteImageBase64;
			if (fill === 'greyscale') return greyscaleImageBase64;
		},

		/**
		 * Returns two types of palettes:
		 * 1. `vibrant({ fill })` => an array of Vibrant-derived hex swatches (color or greyscale).
		 * 2. `all({ fill })` => all unique hex colors in the original or greyscale image.
		 */
		palette: {
			/**
			 * Returns the ~6-swatch Vibrant palette in hex form, either for color or greyscale.
			 *
			 * @param {{ fill?: 'color' | 'greyscale' }} opts - Palette fill choice.
			 * @returns {string[]} Array of hex colors.
			 */
			vibrant: ({ fill = 'color' } = {}) => {
				if (fill === 'color') return colorHexPalette;
				if (fill === 'greyscale') return grayscaleHexPalette;
			},
			/**
			 * Returns all unique hex colors found in the image (if fill='color')
			 * or in the greyscale image (if fill='greyscale').
			 *
			 * @param {{ fill?: 'color' | 'greyscale' }} opts - Palette fill choice.
			 * @returns {string[]} Array of hex colors.
			 */
			all: ({ fill = 'color' } = {}) => {
				if (fill === 'color') return allColorHexList;
				if (fill === 'greyscale') return allGreyscaleHexList;
			}
		},

		/**
		 * Provides access to separated images and SVGs for each palette color,
		 * allowing finer control.
		 */
		components: {
			/**
			 * Returns an array of base64 PNGs for each separated color or greyscale swatch.
			 *
			 * @param {{ fill: 'color' | 'greyscale' }} opts - Choose color or greyscale separation.
			 * @returns {string[]} Array of base64 PNG strings.
			 */
			image: ({ fill = 'color' }) => {
				if (fill === 'color') return separatedColorImages;
				if (fill === 'greyscale') return separatedGrayscaleImages;
			},
			/**
			 * Returns an array of SVG strings, one per separated swatch.
			 * 'outline' returns the outline version of the color SVGs.
			 *
			 * @param {{ fill: 'color' | 'greyscale' | 'outline' }} opts - Type of SVG to return.
			 * @returns {string[]} Array of SVG strings.
			 */
			svg: ({ fill = 'color' }) => {
				if (fill === 'color') return colorSvgs;
				if (fill === 'greyscale') return grayscaleSvgs;
				if (fill === 'outline') return outlinedColorSvgs;
			}
		},

		/**
		 * Returns merged (combined) SVGs depending on the fill option.
		 */
		svg: ({ fill = 'color' }) => {
			if (fill === 'color') return mergedColorSvg;
			if (fill === 'greyscale') return mergedGrayscaleSvg;
			if (fill === 'outline') return mergedOutlinedSvg;
			if (fill === 'color-outline') return mergedColorOutlinedSvg;
			if (fill === 'greyscale-outline') return mergedGrayscaleOutlinedSvg;
		}
	};

	return res;
}

import { Jimp } from 'jimp';
import { Vibrant } from 'node-vibrant/node';
import { trace } from 'potrace';

/* ======================================
   1) Fundamental Utilities
   ====================================== */

/**
 * Convert [R, G, B] -> #rrggbb hex string
 */
const rgbArrayToHex = (rgb) => {
	return '#' + rgb.map((val) => Math.round(val).toString(16).padStart(2, '0')).join('');
};

/**
 * Calculate Euclidean distance between two [R, G, B] arrays.
 */
const calculateEuclideanDistance = (colorA, colorB) => {
	return Math.sqrt(colorA.reduce((acc, val, idx) => acc + (val - colorB[idx]) ** 2, 0));
};

/**
 * Given a target [R,G,B], find the nearest color in `palette` (array of [R,G,B]).
 */
const findNearestColorInPalette = (targetColor, palette) => {
	return palette.reduce((closest, current) => {
		const distCurrent = calculateEuclideanDistance(current, targetColor);
		const distClosest = calculateEuclideanDistance(closest, targetColor);
		return distCurrent < distClosest ? current : closest;
	});
};

/**
 * Convert #rrggbb -> [r, g, b].
 */
const hexToRgbArray = (hex) => {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return [r, g, b];
};

/* ======================================
   2) Core Image Transformations
   ====================================== */

/**
 * Returns a new Jimp image where each pixel is replaced by the nearest color
 * in `rgbPalette`.
 */
const applyPaletteToImage = (baseImage, rgbPalette) => {
	const imgCopy = baseImage.clone();
	imgCopy.scan(0, 0, imgCopy.bitmap.width, imgCopy.bitmap.height, function (x, y, idx) {
		const r = this.bitmap.data[idx];
		const g = this.bitmap.data[idx + 1];
		const b = this.bitmap.data[idx + 2];
		const [nr, ng, nb] = findNearestColorInPalette([r, g, b], rgbPalette);
		this.bitmap.data[idx] = nr;
		this.bitmap.data[idx + 1] = ng;
		this.bitmap.data[idx + 2] = nb;
	});
	return imgCopy;
};

/**
 * Convert a Jimp image to greyscale and return as a base64 PNG.
 */
const convertToGreyscaleBase64 = async (baseImage) => {
	const greyscaleImg = baseImage.clone().greyscale();
	const pngBuffer = await greyscaleImg.getBuffer('image/png');
	return `data:image/png;base64,${pngBuffer.toString('base64')}`;
};

/* ======================================
   3) Color & Grayscale Separation
   ====================================== */

/**
 * For each color in `rgbPalette`, produce a base64 PNG containing only that color.
 * All other pixels become white.
 */
const filterByPaletteColors = async (baseImage, rgbPalette) => {
	return Promise.all(
		rgbPalette.map(async (colorArr) => {
			const imgCopy = baseImage.clone();
			imgCopy.scan(0, 0, baseImage.bitmap.width, baseImage.bitmap.height, function (x, y, idx) {
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
};

const TOLERANCE = 5;

/**
 * For each grayscale hex, produce a base64 PNG where only that approximate
 * grayscale is retained. All others become white.
 */
const filterByGreyscalePalette = async (baseImage, grayscalePalette) => {
	return Promise.all(
		grayscalePalette.map(async (hex) => {
			// Vibrant swatches might not be pure grey, so interpret them as grey
			const [r, g, b] = hexToRgbArray(hex);
			const approximateGrey = Math.round(0.3 * r + 0.59 * g + 0.11 * b);

			const imgCopy = baseImage.clone();
			imgCopy.scan(0, 0, imgCopy.bitmap.width, imgCopy.bitmap.height, function (x, y, idx) {
				const cr = this.bitmap.data[idx];
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
};

/* ======================================
   4) SVG Generation and Merging
   ====================================== */

/**
 * Convert an array of base64 PNG images into SVGs using `potrace.trace`.
 * `hexPalette` is used for the fill color in each path.
 */
const traceBase64ImagesToSvgs = async (base64Images, hexPalette) => {
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
};

/**
 * Merge multiple SVG strings into one by concatenating their contents.
 */
const combineSvgLayers = (svgList) => {
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
};

/**
 * For each SVG string, remove any fill attributes and add a black stroke.
 */
const outlineSvgPaths = (svgList) => {
	return svgList.map((svg) =>
		svg
			.replace(/fill="[^"]*"/g, 'fill="none"')
			.replace(/stroke="[^"]*"/g, 'stroke="black" stroke-width="1"')
	);
};

/* ======================================
   5) Helper Functions
   ====================================== */

/**
 * Convert a File object -> Buffer
 */
const fileToBuffer = async (file) => Buffer.from(await file.arrayBuffer());

/**
 * Convert Buffer -> Jimp image
 */
const bufferToJimpImage = async (buffer) => Jimp.read(buffer);

/**
 * Create a Vibrant palette from a Buffer; pass optional maxColorCount if needed
 */
const extractVibrantPalette = async (buffer, maxColorCount = 6) => {
	return Vibrant.from(buffer).quality(2).maxColorCount(maxColorCount).getPalette();
};

/**
 * Extract [R, G, B] arrays from Vibrant's palette object
 */
const extractRgbFromVibrantObject = (vibrantObject) => {
	return Object.values(vibrantObject)
		.filter((swatch) => swatch && swatch._rgb)
		.map((swatch) => swatch._rgb);
};

/**
 * Convert an array of [R,G,B] arrays -> array of #rrggbb
 */
const convertRgbPaletteToHex = (rgbPalette) => rgbPalette.map(rgbArrayToHex);

/**
 * Extract all unique hex colors from any Jimp image.
 */
const extractAllColorsInImage = (jimpImage) => {
	const colorSet = new Set();
	jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, function (x, y, idx) {
		const r = this.bitmap.data[idx + 0];
		const g = this.bitmap.data[idx + 1];
		const b = this.bitmap.data[idx + 2];
		colorSet.add(rgbArrayToHex([r, g, b]));
	});
	return Array.from(colorSet);
};

/* ======================================
   6) Main Vectori Function
   ====================================== */

export const vectori = async (file) => {
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
	//     So we can do .all({ fill: 'color' }) or .all({ fill: 'greyscale' }).
	const allColorHexList = extractAllColorsInImage(originalJimpImage);
	const allGreyscaleHexList = extractAllColorsInImage(greyscaleClone);

	// ============================
	// Return the final structured object
	// ============================
	const res = {
		image: ({ fill = 'color' }) => {
			if (fill === 'color') return paletteImageBase64;
			if (fill === 'greyscale') return greyscaleImageBase64;
		},
		palette: {
			/**
			 * `vibrant({ fill })` returns our ~6-swatch palette from Vibrant,
			 * either color-based or grayscale-based.
			 */
			vibrant: ({ fill = 'color' }) => {
				if (fill === 'color') return colorHexPalette;
				if (fill === 'greyscale') return grayscaleHexPalette;
			},
			/**
			 * `all({ fill })` returns ALL colors discovered in the entire image
			 * or the entire greyscale version.
			 */
			all: ({ fill = 'color' }) => {
				if (fill === 'color') return allColorHexList;
				if (fill === 'greyscale') return allGreyscaleHexList;
			}
		},
		components: {
			image: ({ fill = 'color' }) => {
				if (fill === 'color') return separatedColorImages;
				if (fill === 'greyscale') return separatedGrayscaleImages;
			},
			svg: ({ fill = 'color' }) => {
				if (fill === 'color') return colorSvgs;
				if (fill === 'greyscale') return grayscaleSvgs;
				if (fill === 'outline') return outlinedColorSvgs;
			}
		},
		svg: ({ fill = 'color' }) => {
			if (fill === 'color') return mergedColorSvg;
			if (fill === 'greyscale') return mergedGrayscaleSvg;
			if (fill === 'outline') return mergedOutlinedSvg;
			if (fill === 'color-outline') return mergedColorOutlinedSvg;
			if (fill === 'greyscale-outline') return mergedGrayscaleOutlinedSvg;
		}
	};

	return res;
};

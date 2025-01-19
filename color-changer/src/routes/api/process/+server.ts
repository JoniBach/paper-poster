import { vectori } from '$lib/Vectori';
import { json } from '@sveltejs/kit';

// Main POST handler
export const POST = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;

		if (!file) {
			return json({ error: 'No image provided' }, { status: 400 });
		}
		const processed = await vectori(file);
		return json({
			// images
			colorImage: processed.image({ fill: 'color' }),
			greyscaleImage: processed.image({ fill: 'greyscale' }),

			// palettes
			colorPallet: processed.palette.vibrant({ fill: 'color' }),
			greyscalePalette: processed.palette.vibrant({ fill: 'greyscale' }),
			allColorPallets: processed.palette.all({ fill: 'color' }),
			allGreyscalePallets: processed.palette.all({ fill: 'greyscale' }),
			// colorPallet: processed.palette({ fill: 'color' }),
			// greyscalePalette: processed.palette({ fill: 'greyscale' }),

			// separated images
			separatedColorImages: processed.components.image({ fill: 'color' }),
			separatedGreyscaleImages: processed.components.image({ fill: 'greyscale' }),

			// separated svgs
			separatedColorSvgs: processed.components.svg({ fill: 'color' }),
			seperatedGreyscaleSvgs: processed.components.svg({ fill: 'greyscale' }),
			seperatedOutlinedSvgs: processed.components.svg({ fill: 'outline' }),

			// merged svgs
			mergedColorSvg: processed.svg({ fill: 'color' }),
			mergedColorOutlinedSvg: processed.svg({ fill: 'color-outline' }),
			mergedGreyscaleSvg: processed.svg({ fill: 'greyscale' }),
			mergedGreyscaleOutlinedSvg: processed.svg({ fill: 'greyscale-outline' }),
			mergedOutlinedSvg: processed.svg({ fill: 'outline' })
		});
	} catch (error) {
		console.error('Error processing image:', error);
		return json({ error: error.message }, { status: 500 });
	}
};

import { processFile } from '$lib/Vectori';
import { json } from '@sveltejs/kit';

// Main POST handler
export const POST = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;

		if (!file) {
			return json({ error: 'No image provided' }, { status: 400 });
		}
		const vectori = await processFile(file);
		return json({
			// images
			colorImage: vectori.image({ fill: 'color' }),
			greyscaleImage: vectori.image({ fill: 'greyscale' }),

			// palettes
			colorPallet: vectori.palette({ fill: 'color' }),
			greyscalePalette: vectori.palette({ fill: 'greyscale' }),

			// separated images
			separatedColorImages: vectori.components.image({ fill: 'color' }),
			separatedGreyscaleImages: vectori.components.image({ fill: 'greyscale' }),

			// separated svgs
			separatedColorSvgs: vectori.components.svg({ fill: 'color' }),
			seperatedGreyscaleSvgs: vectori.components.svg({ fill: 'greyscale' }),
			seperatedOutlinedSvgs: vectori.components.svg({ fill: 'outline' }),

			// merged svgs
			mergedColorSvg: vectori.svg({ fill: 'color' }),
			mergedColorOutlinedSvg: vectori.svg({ fill: 'color-outline' }),
			mergedGreyscaleSvg: vectori.svg({ fill: 'greyscale' }),
			mergedGreyscaleOutlinedSvg: vectori.svg({ fill: 'greyscale-outline' }),
			mergedOutlinedSvg: vectori.svg({ fill: 'outline' })
		});
	} catch (error) {
		console.error('Error processing image:', error);
		return json({ error: error.message }, { status: 500 });
	}
};

<script>
	// import { vectori } from "$lib/Vectori";
  import { onMount } from "svelte";
// import { vectori } from '$lib/Vectori';
import { vectori } from 'vectori';

  // import { vectori } from 'vectori';
  let originalImage = null; // Original image URL
  let processedImage = null; // Processed image URL
  let extractedColors = []; // Extracted color palette
  let colorImages = []; // Array of color-shifted image URLs
  let colorSvgs = []; // Array of color-specific SVGs
  let imageFile = null; // File input
  let svgImage = null; // SVG image
  let greyscaleImage = null; // Greyscale image URL
  let greyscalePalette = []; // Extracted greyscale palette
  let greyscaleImages = []; // Array of separated greyscale image URLs
  let separatedGreyscaleSvgs = []; // Array of separated greyscale SVGs
  let mergedGreyscaleSvg = null; // Merged greyscale SVG
  let outlineSvgs = []; // Array of outline SVGs
  let mergedOutlineSvg = null; // Merged outline SVG
  let mergedGreyscaleOutlinedSvg = null; // Merged color line SVG


  const handleImage = async (file) => {
		// const processed = await vectori(file);

    // return ({
		// 	// images
		// 	colorImage: processed.image({ fill: 'color' }),
		// 	greyscaleImage: processed.image({ fill: 'greyscale' }),

		// 	// palettes
		// 	colorPallet: processed.palette.popular({ fill: 'color' }),
		// 	greyscalePalette: processed.palette.popular({ fill: 'greyscale' }),
		// 	allColorPallets: processed.palette.all({ fill: 'color' }),
		// 	allGreyscalePallets: processed.palette.all({ fill: 'greyscale' }),

		// 	// separated images
		// 	separatedColorImages: processed.components.image({ fill: 'color' }),
		// 	separatedGreyscaleImages: processed.components.image({ fill: 'greyscale' }),

		// 	// separated svgs
		// 	separatedColorSvgs: processed.components.svg({ fill: 'color' }),
		// 	seperatedGreyscaleSvgs: processed.components.svg({ fill: 'greyscale' }),
		// 	seperatedOutlinedSvgs: processed.components.svg({ fill: 'outline' }),

		// 	// merged svgs
		// 	mergedColorSvg: processed.svg({ fill: 'color' }),
		// 	mergedColorOutlinedSvg: processed.svg({ fill: 'color-outline' }),
		// 	mergedGreyscaleSvg: processed.svg({ fill: 'greyscale' }),
		// 	mergedGreyscaleOutlinedSvg: processed.svg({ fill: 'greyscale-outline' }),
		// 	mergedOutlinedSvg: processed.svg({ fill: 'outline' })
		// });
  
  }
  const processImage = async () => {
    if (!imageFile) return;

    const formData = new FormData();
    formData.append("image", imageFile);


    const res = await handleImage(imageFile)
    console.log(res)

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process the image.");
      }

      const data = await response.json();
      originalImage = URL.createObjectURL(imageFile); // Set original image
      processedImage = data.processedImage; // Set processed image (Base64)
      extractedColors = data.colorPallet; // Set extracted colors

      console.log(extractedColors);
      colorImages = data.separatedColorImages;
      colorSvgs = data.separatedColorSvgs;
      svgImage = data.mergedColorSvg;
      greyscaleImage = data.greyscaleImage; // Set greyscale image (Base64)
      greyscalePalette = data.greyscalePalette; // Set greyscale palette
      greyscaleImages = data.separatedGreyscaleImages; // Set separated greyscale images
      separatedGreyscaleSvgs = data.seperatedGreyscaleSvgs; // Set separated greyscale SVGs
      mergedGreyscaleSvg = data.mergedGreyscaleSvg; // Set merged greyscale SVG
      outlineSvgs = data.seperatedOutlinedSvgs; // Set outline SVGs
      mergedOutlineSvg = data.mergedOutlinedSvg; // Set merged outline SVG
      mergedGreyscaleOutlinedSvg = data.mergedGreyscaleOutlinedSvg; // Set merged color line SVG
      console.log(data);
    } catch (error) {
      console.error("Error processing image:", error.message);
      alert("An error occurred while processing the image.");
    }
  };


</script>



<h1>Image Color Quantization</h1>

<!-- File input -->
<input type="file" accept="image/*" on:change={(e) => (imageFile = e.target.files[0])} />
<button on:click={processImage}>Process Image</button>
<div class="images">
  <!-- Original image -->
  {#if originalImage}
    <div>
      <h2>Original Image</h2>
      <img src={originalImage} alt="Original" />
    </div>
  {/if}
    </div>
    <!-- Images container -->
<div class="images">
  <!-- Original image -->
 

  <!-- Processed image -->
  {#if processedImage}
    <div>
      <h2>Color-Shifted Image</h2>
      <img src={processedImage} alt="Processed" />
    </div>
  {/if}



<!-- SVG image -->
  {#if svgImage}
  <div>
    <h2>SVG Image</h2>
    <div class='svg'>
      {@html svgImage}

  </div>
  </div>
{/if}
  <!-- Greyscale image -->
  {#if greyscaleImage}
    <div>
      <h2>Greyscale Image</h2>
      <img src={greyscaleImage} alt="Greyscale" />
    </div>
  {/if}
  <!-- Merged greyscale SVG -->
  {#if mergedGreyscaleSvg}
    <div>
      <h2>Merged Greyscale SVG</h2>
      <div class='svg'>
        {@html mergedGreyscaleSvg}
      </div>
    </div>
  {/if}
  <!-- Merged outline SVG -->
  {#if mergedOutlineSvg}
    <div>
      <h2>Merged Outline SVG</h2>
      <div class='svg'>
        {@html mergedOutlineSvg}
      </div>
    </div>
  {/if}

  <!-- Merged color line SVG -->
  {#if mergedGreyscaleOutlinedSvg}
    <div>
      <h2>Merged greyscale outline SVG</h2>
      <div class='svg'>
        {@html mergedGreyscaleOutlinedSvg}
      </div>
    </div>
  {/if}
</div>

  <!-- Processed image -->


<!-- Extracted colors -->
{#if extractedColors.length > 0}
  <h2>Extracted Colors</h2>
  <div>
    {#each extractedColors as color}
      <div class="color-box">
        <div
          class="color-preview"
          style="background-color: {color}"
        ></div>
        <span>{color}</span>
      </div>
    {/each}
  </div>
{/if}


<!-- Greyscale palette -->
{#if greyscalePalette.length > 0}
  <h2>Greyscale Palette</h2>
  <div>
    {#each greyscalePalette as hex}
      <div class="color-box">
        <div
          class="color-preview"
          style="background-color: {hex}"
        ></div>
        <span>{hex}</span>
      </div>
    {/each}
  </div>
{/if}

<!-- Color-shifted images -->
{#if colorImages.length > 0}
  <h2>Color-Specific Images</h2>
  <div class="color-images">
    {#each colorImages as imgSrc}
      <img src={imgSrc} alt="Color-Specific" />
    {/each}
  </div>
{/if}


<!-- Color-specific SVGs -->
{#if colorSvgs.length > 0}
  <h2>Color-Specific SVGs</h2>
  <div class="color-svgs">
    {#each colorSvgs as svgContent}
      <div>
        {@html svgContent}
      </div>
    {/each}
  </div>
{/if}

<!-- Separated greyscale images -->
{#if greyscaleImages.length > 0}
  <h2>Separated Greyscale Images</h2>
  <div class="greyscale-images">
    {#each greyscaleImages as imgSrc}
      <img src={imgSrc} alt="Greyscale-Specific" />
    {/each}
  </div>
{/if}

<!-- Separated greyscale SVGs -->
{#if separatedGreyscaleSvgs.length > 0}
  <h2>Separated Greyscale SVGs</h2>
  <div class="greyscale-svgs">
    {#each separatedGreyscaleSvgs as svgContent}
      <div>
        {@html svgContent}
      </div>
    {/each}
  </div>
{/if}

<!-- Outline SVGs -->
{#if outlineSvgs.length > 0}
  <h2>Outline SVGs</h2>
  <div class="color-svgs">
    {#each outlineSvgs as svgContent}
      <div>
        {@html svgContent}
      </div>
    {/each}
  </div>
{/if}

<style>
  .color-box {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .color-preview {
    width: 30px;
    height: 30px;
    border: 1px solid #ccc;
  }
  .images {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  }
  .images img  {
    max-width: 300px;
    height: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .svg {
  max-width: 300px;
  max-height: 300px;
  width: auto;
  height: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* Ensures the SVG content doesn't overflow the container */
}

.svg svg {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  display: block; /* Prevents inline spacing issues with SVGs */
}

  .color-images {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
  .color-images img {
    max-width: 100px;
    height: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .color-svgs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
   /* Updated .color-svgs styling */
   .color-svgs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
  .color-svgs div {
    width: 100px;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .color-svgs svg {
    max-width: 100%;
    max-height: 100%;
  }
  .greyscale-images {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
  .greyscale-images img {
    max-width: 100px;
    height: auto;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .greyscale-svgs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
  .greyscale-svgs div {
    width: 100px;
    height: 100px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .greyscale-svgs svg {
    max-width: 100%;
    max-height: 100%;
  }
</style>
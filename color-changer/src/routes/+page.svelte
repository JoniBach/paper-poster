<script>
  import { onMount } from "svelte";

  let originalImage = null; // Original image URL
  let processedImage = null; // Processed image URL
  let extractedColors = []; // Extracted color palette
  let colorImages = []; // Array of color-shifted image URLs
  let colorSvgs = []; // Array of color-specific SVGs
  let imageFile = null; // File input
  let svgImage = null; // SVG image

  const processImage = async () => {
    if (!imageFile) return;

    const formData = new FormData();
    formData.append("image", imageFile);

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
      extractedColors = data.colorPalette.map((rgb) => {
        const hex = `#${rgb.map((val) => val.toString(16).padStart(2, "0")).join("")}`;
        return { rgb, hex };
      }); // Convert color palette to RGB and HEX format

      // Set color-shifted images
      colorImages = await Promise.all(data.seperatedColorImages.map(async (base64) => base64));

      // Set SVGs
      colorSvgs = data.seperatedColorSvgs;
      svgImage = data.mergedSvg;
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

<!-- Images container -->
<div class="images">
  <!-- Original image -->
  {#if originalImage}
    <div>
      <h2>Original Image</h2>
      <img src={originalImage} alt="Original" />
    </div>
  {/if}

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
          style="background-color: {color.hex}"
        ></div>
        <span>{color.hex}</span>
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
</style>
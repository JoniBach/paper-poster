<script>
  import { onMount } from "svelte";

  let originalImage = null; // Original image URL
  let processedImage = null; // Processed image URL
  let extractedColors = []; // Extracted color palette
  let imageFile = null; // File input

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
    } catch (error) {
      console.error("Error processing image:", error.message);
      alert("An error occurred while processing the image.");
    }
  };

  $: console.log(extractedColors);
</script>

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
    gap: 20px;
  }
</style>

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
      <img src={originalImage} alt="Original" width="300" />
    </div>
  {/if}

  <!-- Processed image -->
  {#if processedImage}
    <div>
      <h2>Color-Shifted Image</h2>
      <img src={processedImage} alt="Processed" width="300" />
    </div>
  {/if}
</div>

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

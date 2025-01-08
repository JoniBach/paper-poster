const { Jimp } = require("jimp"); // Destructured import as per the Jimp documentation
const { Vibrant } = require("node-vibrant/node");

// Function to find the closest color in the palette
const findClosestColor = (colorPalette, red, green, blue) => {
  return colorPalette.reduce((prev, curr) => {
    const prevDistance = Math.sqrt(
      Math.pow(prev[0] - red, 2) +
        Math.pow(prev[1] - green, 2) +
        Math.pow(prev[2] - blue, 2)
    );
    const currDistance = Math.sqrt(
      Math.pow(curr[0] - red, 2) +
        Math.pow(curr[1] - green, 2) +
        Math.pow(curr[2] - blue, 2)
    );
    return currDistance < prevDistance ? curr : prev;
  });
};

const extractColorPalette = async (imagePath) => {
  const palette = await Vibrant.from(imagePath).getPalette();
  const rgbColors = Object.values(palette)
    .filter((swatch) => swatch) // Filter out undefined swatches
    .map((swatch) => swatch._rgb); // Get _rgb values
  return rgbColors;
};

const quantizeImage = async (imagePath, colorPalette) => {
  const image = await Jimp.read(imagePath); // Open the image file

  image.scan(
    0,
    0,
    image.bitmap.width,
    image.bitmap.height,
    function (x, y, idx) {
      const red = this.bitmap.data[idx];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];

      // Find the closest color in the palette
      const [r, g, b] = findClosestColor(colorPalette, red, green, blue);

      // Update the pixel color
      this.bitmap.data[idx] = r;
      this.bitmap.data[idx + 1] = g;
      this.bitmap.data[idx + 2] = b;
    }
  );

  const outputPath = "./output/restricted_palette_image.png";
  await image.write(outputPath); // Save the modified image
  console.log(`Image saved to ${outputPath}`);
};

const main = async () => {
  const imagePath = "./images/generated_image_Summer_Fireworks.png";

  try {
    const colorPalette = await extractColorPalette(imagePath);
    console.log("Extracted Color Palette (RGB):", colorPalette);

    await quantizeImage(imagePath, colorPalette);
  } catch (error) {
    console.error(error.message);
  }
};

main();

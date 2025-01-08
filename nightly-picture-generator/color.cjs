const { Vibrant } = require("node-vibrant/node");

// Function to convert RGB to HEX
const rgbToHex = (rgb) => {
  return `#${rgb.map((val) => val.toString(16).padStart(2, "0")).join("")}`;
};

const extractColorPalette = async (imagePath) => {
  try {
    const palette = await Vibrant.from(imagePath).getPalette();

    // Convert swatches to an array of hex color values
    const hexColors = Object.values(palette)
      .filter((swatch) => swatch) // Filter out undefined swatches
      .map((swatch) => rgbToHex(swatch._rgb)); // Convert _rgb to hex

    return hexColors;
  } catch (error) {
    throw new Error(`Error extracting color palette: ${error.message}`);
  }
};

const main = async () => {
  const imagePath = "./images/generated_image_Summer_Fireworks.png";

  try {
    const colorPalette = await extractColorPalette(imagePath);
    console.log("Extracted Color Palette:", colorPalette);
  } catch (error) {
    console.error(error.message);
  }
};

main();

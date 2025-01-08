const OpenAI = require("openai");
const fetch = require("node-fetch");
const fs = require("fs");
const { Jimp } = require("jimp");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const promptsData = require("./prompts.json");

const getRandomSubject = (subjects) => {
  return subjects[Math.floor(Math.random() * subjects.length)];
};

const generateFinalPrompt = (basePrompt, subjectPrompt) => {
  return `${basePrompt} ${subjectPrompt}`;
};

const generateImage = async (prompt) => {
  const response = await openai.images.generate({
    prompt,
    n: 1,
    size: "1024x1024",
    model: "dall-e-3",
  });
  return response.data[0].url;
};

const saveImage = async (imageUrl, filePath) => {
  const res = await fetch(imageUrl);
  const fileStream = fs.createWriteStream(filePath);
  return new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
};
const processImage = async (filePath, outputDir) => {
  try {
    const image = await Jimp.read(filePath);

    // Create an image containing only the red component
    const redOnly = image
      .clone()
      .scan(
        0,
        0,
        image.bitmap.width,
        image.bitmap.height,
        function (x, y, idx) {
          const red = this.bitmap.data[idx]; // Extract red channel
          const green = this.bitmap.data[idx + 1]; // Extract green channel
          const blue = this.bitmap.data[idx + 2]; // Extract blue channel

          // Threshold to detect red pixels
          if (red > green + 30 && red > blue + 30) {
            // Retain red and set green and blue to 0
            this.bitmap.data[idx] = red; // Red remains
            this.bitmap.data[idx + 1] = 0; // Set green to 0
            this.bitmap.data[idx + 2] = 0; // Set blue to 0
          } else {
            // Set non-red pixels to transparent
            this.bitmap.data[idx + 3] = 0; // Alpha channel to 0 (transparent)
          }
        }
      );

    // Create an image containing only the black component
    const blackOnly = image
      .clone()
      .scan(
        0,
        0,
        image.bitmap.width,
        image.bitmap.height,
        function (x, y, idx) {
          const red = this.bitmap.data[idx]; // Extract red channel
          const green = this.bitmap.data[idx + 1]; // Extract green channel
          const blue = this.bitmap.data[idx + 2]; // Extract blue channel

          // Threshold to detect black pixels
          if (red < 50 && green < 50 && blue < 50) {
            // Retain black and set red, green, and blue to 0
            this.bitmap.data[idx] = 0; // Set red to 0
            this.bitmap.data[idx + 1] = 0; // Set green to 0
            this.bitmap.data[idx + 2] = 0; // Set blue to 0
          } else {
            // Set non-black pixels to transparent
            this.bitmap.data[idx + 3] = 0; // Alpha channel to 0 (transparent)
          }
        }
      );

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save the resulting red-only image
    redOnly.write(`${outputDir}/red.png`, (err) => {
      if (err) {
        console.error("Error saving red-only image:", err);
      } else {
        console.log("Red-only image created:", `${outputDir}/red.png`);
      }
    });

    // Create an image containing only the white component
    const whiteOnly = image
      .clone()
      .scan(
        0,
        0,
        image.bitmap.width,
        image.bitmap.height,
        function (x, y, idx) {
          const red = this.bitmap.data[idx]; // Extract red channel
          const green = this.bitmap.data[idx + 1]; // Extract green channel
          const blue = this.bitmap.data[idx + 2]; // Extract blue channel

          // Threshold to detect white pixels
          if (red > 200 && green > 200 && blue > 200) {
            // Retain white and set red, green, and blue to 255
            this.bitmap.data[idx] = 255; // Set red to 255
            this.bitmap.data[idx + 1] = 255; // Set green to 255
            this.bitmap.data[idx + 2] = 255; // Set blue to 255
          } else {
            // Set non-white pixels to transparent
            this.bitmap.data[idx + 3] = 0; // Alpha channel to 0 (transparent)
          }
        }
      );

    // Save the resulting white-only image
    whiteOnly.write(`${outputDir}/white.png`, (err) => {
      if (err) {
        console.error("Error saving white-only image:", err);
      } else {
        console.log("White-only image created:", `${outputDir}/white.png`);
      }
    });

    // Save the resulting black-only image
    blackOnly.write(`${outputDir}/black.png`, (err) => {
      if (err) {
        console.error("Error saving black-only image:", err);
      } else {
        console.log("Black-only image created:", `${outputDir}/black.png`);
      }
    });
  } catch (error) {
    console.error("Error processing image:", error);
  }
};
const main = async () => {
  try {
    const { base, subjects } = promptsData;
    const randomSubject = getRandomSubject(subjects);
    const finalPrompt = generateFinalPrompt(base, randomSubject.prompt);

    console.log(`Using subject: "${randomSubject.title}"`);
    console.log(`Final prompt string: "${finalPrompt}"`);

    const imageUrl = await generateImage(finalPrompt);
    console.log("Image URL:", imageUrl);

    const sanitizedTitle = randomSubject.title.replace(/\s+/g, "_");
    const outputDir = `./images/${sanitizedTitle}`;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const originalImagePath = `${outputDir}/original.png`;

    // Download and save the original image
    console.log(`Downloading image to: ${originalImagePath}`);
    await saveImage(imageUrl, originalImagePath);

    console.log(`Original image saved at: ${originalImagePath}`);

    // Process the image
    await processImage(originalImagePath, outputDir);
  } catch (error) {
    console.error("Error:", error);
  }
};

main();

// index.cjs
const OpenAI = require("openai");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { Jimp } = require("jimp");
const potrace = require("potrace");
require("dotenv").config();

// Configuration Constants
const CONFIG = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PROMPTS_PATH: "./prompts.json",
  IMAGES_DIR: "./images",
  IMAGE_SIZE: "1024x1024",
  IMAGE_MODEL: "dall-e-3",
  SVG_COLORS: {
    red: "#FF0000",
    black: "#000000",
  },
  RED_THRESHOLD: 30,
  BLACK_THRESHOLD: 50,
};

// Initialize OpenAI Client
const initializeOpenAI = (apiKey) =>
  new OpenAI({
    apiKey,
  });

// Load Prompts Data
const loadPrompts = (filePath) => {
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
};

// Select a Random Subject
const getRandomSubject = (subjects) =>
  subjects[Math.floor(Math.random() * subjects.length)];

// Generate Final Prompt String
const generateFinalPrompt = (basePrompt, subjectPrompt) =>
  `${basePrompt} ${subjectPrompt}`;

// Generate Image URL using OpenAI
const generateImageUrl = async (openai, prompt, model, size, n = 1) => {
  const response = await openai.images.generate({
    prompt,
    n,
    size,
    model,
  });
  return response.data[0].url;
};

// Download and Save Image
const downloadImage = async (url, filePath) => {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(filePath);
  return new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", () => resolve(filePath));
  });
};

// Ensure Directory Exists
const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Process Image to Extract Specific Color Components
const processImage = async (
  filePath,
  outputDir,
  redThreshold,
  blackThreshold
) => {
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
          const red = this.bitmap.data[idx];
          const green = this.bitmap.data[idx + 1];
          const blue = this.bitmap.data[idx + 2];

          if (red > green + redThreshold && red > blue + redThreshold) {
            // Retain red and set green and blue to 0
            this.bitmap.data[idx + 1] = 0; // Green
            this.bitmap.data[idx + 2] = 0; // Blue
          } else {
            // Set to white and opaque
            this.bitmap.data[idx] = 255; // Red
            this.bitmap.data[idx + 1] = 255; // Green
            this.bitmap.data[idx + 2] = 255; // Blue
            this.bitmap.data[idx + 3] = 255; // Alpha
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
          const red = this.bitmap.data[idx];
          const green = this.bitmap.data[idx + 1];
          const blue = this.bitmap.data[idx + 2];

          if (
            red < blackThreshold &&
            green < blackThreshold &&
            blue < blackThreshold
          ) {
            // Retain black by setting to pure black
            this.bitmap.data[idx] = 0; // Red
            this.bitmap.data[idx + 1] = 0; // Green
            this.bitmap.data[idx + 2] = 0; // Blue
          } else {
            // Set to white and opaque
            this.bitmap.data[idx] = 255; // Red
            this.bitmap.data[idx + 1] = 255; // Green
            this.bitmap.data[idx + 2] = 255; // Blue
            this.bitmap.data[idx + 3] = 255; // Alpha
          }
        }
      );

    // Ensure the output directory exists
    ensureDirectory(outputDir);

    // Save the resulting red-only image
    redOnly.write(path.join(outputDir, "red.png"), (err) => {
      if (err) {
        console.error("Error saving red-only image:", err);
      } else {
        console.log("Red-only image created:", path.join(outputDir, "red.png"));
      }
    });

    // Save the resulting black-only image
    blackOnly.write(path.join(outputDir, "black.png"), (err) => {
      if (err) {
        console.error("Error saving black-only image:", err);
      } else {
        console.log(
          "Black-only image created:",
          path.join(outputDir, "black.png")
        );
      }
    });
  } catch (error) {
    console.error("Error processing image:", error);
  }
};

// Convert Processed Image to SVG
const convertToSVG = (imagePath, colorHex) => {
  return new Promise((resolve, reject) => {
    console.log(`Converting ${imagePath} to SVG with color ${colorHex}`);
    potrace.trace(imagePath, { color: colorHex }, (err, svg) => {
      if (err) {
        console.error(`Error converting ${imagePath} to SVG:`, err);
        reject(err);
      } else {
        const svgPath = imagePath.replace(".png", ".svg");
        fs.writeFile(svgPath, svg, (writeErr) => {
          if (writeErr) {
            console.error(`Error writing SVG file ${svgPath}:`, writeErr);
            reject(writeErr);
          } else {
            console.log(`SVG created at: ${svgPath} with color: ${colorHex}`);
            resolve(svgPath);
          }
        });
      }
    });
  });
};

// Merge Two SVG Files into One
const mergeSVGs = async (svgPath1, svgPath2, outputPath) => {
  try {
    const svg1 = fs.readFileSync(svgPath1, "utf-8");
    const svg2 = fs.readFileSync(svgPath2, "utf-8");

    // Function to extract inner SVG content
    const getInnerSVG = (svgContent) => {
      const start = svgContent.indexOf(">") + 1;
      const end = svgContent.lastIndexOf("</svg>");
      return svgContent.substring(start, end);
    };

    const inner1 = getInnerSVG(svg1);
    const inner2 = getInnerSVG(svg2);

    // Extract the opening <svg ...> tag from the first SVG
    const svgTagMatch = svg1.match(/<svg[^>]*>/);
    const svgTag = svgTagMatch
      ? svgTagMatch[0]
      : '<svg xmlns="http://www.w3.org/2000/svg">';

    // Combine the inner content
    const mergedContent = `${svgTag}\n${inner1}\n${inner2}\n</svg>`;

    fs.writeFileSync(outputPath, mergedContent);
    console.log(`Merged SVG created at: ${outputPath}`);
  } catch (error) {
    console.error("Error merging SVGs:", error);
  }
};

// Capitalize Function
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Main Workflow Function
const main = async () => {
  try {
    // Initialize OpenAI
    const openai = initializeOpenAI(CONFIG.OPENAI_API_KEY);

    // Load Prompts
    const promptsData = loadPrompts(CONFIG.PROMPTS_PATH);
    const { base, subjects } = promptsData;

    // Select Random Subject and Generate Prompt
    const randomSubject = getRandomSubject(subjects);
    const finalPrompt = generateFinalPrompt(base, randomSubject.prompt);
    console.log(`Using subject: "${randomSubject.title}"`);
    console.log(`Final prompt string: "${finalPrompt}"`);

    // Generate Image URL
    const imageUrl = await generateImageUrl(
      openai,
      finalPrompt,
      CONFIG.IMAGE_MODEL,
      CONFIG.IMAGE_SIZE
    );
    console.log("Image URL:", imageUrl);

    // Prepare File Paths
    const sanitizedTitle = randomSubject.title.replace(/\s+/g, "_");
    const outputDir = path.join(CONFIG.IMAGES_DIR, sanitizedTitle);
    ensureDirectory(outputDir);

    const originalImagePath = path.join(outputDir, "original.png");

    // Download Original Image
    console.log(`Downloading image to: ${originalImagePath}`);
    await downloadImage(imageUrl, originalImagePath);
    console.log(`Original image saved at: ${originalImagePath}`);

    // Process the image to extract red and black components
    await processImage(
      originalImagePath,
      outputDir,
      CONFIG.RED_THRESHOLD,
      CONFIG.BLACK_THRESHOLD
    );

    // Convert processed images to SVG
    const colors = ["red", "black"];
    const svgPaths = [];

    for (const color of colors) {
      const processedImagePath = path.join(outputDir, `${color}.png`);
      const svgColor = CONFIG.SVG_COLORS[color];
      const svgPath = await convertToSVG(processedImagePath, svgColor);
      svgPaths.push(svgPath);
    }

    // Merge the SVGs into a single merged.svg
    if (svgPaths.length === 2) {
      const [svg1, svg2] = svgPaths;
      const mergedSVGPath = path.join(outputDir, "merged.svg");
      await mergeSVGs(svg1, svg2, mergedSVGPath);
    } else {
      console.warn("Skipping SVG merging: Expected 2 SVG paths.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

// Execute Main Function
main();

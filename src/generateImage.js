const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateImage(prompt, outputPath) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      responseModalities: ["Text", "Image"],
    },
  });

  try {
    const response = await model.generateContent(prompt);
    for (const part of response.response.candidates[0].content.parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, "base64");

        // Pastikan direktori output ada
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, buffer);
        console.log(`🖼️ Gambar disimpan sebagai ${outputPath}`);
        return outputPath;
      }
    }
  } catch (error) {
    console.error("❌ Error saat generate image:", error);
  }

  return null;
}

module.exports = { generateImage };

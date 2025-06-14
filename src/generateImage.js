const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateImage(prompt, outputPath = "generated.png") {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp", // model preview dengan image gen support
    generationConfig: {
      responseModalities: ["Text", "Image"],
    },
  });

  try {
    const result = await model.generateContent(prompt);
    const parts = result.response.candidates[0].content.parts;

    for (const part of parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data, "base64");
        fs.writeFileSync(outputPath, buffer);
        console.log(`🖼️ Gambar disimpan sebagai ${outputPath}`);
        return outputPath;
      } else if (part.text) {
        console.log(`📄 Teks: ${part.text}`);
      }
    }

    return null;
  } catch (err) {
    console.error("🔴 Error generate image:", err);
    return null;
  }
}

module.exports = { generateImage };

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash", // Atau gunakan gemini-2.0 jika sudah support IMAGE
});

async function generateImage(prompt) {
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "image/png",
        response_modality: ["IMAGE"],
      },
    });

    const response = result.response;
    const imagePart = response.parts.find((p) => p.inlineData);

    if (!imagePart) {
      return { error: "❌ Gagal mendapatkan gambar dari Gemini." };
    }

    const base64Data = imagePart.inlineData.data;
    const imageBuffer = Buffer.from(base64Data, "base64");

    return { buffer: imageBuffer };
  } catch (err) {
    console.error("🔴 Error generate image:", err);
    return { error: "❌ Gagal menghasilkan gambar." };
  }
}

module.exports = { generateImage };

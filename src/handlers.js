const { GoogleGenerativeAI } = require("@google/generative-ai");

const defaultPrompt =
  process.env.GEMINI_SYSTEM_PROMPT ||
  "Kamu adalah asisten WhatsApp yang singkat, ramah, dan informatif. Jawab pertanyaan pengguna dengan jelas dan tepat. Gunakan bahasa yang sopan dan profesional. Jika kamu tidak tahu jawabannya, katakan saja bahwa kamu tidak tahu. Hindari memberikan informasi palsu atau menyesatkan. Jangan pernah mengungkapkan informasi pribadi pengguna atau data sensitif lainnya. Jaga agar balasan tetap singkat dan to the point. Gunakan emoji secara hemat untuk menambahkan kehangatan pada balasanmu. Jika diminta, berikan referensi atau sumber untuk informasi yang kamu berikan. Nama kamu dhikaAI Bot.";

const defaultModel = process.env.GEMINI_MODEL || "gemini-flash-latest";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: defaultModel });

const sessions = {};

function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = {
      systemPrompt: defaultPrompt,
      history: [],
    };
  }
  return sessions[chatId];
}

async function handleTextMessage(chatId, rawMessage) {
  if (!process.env.GEMINI_API_KEY) {
    return "⚠️ GEMINI_API_KEY belum disetel di environment.";
  }

  const message = rawMessage.trim();
  if (!message) return null;

  const session = getSession(chatId);

  if (message === ".ai") {
    return `🎯 Prompt saat ini: ${session.systemPrompt}`;
  }

  if (message.startsWith(".ai ")) {
    const customPrompt = message.slice(4).trim();
    session.systemPrompt = customPrompt || defaultPrompt;
    session.history = [];
    return `✅ Prompt AI diperbarui.\nSekarang mengikuti instruksi:\n${session.systemPrompt}`;
  }

  if (message === ".reset") {
    delete sessions[chatId];
    return "♻️ Riwayat percakapan direset.";
  }

  try {
    const chatSession = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: `Ikuti instruksi ini: ${session.systemPrompt}` }],
        },
        ...session.history,
      ],
      tools: [{ googleSearch: {} }],
    });

    const result = await chatSession.sendMessage(message);
    const reply = result.response.text().trim();

    session.history.push(
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ text: reply }] }
    );

    return reply;
  } catch (error) {
    console.error("Error dalam menangani pesan:", error);

    const isRateLimit =
      error?.status === 429 ||
      error?.statusText === "Too Many Requests" ||
      /quota|rate limit|Too Many Requests/i.test(error?.message || "");

    const isModelAccessError =
      error?.status === 403 ||
      error?.status === 404 ||
      /model.*(not|no).*access|model .* not found/i.test(error?.message || "");

    if (isRateLimit) {
      return "🚦 Batas penggunaan AI tercapai. Coba lagi nanti.";
    }

    if (isModelAccessError) {
      return `🚫 Model AI (${defaultModel}) tidak tersedia untuk akun ini. Setel GEMINI_MODEL ke model yang tersedia atau upgrade akses.`;
    }

    return "❌ Terjadi kesalahan dalam memproses pesan.";
  }
}

module.exports = { handleTextMessage };

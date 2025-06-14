const fs = require("fs");
const path = require("path");
const { getSalatLocations, getPrayerSchedule } = require("./salatApi");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { generateImage } = require("./generateImage");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const imageDir = path.join(__dirname, "..", "gambar");
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

let chatHistory = {};

async function handleTextMessage(chatId, message) {
  try {
    if (message.startsWith(".gambar ")) {
      const prompt = message.replace(".gambar ", "").trim();
      const imagePath = path.join(imageDir, `generated_${Date.now()}.png`);
      const output = await generateImage(prompt, imagePath);

      if (output) {
        return {
          type: "image",
          path: path.resolve(output),
          caption: `🖼️ Gambar untuk prompt:\n${prompt}`,
        };
      } else {
        return "❌ Gagal membuat gambar dari prompt.";
      }
    }

    if (message.startsWith(".salat")) {
      const parts = message.split(" ");
      if (parts.length === 1) {
        const locations = await getSalatLocations();
        if (!Array.isArray(locations)) {
          return "⚠️ Gagal mengambil daftar kota. Coba lagi nanti.";
        }

        return (
          `📍 *Daftar Kota untuk Jadwal Salat*\n\n` +
          `Kirim perintah:\n.salat [ID Kota]\n\n` +
          locations.map((loc) => `- ${loc.lokasi} (ID: ${loc.id})`).join("\n")
        );
      }

      const cityId = parts[1].trim();
      if (!/^\d{4}$/.test(cityId)) {
        return "⚠️ Format ID kota salah. Harus 4 digit angka.\nContoh: .salat 1632";
      }

      const prayerSchedule = await getPrayerSchedule(cityId);
      const scheduleLines = prayerSchedule.split("\n");
      let prayerTimes = {};
      scheduleLines.forEach((line) => {
        const [name, time] = line.split(": ");
        if (name && time) {
          prayerTimes[name.toLowerCase()] = time.trim();
        }
      });

      if (!chatHistory[chatId]) chatHistory[chatId] = {};
      chatHistory[chatId].prayerSchedule = prayerTimes;

      return `📅 *Jadwal Salat untuk Kota ID ${cityId}*\n\n${prayerSchedule}`;
    }

    const prayerKeywords = ["subuh", "dzuhur", "ashar", "magrib", "isya"];
    for (const prayer of prayerKeywords) {
      if (message.toLowerCase().includes(prayer)) {
        if (chatHistory[chatId]?.prayerSchedule?.[prayer]) {
          return `🕌 ${prayer.charAt(0).toUpperCase() + prayer.slice(1)}: ${
            chatHistory[chatId].prayerSchedule[prayer]
          }`;
        }
        return "⚠️ Saya belum memiliki data jadwal salat. Gunakan perintah .salat [ID Kota] terlebih dahulu.";
      }
    }

    if (!chatHistory[chatId]) chatHistory[chatId] = {};
    if (!chatHistory[chatId].history) {
      chatHistory[chatId].history = [
        {
          role: "user",
          parts: [
            {
              text: `Kamu adalah asisten pribadi saya bernama Hayasaka AI. Kamu membantu saya dalam menjawab pertanyaan, menganalisis gambar, serta memberikan informasi berdasarkan konteks yang saya berikan. Jawablah dengan sopan, jelas, dan langsung ke inti.`,
            },
          ],
        },
        {
          role: "model",
          parts: [
            {
              text: "Halo! Saya adalah Hayasaka AI, siap membantu kamu. Silakan tanya apa pun.",
            },
          ],
        },
      ];
    }

    chatHistory[chatId].history.push({
      role: "user",
      parts: [{ text: message }],
    });
    const chatSession = model.startChat({
      history: chatHistory[chatId].history,
    });
    const result = await chatSession.sendMessage(message);
    const reply = result.response.text().replace(/[*`_]/g, "");

    chatHistory[chatId].history.push({
      role: "model",
      parts: [{ text: reply }],
    });
    return reply;
  } catch (error) {
    console.error("Error dalam menangani pesan:", error);
    return "Maaf, terjadi kesalahan dalam memproses pesan.";
  }
}

async function handleImageMessage(buffer, mimeType) {
  try {
    const imagePart = {
      inlineData: { data: buffer.toString("base64"), mimeType },
    };

    const result = await model.generateContent([
      "Apa yang bisa kamu analisa dari gambar ini?",
      imagePart,
    ]);

    let raw = result.response.text();
    let cleaned = raw
      .replace(/[*_`~]/g, "")
      .replace(/\n{2,}/g, "\n")
      .replace(/(?:^|\n)(?:Prompt|User|You|AI):.*\n?/gi, "")
      .trim();

    return cleaned;
  } catch (error) {
    console.error("Error dalam memproses gambar:", error);
    return "Maaf, saya tidak bisa memproses gambar ini.";
  }
}

module.exports = { handleTextMessage, handleImageMessage };

const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { generateImage } = require("./generateImage");
const { getSalatLocations, getPrayerSchedule } = require("./salatApi");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

let chatHistory = {};

async function handleTextMessage(chatId, message) {
  try {
    // Fitur gambar
    if (message.startsWith(".gambar ")) {
      const prompt = message.replace(".gambar ", "").trim();
      const imagePath = `generated_${Date.now()}.png`;
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

    // Fitur jadwal salat
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
        const data = chatHistory[chatId]?.prayerSchedule?.[prayer];
        return data
          ? `🕌 ${prayer.charAt(0).toUpperCase() + prayer.slice(1)}: ${data}`
          : "⚠️ Saya belum memiliki data jadwal salat. Gunakan perintah .salat [ID Kota] terlebih dahulu.";
      }
    }

    // Chat AI default
    if (!chatHistory[chatId]) chatHistory[chatId] = {};
    if (!chatHistory[chatId].history) {
      chatHistory[chatId].history = [
        {
          role: "user",
          parts: [
            {
              text: `Kamu adalah asisten pribadi saya bernama Hayasaka AI. Jawablah dengan sopan, jelas, dan langsung ke inti.`,
            },
          ],
        },
        {
          role: "model",
          parts: [
            { text: `Halo! Saya adalah Hayasaka AI, siap membantu kamu.` },
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
    return "❌ Terjadi kesalahan dalam memproses pesan.";
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

    const raw = result.response.text();

    return raw
      .replace(/[*_`~]/g, "")
      .replace(/\n{2,}/g, "\n")
      .replace(/(?:^|\n)(?:Prompt|User|You|AI):.*\n?/gi, "")
      .trim();
  } catch (error) {
    console.error("Error dalam memproses gambar:", error);
    return "❌ Gagal memproses gambar.";
  }
}

module.exports = { handleTextMessage, handleImageMessage };

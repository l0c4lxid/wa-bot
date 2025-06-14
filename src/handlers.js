const { getSalatLocations, getPrayerSchedule } = require("./salatApi");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { generateImage } = require("./generateImage");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

let chatHistory = {};

async function handleTextMessage(chatId, message) {
  try {
    if (message.startsWith(".gambar ")) {
      const prompt = message.replace(".gambar ", "").trim();
      const imagePath = `generated_${Date.now()}.png`;
      const output = await generateImage(prompt, imagePath);

      if (output) {
        await sock.sendMessage(chatId, {
          image: fs.readFileSync(output),
          caption: `🖼️ Gambar untuk prompt:\n${prompt}`,
        });
        fs.unlinkSync(output); // hapus gambar setelah dikirim
        return;
      } else {
        return "❌ Gagal membuat gambar dari prompt.";
      }
    }

    if (message.startsWith(".salat")) {
      const parts = message.split(" ");

      // Jika hanya ".salat", tampilkan daftar kota
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

      // Jika ".salat [ID Kota]", tampilkan jadwal salat
      const cityId = parts[1].trim();
      if (!/^\d{4}$/.test(cityId)) {
        return "⚠️ Format ID kota salah. Harus 4 digit angka.\nContoh: .salat 1632";
      }

      const prayerSchedule = await getPrayerSchedule(cityId);

      // Parsing data agar bisa diakses dengan lebih mudah
      const scheduleLines = prayerSchedule.split("\n");
      let prayerTimes = {};
      scheduleLines.forEach((line) => {
        const [name, time] = line.split(": ");
        if (name && time) {
          prayerTimes[name.toLowerCase()] = time.trim(); // Simpan dengan nama kecil
        }
      });

      // Simpan jadwal dalam chatHistory
      if (!chatHistory[chatId]) chatHistory[chatId] = {};
      chatHistory[chatId].prayerSchedule = prayerTimes;

      return `📅 *Jadwal Salat untuk Kota ID ${cityId}*\n\n${prayerSchedule}`;
    }

    // Jika pengguna bertanya tentang waktu salat tertentu
    const prayerKeywords = ["subuh", "dzuhur", "ashar", "magrib", "isya"];
    for (const prayer of prayerKeywords) {
      if (message.toLowerCase().includes(prayer)) {
        if (chatHistory[chatId] && chatHistory[chatId].prayerSchedule) {
          if (chatHistory[chatId].prayerSchedule[prayer]) {
            return `🕌 ${prayer.charAt(0).toUpperCase() + prayer.slice(1)}: ${
              chatHistory[chatId].prayerSchedule[prayer]
            }`;
          }
        }
        return "⚠️ Saya belum memiliki data jadwal salat. Gunakan perintah .salat [ID Kota] terlebih dahulu.";
      }
    }

    // Simpan percakapan ke chat history
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
              text: `Halo! Saya adalah Hayasaka AI, siap membantu kamu. Silakan tanya apa pun.`,
            },
          ],
        },
      ];
    }
    chatHistory[chatId].history.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Kirim ke AI dengan konteks riwayat percakapan
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

    // 🔧 Bersihkan teks
    let cleaned = raw
      .replace(/[*_`~]/g, "") // Hapus karakter formatting markdown
      .replace(/\n{2,}/g, "\n") // Hapus baris kosong berturut-turut
      .replace(/(?:^|\n)(?:Prompt|User|You|AI):.*\n?/gi, "") // Hapus label dari hasil
      .trim(); // Trim spasi di awal/akhir

    return cleaned;
  } catch (error) {
    console.error("Error dalam memproses gambar:", error);
    return "Maaf, saya tidak bisa memproses gambar ini.";
  }
}

module.exports = { handleTextMessage, handleImageMessage };

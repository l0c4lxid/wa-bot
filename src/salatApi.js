const axios = require("axios");

const API_BASE_URL = "https://api.myquran.com/v2/sholat";

/**
 * Fungsi untuk melakukan request dengan retry jika gagal.
 * @param {string} url - URL API.
 * @param {number} retries - Jumlah percobaan ulang jika gagal.
 * @returns {Promise<object|null>} Data dari API atau null jika gagal.
 */
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PrayerBot/1.0)",
        },
        timeout: 5000, // Timeout 5 detik
      });
      return response.data?.data || null;
    } catch (error) {
      console.error(`⚠️ Percobaan ${i + 1} gagal:`, error.message);
      if (i === retries - 1) {
        return null; // Jika semua percobaan gagal, kembalikan null
      }
    }
  }
}

/**
 * Mengambil daftar lokasi salat.
 * @returns {Promise<Array>} Daftar lokasi kota dengan ID.
 */
async function getSalatLocations() {
  const data = await fetchWithRetry(`${API_BASE_URL}/kota/semua`);

  if (!Array.isArray(data)) {
    return null; // Kembalikan null jika data tidak valid
  }

  return data.map((city) => ({ lokasi: city.lokasi, id: city.id }));
}

/**
 * Mendapatkan jadwal salat berdasarkan ID kota.
 * @param {string} cityId - ID kota.
 * @returns {Promise<string>} Jadwal salat dalam format teks.
 */
async function getPrayerSchedule(cityId) {
  if (!cityId) return "⚠️ ID kota tidak boleh kosong.";

  const today = new Date().toISOString().split("T")[0]; // Format YYYY-MM-DD
  const data = await fetchWithRetry(
    `${API_BASE_URL}/jadwal/${cityId}/${today}`
  );

  if (!data || !data.jadwal) {
    return "⚠️ Data tidak ditemukan. Pastikan ID kota benar.";
  }

  const { lokasi, jadwal } = data;
  return (
    `📅 *Jadwal Salat ${lokasi}* (${jadwal.tanggal})\n\n` +
    `- 🕌 *Imsak*: ${jadwal.imsak}\n` +
    `- 🌄 *Subuh*: ${jadwal.subuh}\n` +
    `- 🌞 *Dhuha*: ${jadwal.dhuha}\n` +
    `- 🕛 *Dzuhur*: ${jadwal.dzuhur}\n` +
    `- 🌅 *Ashar*: ${jadwal.ashar}\n` +
    `- 🌇 *Maghrib*: ${jadwal.maghrib}\n` +
    `- 🌙 *Isya*: ${jadwal.isya}`
  );
}

module.exports = { getSalatLocations, getPrayerSchedule };

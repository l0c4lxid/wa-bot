const fs = require("fs");
const qrcode = require("qrcode-terminal");
const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const { handleTextMessage } = require("./handlers");

const authFolder = "./auth";
const MAX_LOGIN_RETRIES = 3;
let loginAttempts = 0;

function clearAuthFolder(logFn) {
  try {
    fs.rmSync(authFolder, { recursive: true, force: true });
    logFn("🧹 Cache auth dibersihkan, scan ulang diperlukan.");
  } catch (err) {
    logFn(`❗ Gagal menghapus folder auth: ${err}`);
  }
}

async function startBot(logFn = console.log) {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  logFn(
    `ℹ️ Menggunakan WA Web v${version.join(".")} (latest: ${
      isLatest ? "ya" : "tidak"
    })`
  );

  const sock = makeWASocket({
    version,
    auth: state,
    browser: ["Chrome", "MacOS", "Latest"],
    printQRInTerminal: false,
    connectTimeoutMs: 30_000,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logFn("📱 Scan QR Code berikut untuk login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      logFn("✅ Bot WhatsApp siap!");
      loginAttempts = 0;
      return;
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || lastDisconnect?.error;
      const shouldResetSession =
        statusCode === DisconnectReason.loggedOut ||
        statusCode === DisconnectReason.badSession;

      if (shouldResetSession || loginAttempts >= MAX_LOGIN_RETRIES) {
        clearAuthFolder(logFn);
        loginAttempts = 0;
      } else {
        loginAttempts += 1;
      }

      const delay = shouldResetSession ? 1_000 : 2_000;
      logFn(
        `⚠️ Koneksi terputus (${statusCode ?? "unknown"}: ${
          reason ?? "tanpa detail"
        }). ${
          shouldResetSession
            ? "Reset auth dan minta scan ulang"
            : "Mencoba reconnect"
        } dalam ${delay / 1000}s...`
      );

      setTimeout(() => {
        startBot(logFn);
      }, delay);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages?.[0];
    if (
      !msg?.message ||
      msg.key.fromMe ||
      msg.key.remoteJid === "status@broadcast"
    ) {
      return;
    }

    const sender = msg.key.remoteJid;
    logFn(`📩 Pesan diterima dari ${sender}`);

    await sock.readMessages([msg.key]);

    if (msg.message?.protocolMessage?.type === 0) {
      logFn(`🗑️ Pesan dari ${sender} telah dihapus.`);
      return;
    }

    try {
      const text =
        msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if (!text) return;

      const reply = await handleTextMessage(sender, text);
      if (!reply) return;

      await sock.sendMessage(sender, { text: reply }, { read: true });
      logFn(`💬 Balasan teks dikirim ke ${sender}`);
    } catch (err) {
      logFn(`❗ Terjadi error saat memproses pesan dari ${sender}: ${err}`);
    }
  });
}

module.exports = { startBot };

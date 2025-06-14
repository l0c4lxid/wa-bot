const fs = require("fs");
const qrcode = require("qrcode-terminal");
const {
  makeWASocket,
  useMultiFileAuthState,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const { handleTextMessage, handleImageMessage } = require("./handlers");

const authFolder = "./auth";
let loginAttempts = 0;

async function startBot(logFn = console.log) {
  if (loginAttempts >= 3) {
    logFn("❌ Gagal login 3 kali, menghapus folder auth...");
    fs.rmSync(authFolder, { recursive: true, force: true });
    loginAttempts = 0;
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const sock = makeWASocket({
    auth: state,
    browser: ["Chrome", "MacOS", "Latest"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logFn("📱 Scan QR Code berikut untuk login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      logFn("⚠️ Koneksi terputus, mencoba reconnect...");
      loginAttempts++;
      startBot(logFn); // kirim logFn saat rekoneksi
    } else if (connection === "open") {
      logFn("✅ Bot WhatsApp siap!");
      loginAttempts = 0;
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe) {
      const sender = msg.key.remoteJid;
      logFn(`📩 Pesan diterima dari ${sender}`);

      await sock.readMessages([msg.key]);

      if (msg.message?.protocolMessage?.type === 0) {
        logFn(`🗑️ Pesan dari ${sender} telah dihapus.`);
        return;
      }

      try {
        if (msg.message.imageMessage) {
          const mediaBuffer = await downloadMediaMessage(msg, "buffer");
          const mimeType = msg.message.imageMessage.mimetype || "image/jpeg";
          const reply = await handleImageMessage(mediaBuffer, mimeType);
          await sock.sendMessage(sender, { text: reply }, { read: true });
          logFn(`🖼️ Balasan gambar dikirim ke ${sender}`);
        } else {
          const text =
            msg.message.conversation || msg.message.extendedTextMessage?.text;
          if (!text) return;

          const reply = await handleTextMessage(sender, text);

          if (typeof reply === "string") {
            await sock.sendMessage(sender, { text: reply }, { read: true });
            logFn(`💬 Balasan teks dikirim ke ${sender}`);
          } else if (reply?.type === "image") {
            await sock.sendMessage(sender, {
              image: fs.readFileSync(reply.path),
              caption: reply.caption,
            });
            fs.unlinkSync(reply.path); // opsional: hapus setelah dikirim
            logFn(`🖼️ Gambar dikirim ke ${sender}`);
          }
        }
      } catch (err) {
        logFn(`❗ Terjadi error saat memproses pesan dari ${sender}: ${err}`);
      }
    }
  });
}

module.exports = { startBot };

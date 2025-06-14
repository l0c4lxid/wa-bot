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

async function startBot() {
  if (loginAttempts >= 3) {
    console.log("Gagal login 3 kali, menghapus folder auth...");
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
      console.log("Scan QR Code berikut untuk login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      console.log("Koneksi terputus, mencoba reconnect...");
      loginAttempts++;
      startBot();
    } else if (connection === "open") {
      console.log("Bot WhatsApp siap!");
      loginAttempts = 0;
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe) {
      const sender = msg.key.remoteJid;
      console.log(`Pesan diterima dari ${sender}:`, msg);

      await sock.readMessages([msg.key]);

      if (msg.message?.protocolMessage?.type === 0) {
        console.log(`Pesan dari ${sender} telah dihapus.`);
        return;
      }

      if (msg.message.imageMessage) {
        const mediaBuffer = await downloadMediaMessage(msg, "buffer");
        const mimeType = msg.message.imageMessage.mimetype || "image/jpeg";
        const reply = await handleImageMessage(mediaBuffer, mimeType);
        await sock.sendMessage(sender, { text: reply }, { read: true });
      } else {
        const text =
          msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;
        const reply = await handleTextMessage(sender, text);
        await sock.sendMessage(sender, { text: reply }, { read: true });
      }
    }
  });
}

module.exports = { startBot };

require("dotenv").config();
const express = require("express");
const { startBot } = require("./src/bot"); // Pastikan startBot pakai logBot
const app = express();

// =====================
// LOGGING BOT
// =====================
const logs = [];

function logBot(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  logs.push(logEntry);

  if (logs.length > 100) logs.shift(); // Batasi log agar tidak bengkak
  console.log(logEntry); // Tetap tampilkan di terminal atau pm2
}

// ================
// START WHATSAPP BOT
// ================
startBot(logBot); // Kirim logBot sebagai argumen ke bot agar bisa dipakai di dalamnya

// =====================
// EXPRESS ROUTES
// =====================

app.get("/", (req, res) => {
  const logText = logs.slice().reverse().join("\n");
  res.send(`
    <html>
      <head>
        <meta http-equiv="refresh" content="3">
        <title>Log WhatsApp Bot</title>
        <style>
          body { font-family: monospace; background: #000; color: #0f0; padding: 20px; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
        </style>
      </head>
      <body>
        <h2>📜 Log WhatsApp Bot (Live)</h2>
        <pre>${logText}</pre>
      </body>
    </html>
  `);
});

// =====================
// JALANKAN SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logBot(`🌐 Server berjalan di http://localhost:${PORT}`);
});

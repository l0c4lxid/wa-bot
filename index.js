require("dotenv").config();
const express = require("express");
const { startBot } = require("./src/bot");

const app = express();

startBot();

app.get("/", (req, res) => {
  res.send("WhatsApp Bot AI dengan Baileys sedang berjalan...");
});

app.listen(3000, () => {
  console.log("Server berjalan di http://localhost:3000");
});

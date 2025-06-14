const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("WhatsApp Bot AI sedang berjalan...");
});

function startServer() {
  app.listen(3000, () => {
    console.log("Server berjalan di http://localhost:3000");
  });
}

module.exports = { startServer };

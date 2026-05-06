const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_ID = process.env.SERVER_ID || "unknown";

app.get("/", (req, res) => {
  res.json({
    message: "Response from backend server",
    server: SERVER_ID,
    port: PORT
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server ${SERVER_ID} started on port ${PORT}`);
});
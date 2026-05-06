const express = require("express");
const app = express();
const PORT = 3002;

app.get("/", (req, res) => {
  res.json({ message: "Response from backend server (BACKUP)", port: PORT, host: "server3-backup" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", port: PORT });
});

app.listen(PORT, () => {
  console.log(`Server 3 (backup) started on port ${PORT}`);
});
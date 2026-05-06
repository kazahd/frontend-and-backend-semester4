const express = require("express");
const app = express();
const PORT = 3001;

app.get("/", (req, res) => {
  res.json({ message: "Response from backend server", port: PORT, host: "server2" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", port: PORT });
});

app.listen(PORT, () => {
  console.log(`Server 2 started on port ${PORT}`);
});
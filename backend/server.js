try {
  require("dotenv").config();
} catch {
  // dotenv is optional in some deployment environments.
}

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const uploadRoutes = require("./routes/upload");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }
  next(err);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/upload", uploadRoutes);

// Centralized error handler as a safety net for anything not caught upstream.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Ajaia Docs backend listening on port ${PORT}`);
  }).on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

module.exports = app;

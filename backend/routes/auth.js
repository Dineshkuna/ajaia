const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAuth, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// Public: lets the login screen show which demo accounts exist, without
// exposing anything sensitive. Password is the same for all seeded users
// (password123) and is documented in the README for reviewers.
router.get("/demo-accounts", (req, res) => {
  const users = db.prepare("SELECT name, email FROM users ORDER BY name").all();
  res.json({ users, demoPassword: "password123" });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Returns the list of seeded reviewer accounts so the login screen and the
// share picker can offer them without requiring a signup flow.
router.get("/users", requireAuth, (req, res) => {
  const users = db.prepare("SELECT id, name, email FROM users ORDER BY name").all();
  res.json({ users });
});

module.exports = router;

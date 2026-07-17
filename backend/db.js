const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "ajaia.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Untitled document',
  content TEXT NOT NULL DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(document_id, user_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed demo users (idempotent) so reviewers can test sharing without signing up.
function seedUsers() {
  const seedList = [
    { name: "Alice Anderson", email: "alice@ajaia.com", password: "password123" },
    { name: "Bob Baker", email: "bob@ajaia.com", password: "password123" },
    { name: "Carol Chen", email: "carol@ajaia.com", password: "password123" },
  ];

  const existing = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (existing.count > 0) return;

  const insert = db.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  );
  const insertMany = db.transaction((list) => {
    for (const u of list) {
      const hash = bcrypt.hashSync(u.password, 10);
      insert.run(u.name, u.email, hash);
    }
  });
  insertMany(seedList);

  // Seed one example document owned by Alice, shared with Bob, so the
  // reviewer sees a populated "Shared with me" list immediately after login.
  const alice = db.prepare("SELECT id FROM users WHERE email = ?").get("alice@ajaia.com");
  const bob = db.prepare("SELECT id FROM users WHERE email = ?").get("bob@ajaia.com");
  const docInsert = db.prepare(
    "INSERT INTO documents (title, content, owner_id) VALUES (?, ?, ?)"
  );
  const result = docInsert.run(
    "Welcome to Ajaia Docs",
    "<h1>Welcome to Ajaia Docs</h1><p>This is a sample document seeded for review. Try <strong>bold</strong>, <em>italic</em>, and <u>underline</u> formatting, or a list:</p><ul><li>Create a document</li><li>Share it with a teammate</li><li>Import a .txt or .md file</li></ul>",
    alice.id
  );
  db.prepare(
    "INSERT INTO document_shares (document_id, user_id, permission) VALUES (?, ?, 'edit')"
  ).run(result.lastInsertRowid, bob.id);
}

seedUsers();

module.exports = db;

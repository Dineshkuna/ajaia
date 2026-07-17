const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// ---------- helpers ----------

function getDocOr404(id, res) {
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(id);
  if (!doc) {
    res.status(404).json({ error: "Document not found." });
    return null;
  }
  return doc;
}

// Returns { role: 'owner' | 'edit' | 'view' | null }
function getAccess(doc, userId) {
  if (doc.owner_id === userId) return "owner";
  const share = db
    .prepare("SELECT permission FROM document_shares WHERE document_id = ? AND user_id = ?")
    .get(doc.id, userId);
  if (!share) return null;
  return share.permission; // 'view' | 'edit'
}

function canView(access) {
  return access === "owner" || access === "edit" || access === "view";
}
function canEdit(access) {
  return access === "owner" || access === "edit";
}

// ---------- list ----------

router.get("/", (req, res) => {
  const userId = req.user.id;

  const owned = db
    .prepare(
      `SELECT d.*, 'owner' as access
       FROM documents d
       WHERE d.owner_id = ?
       ORDER BY d.updated_at DESC`
    )
    .all(userId);

  const shared = db
    .prepare(
      `SELECT d.*, s.permission as access, u.name as owner_name, u.email as owner_email
       FROM documents d
       JOIN document_shares s ON s.document_id = d.id
       JOIN users u ON u.id = d.owner_id
       WHERE s.user_id = ?
       ORDER BY d.updated_at DESC`
    )
    .all(userId);

  res.json({ owned, shared });
});

// ---------- create ----------

router.post("/", (req, res) => {
  const { title, content } = req.body || {};
  const finalTitle = (title && title.trim()) || "Untitled document";
  const finalContent = content || "";

  const result = db
    .prepare("INSERT INTO documents (title, content, owner_id) VALUES (?, ?, ?)")
    .run(finalTitle, finalContent, req.user.id);

  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ document: { ...doc, access: "owner" } });
});

// ---------- read one ----------

router.get("/:id", (req, res) => {
  const doc = getDocOr404(req.params.id, res);
  if (!doc) return;

  const access = getAccess(doc, req.user.id);
  if (!canView(access)) {
    return res.status(403).json({ error: "You do not have access to this document." });
  }

  res.json({ document: { ...doc, access } });
});

// ---------- update (title / content) ----------

router.put("/:id", (req, res) => {
  const doc = getDocOr404(req.params.id, res);
  if (!doc) return;

  const access = getAccess(doc, req.user.id);
  if (!canEdit(access)) {
    return res.status(403).json({ error: "You do not have permission to edit this document." });
  }

  const { title, content } = req.body || {};
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: "Title cannot be empty." });
  }

  db.prepare(
    `UPDATE documents
     SET title = COALESCE(?, title),
         content = COALESCE(?, content),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(title !== undefined ? title.trim() : null, content !== undefined ? content : null, doc.id);

  const updated = db.prepare("SELECT * FROM documents WHERE id = ?").get(doc.id);
  res.json({ document: { ...updated, access } });
});

// ---------- delete ----------

router.delete("/:id", (req, res) => {
  const doc = getDocOr404(req.params.id, res);
  if (!doc) return;

  if (doc.owner_id !== req.user.id) {
    return res.status(403).json({ error: "Only the owner can delete this document." });
  }

  db.prepare("DELETE FROM documents WHERE id = ?").run(doc.id);
  res.status(204).send();
});

// ---------- sharing ----------

router.get("/:id/shares", (req, res) => {
  const doc = getDocOr404(req.params.id, res);
  if (!doc) return;

  if (doc.owner_id !== req.user.id) {
    return res.status(403).json({ error: "Only the owner can view sharing settings." });
  }

  const shares = db
    .prepare(
      `SELECT s.id, s.permission, s.created_at, u.id as user_id, u.name, u.email
       FROM document_shares s
       JOIN users u ON u.id = s.user_id
       WHERE s.document_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(doc.id);

  res.json({ shares });
});

router.post("/:id/shares", (req, res) => {
  const doc = getDocOr404(req.params.id, res);
  if (!doc) return;

  if (doc.owner_id !== req.user.id) {
    return res.status(403).json({ error: "Only the owner can share this document." });
  }

  const { email, permission } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: "An email is required to share the document." });
  }
  const perm = permission === "edit" ? "edit" : "view";

  const targetUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!targetUser) {
    return res.status(404).json({ error: "No user with that email was found." });
  }
  if (targetUser.id === doc.owner_id) {
    return res.status(400).json({ error: "You already own this document." });
  }

  db.prepare(
    `INSERT INTO document_shares (document_id, user_id, permission)
     VALUES (?, ?, ?)
     ON CONFLICT(document_id, user_id) DO UPDATE SET permission = excluded.permission`
  ).run(doc.id, targetUser.id, perm);

  const shares = db
    .prepare(
      `SELECT s.id, s.permission, s.created_at, u.id as user_id, u.name, u.email
       FROM document_shares s
       JOIN users u ON u.id = s.user_id
       WHERE s.document_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(doc.id);

  res.status(201).json({ shares });
});

router.delete("/:id/shares/:shareId", (req, res) => {
  const doc = getDocOr404(req.params.id, res);
  if (!doc) return;

  if (doc.owner_id !== req.user.id) {
    return res.status(403).json({ error: "Only the owner can modify sharing settings." });
  }

  db.prepare("DELETE FROM document_shares WHERE id = ? AND document_id = ?").run(
    req.params.shareId,
    doc.id
  );

  res.status(204).send();
});

module.exports = router;

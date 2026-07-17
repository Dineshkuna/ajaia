const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = [".txt", ".md"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB, generous for plain text/markdown

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error("UNSUPPORTED_FILE_TYPE"));
    }
    cb(null, true);
  },
});

// Very small, dependency-free markdown -> HTML converter that covers the
// subset of formatting this editor supports (headings, bold, italic, lists,
// paragraphs). Good enough for importing a .md draft into the rich editor;
// intentionally not a full CommonMark implementation.
function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlParts = [];
  let inList = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  };

  const inlineFormat = (text) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/__(.+?)__/g, "<u>$1</u>");

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (inList !== "ul") {
        closeList();
        htmlParts.push("<ul>");
        inList = "ul";
      }
      htmlParts.push(`<li>${inlineFormat(bulletMatch[1])}</li>`);
      continue;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      if (inList !== "ol") {
        closeList();
        htmlParts.push("<ol>");
        inList = "ol";
      }
      htmlParts.push(`<li>${inlineFormat(numberedMatch[1])}</li>`);
      continue;
    }

    closeList();
    htmlParts.push(`<p>${inlineFormat(line)}</p>`);
  }
  closeList();

  return htmlParts.join("\n");
}

function plainTextToHtml(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((para) => {
      const escaped = para
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
      return `<p>${escaped}</p>`;
    })
    .join("\n");
}

// POST /api/upload/import -> creates a new document from an uploaded .txt or .md file
router.post("/import", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        return res.status(400).json({
          error: "Unsupported file type. Only .txt and .md files can be imported.",
        });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large. Max size is 2MB." });
      }
      return res.status(400).json({ error: "File upload failed." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file was provided." });
    }

    try {
      const raw = fs.readFileSync(req.file.path, "utf-8");
      const ext = path.extname(req.file.originalname).toLowerCase();
      const html = ext === ".md" ? markdownToHtml(raw) : plainTextToHtml(raw);
      const title = path.basename(req.file.originalname, ext) || "Imported document";

      const result = db
        .prepare("INSERT INTO documents (title, content, owner_id) VALUES (?, ?, ?)")
        .run(title, html, req.user.id);

      const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(result.lastInsertRowid);

      // Clean up the temp upload now that its content lives in the document.
      fs.unlink(req.file.path, () => {});

      res.status(201).json({ document: { ...doc, access: "owner" } });
    } catch (readErr) {
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: "Could not read the uploaded file." });
    }
  });
});

// POST /api/upload/attachment/:documentId -> attaches an arbitrary file to an existing document
router.post("/attachment/:documentId", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.message === "UNSUPPORTED_FILE_TYPE") {
        return res.status(400).json({
          error: "Unsupported file type. Only .txt and .md files can be attached.",
        });
      }
      return res.status(400).json({ error: "File upload failed." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file was provided." });
    }

    const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.documentId);
    if (!doc) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: "Document not found." });
    }

    const isOwner = doc.owner_id === req.user.id;
    const share = db
      .prepare("SELECT permission FROM document_shares WHERE document_id = ? AND user_id = ?")
      .get(doc.id, req.user.id);
    const canEdit = isOwner || (share && share.permission === "edit");
    if (!canEdit) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: "You do not have permission to attach files here." });
    }

    const result = db
      .prepare(
        "INSERT INTO attachments (document_id, original_name, stored_path, uploaded_by) VALUES (?, ?, ?, ?)"
      )
      .run(doc.id, req.file.originalname, req.file.filename, req.user.id);

    res.status(201).json({
      attachment: {
        id: result.lastInsertRowid,
        original_name: req.file.originalname,
        document_id: doc.id,
      },
    });
  });
});

module.exports = router;

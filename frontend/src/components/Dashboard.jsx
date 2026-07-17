import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import ShareModal from "./ShareModal.jsx";

export default function Dashboard({ user, onOpenDocument, onLogout }) {
  const [owned, setOwned] = useState([]);
  const [shared, setShared] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [shareTarget, setShareTarget] = useState(null); // document being shared
  const fileInputRef = useRef(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await api.listDocuments();
      setOwned(data.owned);
      setShared(data.shared);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const data = await api.createDocument({ title: "Untitled document", content: "" });
      onOpenDocument(data.document.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDocument(doc.id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleImportChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const allowed = [".txt", ".md"];
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Only .txt and .md files can be imported.");
      return;
    }

    setImporting(true);
    setError("");
    try {
      const data = await api.importFile(file);
      onOpenDocument(data.document.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="brand">Ajaia Docs</h1>
        <div className="header-actions">
          <span className="current-user">{user.name}</span>
          <button className="ghost-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="toolbar">
        <button className="primary-btn" onClick={handleCreate} disabled={creating}>
          {creating ? "Creating…" : "+ New document"}
        </button>
        <button
          className="secondary-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? "Importing…" : "Import .txt / .md"}
        </button>
        <input
          type="file"
          accept=".txt,.md"
          ref={fileInputRef}
          onChange={handleImportChange}
          style={{ display: "none" }}
        />
        <span className="hint">Supported import formats: .txt, .md (max 2MB)</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="centered-screen small">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <section className="doc-section">
            <h2>My documents</h2>
            {owned.length === 0 ? (
              <p className="empty-state">No documents yet. Create one to get started.</p>
            ) : (
              <ul className="doc-list">
                {owned.map((doc) => (
                  <li key={doc.id} className="doc-row">
                    <button className="doc-title-btn" onClick={() => onOpenDocument(doc.id)}>
                      <span className="doc-title">{doc.title}</span>
                      <span className="doc-meta">Updated {formatDate(doc.updated_at)}</span>
                    </button>
                    <div className="doc-row-actions">
                      <span className="badge badge-owner">Owner</span>
                      <button className="ghost-btn small" onClick={() => setShareTarget(doc)}>
                        Share
                      </button>
                      <button className="ghost-btn small danger" onClick={() => handleDelete(doc)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="doc-section">
            <h2>Shared with me</h2>
            {shared.length === 0 ? (
              <p className="empty-state">Nothing has been shared with you yet.</p>
            ) : (
              <ul className="doc-list">
                {shared.map((doc) => (
                  <li key={doc.id} className="doc-row">
                    <button className="doc-title-btn" onClick={() => onOpenDocument(doc.id)}>
                      <span className="doc-title">{doc.title}</span>
                      <span className="doc-meta">
                        Owned by {doc.owner_name} · Updated {formatDate(doc.updated_at)}
                      </span>
                    </button>
                    <div className="doc-row-actions">
                      <span className={`badge ${doc.access === "edit" ? "badge-edit" : "badge-view"}`}>
                        {doc.access === "edit" ? "Can edit" : "View only"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {shareTarget && (
        <ShareModal document={shareTarget} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}

function formatDate(isoLike) {
  try {
    const d = new Date(isoLike.replace(" ", "T") + "Z");
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoLike;
  }
}

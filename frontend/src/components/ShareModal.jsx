import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function ShareModal({ document: doc, onClose }) {
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("view");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.listShares(doc.id);
      setShares(data.shares);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  async function handleShare(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.addShare(doc.id, email.trim(), permission);
      setEmail("");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(shareId) {
    try {
      await api.removeShare(doc.id, shareId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share “{doc.title}”</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleShare} className="share-form">
          <input
            type="email"
            placeholder="teammate@ajaia.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select value={permission} onChange={(e) => setPermission(e.target.value)}>
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? "Sharing…" : "Share"}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}

        <div className="share-list">
          {loading ? (
            <p>Loading…</p>
          ) : shares.length === 0 ? (
            <p className="empty-state">Not shared with anyone yet.</p>
          ) : (
            shares.map((s) => (
              <div key={s.id} className="share-row">
                <div>
                  <div className="share-name">{s.name}</div>
                  <div className="share-email">{s.email}</div>
                </div>
                <div className="share-row-actions">
                  <span className={`badge ${s.permission === "edit" ? "badge-edit" : "badge-view"}`}>
                    {s.permission === "edit" ? "Can edit" : "View only"}
                  </span>
                  <button className="ghost-btn small danger" onClick={() => handleRemove(s.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

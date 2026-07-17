import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { api } from "../api.js";
import ShareModal from "./ShareModal.jsx";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

const SAVE_DEBOUNCE_MS = 900;

export default function Editor({ docId, user, onBack, onLogout }) {
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [showShare, setShowShare] = useState(false);

  const saveTimer = useRef(null);
  const latestValues = useRef({ title: "", content: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .getDocument(docId)
      .then((data) => {
        if (cancelled) return;
        setDoc(data.document);
        setTitle(data.document.title);
        setContent(data.document.content || "");
        latestValues.current = { title: data.document.title, content: data.document.content || "" };
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [docId]);

  const canEdit = doc && (doc.access === "owner" || doc.access === "edit");

  const persist = useCallback(async () => {
    if (!canEdit) return;
    setSaveState("saving");
    try {
      await api.updateDocument(docId, {
        title: latestValues.current.title,
        content: latestValues.current.content,
      });
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError(err.message);
    }
  }, [docId, canEdit]);

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, SAVE_DEBOUNCE_MS);
  }

  function handleTitleChange(e) {
    const value = e.target.value;
    setTitle(value);
    latestValues.current.title = value;
    scheduleSave();
  }

  function handleContentChange(value) {
    setContent(value);
    latestValues.current.content = value;
    scheduleSave();
  }

  // Flush any pending save when leaving the editor.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        persist();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="centered-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="centered-screen">
        <div className="error-banner">{error}</div>
        <button className="secondary-btn" onClick={onBack}>
          Back to documents
        </button>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <button className="ghost-btn" onClick={onBack}>
          ← Back
        </button>
        <input
          className="title-input"
          value={title}
          onChange={handleTitleChange}
          disabled={!canEdit}
          aria-label="Document title"
        />
        <div className="editor-header-right">
          <SaveIndicator state={saveState} readOnly={!canEdit} />
          {doc?.access === "owner" && (
            <button className="secondary-btn" onClick={() => setShowShare(true)}>
              Share
            </button>
          )}
          <span className="current-user">{user.name}</span>
          <button className="ghost-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      {!canEdit && (
        <div className="view-only-banner">
          You have view-only access to this document. Ask the owner for edit access to make changes.
        </div>
      )}

      <div className="editor-body">
        <ReactQuill
          theme="snow"
          value={content}
          onChange={handleContentChange}
          modules={QUILL_MODULES}
          readOnly={!canEdit}
        />
      </div>

      {showShare && doc && <ShareModal document={doc} onClose={() => setShowShare(false)} />}
    </div>
  );
}

function SaveIndicator({ state, readOnly }) {
  if (readOnly) return <span className="save-indicator muted">Read only</span>;
  if (state === "saving") return <span className="save-indicator">Saving…</span>;
  if (state === "saved") return <span className="save-indicator success">Saved</span>;
  if (state === "error") return <span className="save-indicator danger">Save failed</span>;
  return <span className="save-indicator muted">Up to date</span>;
}

import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Editor from "./components/Editor.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeDocId, setActiveDocId] = useState(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => api.clearToken())
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = useCallback((loggedInUser) => {
    setUser(loggedInUser);
  }, []);

  const handleLogout = useCallback(() => {
    api.clearToken();
    setUser(null);
    setActiveDocId(null);
  }, []);

  if (checkingSession) {
    return (
      <div className="centered-screen">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (activeDocId) {
    return (
      <Editor
        docId={activeDocId}
        user={user}
        onBack={() => setActiveDocId(null)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onOpenDocument={(id) => setActiveDocId(id)}
      onLogout={handleLogout}
    />
  );
}

import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);

  useEffect(() => {
    api
      .demoAccounts()
      .then((data) => setDemoAccounts(data.users || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(email.trim(), password);
      api.setToken(data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail) {
    setEmail(demoEmail);
    setPassword("password123");
  }

  return (
    <div className="centered-screen">
      <div className="login-card">
        <h1 className="brand">Ajaia Docs</h1>
        <p className="subtitle">A lightweight, shared document editor.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@ajaia.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
              required
            />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" disabled={loading} className="primary-btn">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {demoAccounts.length > 0 && (
          <div className="demo-accounts">
            <p>Demo accounts (password: password123)</p>
            <div className="demo-chip-row">
              {demoAccounts.map((u) => (
                <button key={u.email} className="chip" onClick={() => fillDemo(u.email)} type="button">
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

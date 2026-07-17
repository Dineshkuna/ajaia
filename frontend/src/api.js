// Small fetch wrapper. In dev, Vite proxies /api to the backend (see
// vite.config.js). In production, set VITE_API_BASE_URL at build time to
// point at your deployed backend (e.g. https://ajaia-backend.onrender.com).
const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_PROXY_TARGET || "").replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("ajaia_token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";

  const url = `${API_BASE}/api${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error("Unable to reach the server. Please check the backend URL and connection.");
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request("/auth/me"),
  demoAccounts: () => request("/auth/demo-accounts"),

  listDocuments: () => request("/documents"),
  getDocument: (id) => request(`/documents/${id}`),
  createDocument: (payload) => request("/documents", { method: "POST", body: payload }),
  updateDocument: (id, payload) => request(`/documents/${id}`, { method: "PUT", body: payload }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),

  listShares: (id) => request(`/documents/${id}/shares`),
  addShare: (id, email, permission) =>
    request(`/documents/${id}/shares`, { method: "POST", body: { email, permission } }),
  removeShare: (id, shareId) => request(`/documents/${id}/shares/${shareId}`, { method: "DELETE" }),

  importFile: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/upload/import", { method: "POST", body: form, isForm: true });
  },

  setToken: (token) => localStorage.setItem("ajaia_token", token),
  clearToken: () => localStorage.removeItem("ajaia_token"),
  getToken,
};

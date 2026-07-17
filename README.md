# Ajaia Docs

A lightweight, collaborative document editor — create rich-text documents, import `.txt`/`.md` files into them, and share them with teammates at view or edit level. Built for the Ajaia AI-Native Full Stack Developer assignment.

**Stack:** React (Vite) + Quill on the frontend, Node.js/Express + SQLite (`better-sqlite3`) on the backend, JWT auth.

---

## 1. What's included

- **Document creation & editing** — create, rename, edit, autosave, reopen. Rich text via Quill: bold, italic, underline, headings (H1–H3), bulleted/numbered lists.
- **File import** — upload a `.txt` or `.md` file and it becomes a new editable document (markdown headings/bold/italic/lists are converted to rich text; plain text becomes paragraphs).
- **Sharing** — every document has an owner. The owner can grant another seeded user `view` or `edit` access. The dashboard visibly separates "My documents" from "Shared with me," and shared rows show the access level.
- **Persistence** — SQLite file on disk. Documents, shares, and users all survive a server restart or browser refresh.
- **Auth** — simple seeded-account login (email + password, JWT session), not a full signup flow — this keeps the scope reasonable per the assignment brief while still demonstrating real access control.

## 2. Demo accounts

The backend seeds three accounts on first run. All share the password below.

| Name | Email | Password |
|---|---|---|
| Alice Anderson | alice@ajaia.com | password123 |
| Bob Baker | bob@ajaia.com | password123 |
| Carol Chen | carol@ajaia.com | password123 |

Alice starts with one seeded document ("Welcome to Ajaia Docs") already shared with Bob (edit access), so a reviewer can see the "Shared with me" list populated immediately after logging in as Bob — no setup steps required to see sharing work.

To test sharing yourself: log in as Alice, create a document, click **Share**, enter `bob@ajaia.com`, pick a permission, then log in as Bob (in a second browser / incognito window) to see it appear under "Shared with me."

## 3. Local setup

Requires Node.js 18+ (developed and tested on Node 22).

### Backend

```bash
cd backend
cp .env.example .env      # optional — defaults work out of the box
npm install
npm run dev                # starts on http://localhost:4000
```

This creates `backend/data/ajaia.db` (SQLite) on first run and seeds the demo accounts automatically. Uploaded files are written to `backend/uploads/` and then removed once their content has been imported into a document.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:4000`, so you don't need to configure a base URL locally. Open `http://localhost:5173` and log in with any demo account above.

### Running the tests

```bash
cd backend
npm test
```

This runs an automated suite (Node's built-in test runner + Supertest) covering login, document CRUD, permission enforcement (view vs. edit vs. owner), sharing, and file import — 13 tests, all passing at time of submission. The suite uses an isolated database and automatically backs up/restores any existing local dev database around the run, so it's safe to run against your dev environment.

## 4. Deploying

This is a standard two-service deploy: a Node API and a static frontend.

**Backend** (Render / Railway / Fly.io / a VM):
- Build: `npm install`
- Start: `npm start`
- Set `JWT_SECRET` to a real secret in production.
- SQLite is a single file (`backend/data/ajaia.db`) — make sure your host's filesystem persists across deploys (e.g. a mounted volume on Render/Railway), or swap in Postgres if you need multi-instance scaling. The code isolates all DB access in `db.js`, so that swap only touches one file.

**Frontend** (Vercel / Netlify / Render static site):
- Build: `npm run build` → outputs `frontend/dist`
- Set `VITE_API_BASE_URL` to your deployed backend's URL before building.

## 5. Known limits / explicitly out of scope

- File import supports `.txt` and `.md` only (stated in the UI's import button and here). The markdown converter handles headings, bold, italic, underline, and lists — the subset the editor itself supports — not full CommonMark.
- No real-time co-editing (two people editing the same document at once will overwrite each other's autosave). Called out as a stretch goal in the assignment; see `ARCHITECTURE.md` for why it was cut.
- No public signup — accounts are seeded. This was a deliberate scope cut, not an oversight (see `ARCHITECTURE.md`).
- No document version history or trash/undo-delete.
- No email notifications on share.

## 6. Repo layout

```
ajaia-docs/
├── backend/           # Express API + SQLite
│   ├── db.js          # schema + seed data
│   ├── server.js
│   ├── routes/        # auth, documents, upload
│   ├── middleware/     # JWT auth guard
│   └── tests/          # automated test suite
├── frontend/          # React + Vite + Quill
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── components/ # Login, Dashboard, Editor, ShareModal
├── ARCHITECTURE.md
├── AI_WORKFLOW.md
└── SUBMISSION.md
```

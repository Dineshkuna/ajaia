# SUBMISSION.md

## What's in this folder

```
ajaia-docs/
├── backend/                # Express + SQLite API (source code)
├── frontend/                # React + Vite + Quill client (source code)
├── README.md                 # Setup/run instructions (start here)
├── ARCHITECTURE.md            # Prioritization + tradeoffs
├── AI_WORKFLOW.md              # AI usage note
└── SUBMISSION.md              # This file
```

## Status: what is working

- Document creation, rename, rich-text editing (bold/italic/underline/headings/lists), autosave, and reopen after refresh — fully working, backed by automated tests.
- File import: `.txt` and `.md` upload → new editable document, with markdown formatting converted to rich text.
- Sharing: owner-only share management, view vs. edit permission levels, enforced server-side and reflected in the UI (read-only editor for view-only users, "Owner"/"Can edit"/"View only" badges).
- Persistence via SQLite; verified documents and shares survive a server restart.
- 13 automated backend tests covering auth, CRUD, permission boundaries, and file import — all passing (`cd backend && npm test`).
- Both `frontend` (`npm run build`) and `backend` (`npm run dev` / `npm test`) were actually run and verified in this environment, not just written and assumed to work.

## What is incomplete

- **No live deployment URL.** I built and verified this project in a sandboxed dev environment without the ability to provision an external host or hand you a persistent public URL. The README includes exact deploy instructions for Render/Railway/Fly.io (backend) and Vercel/Netlify (frontend) — this is a same-day deploy for either of those, but I did not perform it.
- **No walkthrough video.** I can't record or upload video from this environment. If you run the app locally with `README.md`'s instructions, the flow to walk through would be: log in as Bob → open the pre-shared "Welcome to Ajaia Docs" document → log in as Alice in a second window → create + format a new document → import a `.md` file → share it with Bob at edit level → confirm Bob can now edit it.
- **Attachment-to-existing-document UI** — the backend endpoint exists and is documented, but there's no frontend button for it yet (see ARCHITECTURE.md for why this was deprioritized versus the import flow).
- No real-time collaboration, version history, or export (all listed as optional stretch goals in the brief; not attempted, to protect time spent on the core requirements).

## What I would build next with 2–4 more hours

See the "What I'd build next" section of `ARCHITECTURE.md` — in priority order: attachments UI, version history, real-time presence indicators, export to PDF/Markdown.

## Note on this submission

This was produced as a coding exercise inside an AI assistant's sandboxed environment. Everything under "What is working" was actually executed and checked in that environment (server started, endpoints curled, tests run, frontend built). The two items under "What is incomplete" — a public deployment and a recorded video — require action outside that sandbox (hosting an account, screen recording) that I could not perform for you. If you can run the project locally per the README, I'm confident the core assignment requirements are met; the last-mile deploy/record steps are mechanical and covered by the README's deploy section.

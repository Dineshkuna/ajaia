# Architecture Note

## Priorities, in order

1. **A correct, well-tested permission model.** Sharing is the part of this assignment most likely to have subtle bugs (can a view-only user edit via a stale request? can a non-owner reshare?), so I put the most engineering care here: a single `getAccess()`/`canEdit()` helper used consistently across every document route, and automated tests that specifically try to violate the permission boundary (view-only user attempting a PUT, non-owner attempting a DELETE or a share).
2. **An editing experience that actually feels usable.** Rather than build a custom contenteditable implementation, I used Quill (via `react-quill`) — it's a mature, accessible rich-text editor, and building a bespoke one would have spent hours reproducing behavior (list nesting, undo/redo, paste handling) that isn't the point of this assignment.
3. **A file import path that's genuinely useful, not a checkbox.** Importing a `.md` file converts real markdown syntax (headings, bold, italic, lists) into the same rich-text format the editor produces, so an imported draft is immediately editable with the same toolbar — not just dumped as an unstyled blob.
4. **Boring, inspectable persistence.** SQLite via `better-sqlite3` (synchronous, no connection-pool complexity) with a plain relational schema (`users`, `documents`, `document_shares`, `attachments`). Nothing here needs a document database or an ORM's abstraction; three tables and hand-written SQL are easy to audit in a timeboxed review.

## Key decisions and tradeoffs

**Seeded accounts instead of signup.** The brief explicitly allows "seeded accounts, mocked auth, or a lightweight login flow." A real signup flow (email verification, password reset) would have consumed hours without adding anything the sharing model needs to demonstrate. I still implemented real JWT-based auth with hashed passwords (bcrypt) rather than faking it entirely, since the permission logic depends on knowing who's actually asking.

**Autosave over an explicit Save button.** Google Docs's core interaction is "you never lose work and never think about saving." I debounce content/title changes (900ms) and flush on unmount. The tradeoff: two people editing the same document concurrently will silently overwrite each other (last write wins) — there's no operational-transform or CRDT layer. That's real-time collaboration, which the brief lists as an optional stretch goal, not a core requirement, so I scoped it out deliberately rather than half-build it.

**View vs. edit as the only two permission levels.** The brief asks for "a way to grant another user access" and "a visible distinction between owned and shared" — not a full RBAC system. Two levels (view/edit) plus owner covers the demonstrable cases (can view but not edit; can edit but not delete/reshare) without inventing a permission matrix the assignment didn't ask for.

**SQLite over Postgres/Supabase.** The brief explicitly allows SQLite for this scope. It means zero external service to provision, and the entire dataset for a reviewer to inspect is a single file. All DB access is isolated in `backend/db.js`, so swapping to Postgres later is a contained change if this needed to scale past a single instance.

**Minimal markdown converter instead of a library.** I considered pulling in `marked` or `showdown`, but the editor only supports a specific subset of formatting (headings, bold, italic, underline, lists) — a full CommonMark parser would support far more than the editor can render, creating a mismatch (e.g. imported tables or code blocks that silently vanish). A ~60-line converter scoped to exactly what Quill's toolbar supports avoids that mismatch and is easy to verify by reading it end to end.

**No global state library on the frontend.** Three screens (login, dashboard, editor) with straightforward prop-drilling didn't justify Redux/Zustand/Context overhead. If the app grew past a handful of screens, that calculus would change.

## What I'd build next with 2–4 more hours

- **Attachments UI.** The backend already supports attaching a file to an existing document (`POST /api/upload/attachment/:documentId`) but there's no frontend surface for it yet — I prioritized the import flow (turns a file into a document) over the attachment flow (adds a file to a document) since the former demonstrates more of the "file handling in a real product" evaluation criterion in the time available.
- **Document version history** (listed as a stretch goal) — straightforward to add given the schema: snapshot `content` into a `document_versions` table on each save past a size/time threshold, with a simple diff-free "restore this version" action.
- **Real-time presence** (cursor/avatar of who else has the doc open) using WebSockets — valuable, but genuine concurrent editing safety (CRDT/OT) is a multi-day project on its own, not a 2–4 hour add-on, so I'd scope it down to presence indicators only rather than true concurrent editing.
- **Export to PDF/Markdown** — the inverse of the import path; would reuse the same "supported formatting subset" thinking.
- Rate limiting and stricter input validation (e.g. a schema validator like `zod`) on the API before this went anywhere near production traffic.

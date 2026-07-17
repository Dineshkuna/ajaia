# AI Workflow Note

## Which AI tools I used

Claude (Anthropic) as an AI-native coding assistant, working directly in a sandboxed dev environment with the ability to write files, run `npm install`, start servers, and execute the test suite — not just generate code in a chat window.

## Where AI materially sped up the work

- **Boilerplate and repetitive CRUD scaffolding.** The Express route handlers for documents (list/create/read/update/delete/share) follow a repeated pattern (fetch doc → check access → act → respond). Having the assistant draft that pattern once and apply it consistently across every route saved the most time — the kind of work that's mechanical but easy to get subtly inconsistent by hand (e.g. forgetting a permission check on one route).
- **The markdown-to-HTML converter.** Writing a small, scoped converter (rather than reaching for a full library) that maps exactly onto Quill's supported formatting was faster to iterate on with AI drafting the regex-based line parser, which I then read line by line and adjusted.
- **The permission-matrix test suite.** Enumerating the actual test cases (owner vs. edit-share vs. view-share vs. no-share, for each of view/edit/delete/share) is exactly the kind of exhaustive-but-mechanical thinking AI is good at getting to completely and quickly, rather than a human writing 5 tests and calling it done.
- **CSS/design pass.** Getting a full, coherent stylesheet (spacing scale, component states, responsive breakpoints) to a "usable, not embarrassing" bar in one pass rather than iterating manually property-by-property.

## What AI-generated output I changed or rejected

- **Rejected: a full markdown library (`marked`/`showdown`) for the import feature.** The first draft pulled in a general-purpose parser. I rejected this because it would silently support markdown features (tables, code fences, images) that the editor's toolbar can't render or preserve on re-save — a mismatch that would confuse a user more than help them. I replaced it with a small hand-written converter scoped to exactly the formatting Quill supports.
- **Changed: the original sharing model allowed re-sharing by edit-level collaborators.** I decided that's a real product decision, not an implementation detail, and tightened it so only the owner can manage sharing — matching "a document owner" and "a way to grant another user access" in the brief literally, rather than the more permissive interpretation the first draft took.
- **Changed: autosave debounce and flush-on-unmount.** The initial version only had a debounce timer with no flush when navigating away, which meant the last few keystrokes before clicking "Back" could be lost. I added an unmount effect that flushes any pending save — this is the kind of edge case that's easy for an AI-drafted first pass to miss because it works fine in the "type, then wait" test path but breaks in the "type, then immediately navigate" path.
- **Rejected: an initial attempt to store rich text as Markdown instead of HTML.** Quill's native format is HTML/Delta; converting to and from Markdown on every save would have been extra surface area for formatting to degrade (e.g. nested lists) for no real benefit at this scope. I kept HTML as the storage format and only convert markdown on the way in, one direction, at import time.

## How I verified correctness, UX quality, and implementation reliability

- **Correctness:** ran the actual backend with `curl` against every endpoint (login, list, create, share, import) before writing the automated test suite, to confirm real behavior rather than trusting the code read correctly. Then wrote and ran the Supertest suite (13 tests), which specifically targets the permission boundaries — the area most likely to have a logic bug — and confirmed all pass.
- **Build correctness:** ran `npm run build` on the frontend and `npm test` on the backend as explicit checks before considering any piece "done," not just visual inspection of the code.
- **UX quality:** walked through the actual user flows this assignment specifies (create → edit → rename → refresh → still there; import a `.md` file → confirm formatting; share with a second seeded account → log in as that account → confirm it appears under "Shared with me" with the correct permission badge, and that a view-only editor is genuinely read-only in the UI, not just blocked server-side).
- **What I did not have AI verify for me:** the actual product-scope decisions in `ARCHITECTURE.md` (what to cut, what to prioritize, the two-permission-level model) were my judgment calls, not generated or delegated — AI is good at implementing a decision quickly, not at deciding what this specific assignment is actually evaluating.

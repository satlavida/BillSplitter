# BillSplitter — technical overview

Bill Splitter is a React/TypeScript app for splitting bills among a group of
people, with an optional Go backend for real-time multi-device collaboration
("Go Live") and receipt scanning. The frontend works fully offline as a
static site; the Go server is required only for live collaboration and for
"Scan Receipt".

There is no other CLAUDE.md in this repo. `AGENTS.md` is a pre-v3 snapshot
(JavaScript, no routing, no server, no live collaboration) — **stale, do not
treat it as current**. `V3_PROGRESS.md` and `planv3.md` are the design/progress
docs for the v3 rewrite this file summarizes.

## Feature documentation (`architecture/`)

`architecture/` (not `docs/` — that's the gitignored Vite build output, see
Directory map below) holds one Markdown doc per feature, each covering its
frontend files, backend files, a brief of what it does, and a Notes section
for decisions/quirks/TODOs/omitted specs. Start at `architecture/README.md`
for the full feature list and a route → doc index.

- **Before implementing or reasoning about a feature**, read its doc in
  `architecture/` first to get the full frontend+backend picture.
- **Whenever a feature or its behavior changes**, update the corresponding
  `architecture/*.md` doc (files touched, behavior, Notes) as part of the
  same piece of work, not as a follow-up.
- **New features** get a new `architecture/*.md` doc following the existing
  template (see any current doc), plus an entry in `architecture/README.md`.

## Workflow rules

- **Commit in small, independently verifiable phases.** Each commit should
  be a working, reviewable slice, not one large batch of unrelated changes.
- **Run tests before committing.** `npm test` for frontend changes,
  `cd server && go test ./...` for backend changes, and relevant Playwright
  specs (`npm run e2e`) when touching live-collaboration flows. Don't commit
  on faith.
- **Prefer simpler, data-correct, data-oriented code** over clever or
  heavily-abstracted solutions — matches the existing hand-written-SQL,
  no-ORM, no-premature-abstraction style already used in this repo.
- **Check `src/ui/components.tsx` for an existing generic component before
  building a new one-off** (see UI kit note under Stack below).

## Stack

- **Frontend**: React 19 + TypeScript (`.tsx`), Vite 6, Tailwind CSS 4,
  react-router-dom 7 (`HashRouter` — see `src/App.tsx`'s comment on why, static
  GitHub Pages hosting with no SPA fallback).
- **State**: Zustand, no ORM/backend required for local use.
  - `src/sessionStore.ts` — the source of truth, persisted to localStorage.
    Holds `Session[]`, each with `people` and `bills`; `Bill.items` holds the
    line items. Also owns the "push to live server" logic (best-effort,
    fire-and-forget — see `pushNewBillLive`/`pushBillFieldsLive`/etc.) and
    `mergeLiveSnapshot` (merges a fetched live-server snapshot back in by
    entity id).
  - `src/billStore.ts` — a **non-persisted scratch editor** for whichever
    bill is currently open. `BillEditorPage.tsx` hydrates it from
    `sessionStore` on route entry and subscribes to its changes to commit
    them back to `sessionStore.updateBill`. It is not the source of truth —
    if you write to a bill's fields from outside `BillEditorPage` (e.g. a
    background task), write to `sessionStore` directly; only write to
    `billStore` too if you know the user currently has that exact bill open
    (`useBillStore.getState().billId === billId`), or the on-screen scratch
    editor won't reflect the change until the user navigates away and back.
  - `src/schemas/` — Zod schemas + inferred types for all of the above
    (`session.schema.ts`, `bill.schema.ts`, `live.schema.ts`,
    `receiptScan.schema.ts`). Note the Zod `.default()` gotcha: it applies
    during `.parse()`, not to hand-built object literals typed as `Bill` —
    every field must be present when constructing one directly (see
    `src/migrations/toSessionStore.ts`, test fixtures).
  - `src/migrations/toSessionStore.ts` — one-time migration from the pre-v3
    localStorage shape into `sessionStore`.
- **Local image storage**: `src/lib/imageStore.ts`, IndexedDB (`idb`
  package) — receipt images are too large for localStorage, so only a
  `{refKey, width, height}` reference lives on `Bill.receiptImage`; the
  actual bytes are keyed by `refKey` in IndexedDB.
- **UI kit**: `src/ui/components.tsx` (`Button`, `Card`, `Modal`,
  `FileUpload`, `Spinner`, `Alert`, etc.) — reuse these rather than adding
  new one-off styled elements. There is no toast/notification system;
  errors are surfaced via local `useState` + `Alert`.

## Go server (`server/`)

Two responsibilities, both optional for local/offline use of the core bill
splitter, but load-bearing for the features they support:

1. **Live collaboration** ("Go Live" — planv3.md Phase 3): sessions,
   join/approve, item claims, SSE-based real-time sync, settle flow.
2. **Receipt scanning** (`POST /api/scan`): as of the bill-processor
   migration, this replaced an external Cloudflare Worker
   (`bill-processor.satlavida.workers.dev`) that used to do this. "Scan
   Receipt" in the frontend now depends on this server being reachable.

Structure: `server/cmd/server/main.go` (entrypoint) →
`server/internal/{api,db,store,sse,settlement,middleware,cleanup,config}`.

- **DB**: SQLite via `modernc.org/sqlite` (pure Go, no CGO). No ORM/sqlc —
  hand-written SQL in `internal/store/store.go`, deliberately, since the
  schema is small. Migrations are plain `.sql` files in
  `internal/db/migrations/`, embedded and applied in filename order on every
  startup (`CREATE TABLE IF NOT EXISTS` — idempotent).
- **API**: `net/http` `ServeMux` (Go 1.22+ method+pattern routing), wired in
  `internal/api/router.go`. Handlers are grouped one file per domain
  (`session_handlers.go`-style, `admin_handlers.go`, `scan_handlers.go`, …).
- **CORS/origin gating**: `internal/middleware/allowlist.go` — exact-match
  against `ALLOWED_ORIGINS`, always allows localhost/127.0.0.1. Handles
  preflight `OPTIONS` too. This is shared by every route including
  `/api/scan`.
- **Admin panel**: server-rendered `html/template` pages (not React — kept
  deliberately small/internal-only per planv3.md), gated by a static
  `ADMIN_TOKEN` bearer token (`requireAdminToken` in `admin_handlers.go`).
  Routes: `/admin` (sessions + purge), `/admin/stats` (aggregate counts),
  `/admin/bill-processor` (receipt-scan usage analytics).
- **Deployment**: `server/DEPLOYMENT.md` — systemd unit, Docker, nginx/TLS
  reverse-proxy notes (SSE needs `proxy_buffering off`), full env var
  reference.

### Receipt scanning specifics

`server/internal/api/scan_handlers.go` calls OpenRouter
(`https://openrouter.ai/api/v1/chat/completions`) with a vision-capable
model (`OPENROUTER_MODEL`, default `google/gemini-3.1-flash-lite`) and a
fixed extraction prompt (`analysisPrompt`, ported verbatim from the old
Worker's `prompt.js`). The response contract is preserved exactly from the
Worker for frontend compatibility, **including a deliberate quirk**: if the
model's output isn't parseable JSON, the endpoint still returns `200 OK`
with `{"raw_response": "...", "error": "..."}` rather than an HTTP error —
callers must check for that shape, not just `response.ok`.

Usage/analytics (`scan_requests`, `scan_usage_daily`, `scan_usage_monthly`
tables, migration `0002_scan_usage.sql`) replaced the Worker's Cloudflare KV
storage — SQLite with atomic `INSERT ... ON CONFLICT` upserts instead of
KV's non-atomic read-modify-write.

### Frontend side (async scanning)

`src/Components/ScanReceiptButton.tsx` no longer blocks the upload modal on
the scan network call. On submit it: resizes + stores the image to
IndexedDB, marks the bill `scanStatus: 'processing'` on `sessionStore`,
closes the modal immediately, then fires `src/lib/receiptScan.ts`'s
`scanBillReceipt(sessionId, billId)` without awaiting it (that function has
its own try/catch and writes results straight to the store, so it's safe
for the triggering component to unmount mid-flight). Progress/failure
surfaces in two places: a spinner in the app-bar `Header` (`src/App.tsx`,
counts bills with `scanStatus === 'processing'` in the current session) and
inline `Alert`s with Retry/Dismiss on `SessionHomePage`'s bill list, keyed
off `Bill.scanStatus`/`Bill.scanError` (`'offline'` for a network-level
failure reaching the server vs `'failed'` for a reachable-but-unsuccessful
scan).

## Testing

- **Jest** (unit): `npm test` / `npm run test:coverage`. Config in
  `jest.config.js` + `babel.config.js`. Tests live next to the source
  (`*.test.ts`).
- **Playwright** (`e2e/`): `npm run e2e`. `playwright.config.ts`'s
  `webServer` array boots both the Vite dev server (5173) and the real Go
  backend (`go run ./cmd/server`, 8080, scratch gitignored DB/image dir) so
  e2e specs exercise the real server, not mocks.
- **Go** (`server/`): `cd server && go test ./...`. Package-local
  `*_test.go` files; `internal/api/integration_test.go` spins up a real
  `httptest` server against a temp SQLite DB.

## Directory map

```
src/
  Pages/           route-level components (SessionHomePage, BillEditorPage, JoinPage, ...)
  Components/      feature components (ScanReceiptButton, GoLiveSection, Sidebar/, ...)
  ui/               shared UI kit (components.tsx)
  lib/              framework-agnostic helpers (liveApi.ts, receiptScan.ts, imageStore.ts, ...)
  hooks/            React hooks (useOnlineStatus, ...)
  schemas/          Zod schemas + types, including schemas/legacy/ for migration
  migrations/       one-time localStorage migrations
server/
  cmd/server/       entrypoint (main.go)
  internal/
    api/            HTTP handlers + router
    db/             SQLite connection + embedded migrations/*.sql
    store/          hand-written SQL repository layer
    sse/            server-sent-events hub for live sync
    settlement/     debt-simplification logic for the settle flow
    middleware/      allowlist/CORS, logging
    cleanup/        background job purging stale/settled sessions (48h)
    config/         env var loading
e2e/                Playwright specs (run against the real Go backend)
architecture/       feature-by-feature reference docs (see above) — committed, not build output
docs/               build output (GitHub Pages deploy target, gitignored)
changes/            dated changelog-style notes
V3_PROGRESS.md      v3 rewrite progress log (kept up to date)
planv3.md           v3 rewrite design doc
server/DEPLOYMENT.md  Go server deployment guide
```

## Environment variables (frontend)

- `VITE_LIVE_SERVER_URL` — base URL of the Go server, used by both
  `src/lib/liveApi.ts` (live collaboration) and `src/lib/receiptScan.ts`
  (scanning). Defaults to `http://localhost:8080` if unset. `.env.production`
  must point this at wherever `server/` is actually deployed — there is no
  working default for a production build.

(`VITE_WORKER_URL` no longer exists — that was the pre-migration external
Cloudflare Worker endpoint for receipt scanning.)

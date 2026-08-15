# BillSplitter v3 — Progress Log

Tracks what's done and what's left against the phased plan in `planv3.md`. Update this file as work lands on `feature/v3Major`.

## Done

### Phase 1 — TypeScript + Zod migration (complete)
- [x] Tooling: `tsconfig.json`, `jest.config.js`/`eslint.config.js` alias fixes, `npm run typecheck` script, `@babel/preset-typescript` wired into Jest
- [x] Zod schemas: `bill.schema.ts` (Person/Item/ConsumedByEntry with legacy string→object normalization), `receiptScan.schema.ts`, `billHistory.schema.ts`, `currency.schema.ts` — all with tests
- [x] Stores converted to `.ts`: `currencyStore`, `billStore` (persist hydration now Zod-validated via `merge`), `billHistoryStore`, `passAndSplitStore`
- [x] `billStore.test.js` → `billStore.test.ts`
- [x] Shared UI library `ui/components.tsx`, `ThemeContext.tsx`
- [x] Sidebar subtree (`Sidebar`, `SidebarItem`, `HamburgerButton`, index)
- [x] BillHistory subtree (`BillHistoryButton`, `BillHistoryContext`, `BillHistoryModal`, `FileImport`, `useBillHistoryModal`)
- [x] PassAndSplit subtree (all 9 files incl. `ModalPortal`, `ItemCard`, `ItemSwipeStack`, controller/index)
- [x] `ScanReceiptButton.tsx` — wired `ReceiptScanResponseSchema.parse()` onto the fetch response boundary (previously zero validation)
- [x] Step screens: `PeopleInput`, `ItemsInput`, `ItemAssignment`, `BillSummary`, `Settings`
- [x] Root: `App.tsx`, `main.tsx`, `index.html` updated
- [x] Zero `.js`/`.jsx` files remain in `src/`; zero `any` usage
- [x] Verified green throughout: `typecheck`, `lint` (only 2 pre-existing `ModalPortal` conditional-hook issues remain, confirmed present on unmodified `main`), `test` (67/67), `build`

**Commits:** `7cd2ecd`, `74003a9`, `dd40880` on `feature/v3Major`

### Not yet done from Phase 1 scope
- [ ] Live browser smoke test of the converted app (dev server verified serving correctly via `curl`; interactive browser-tool check hit a transient tooling glitch and wasn't completed — worth a manual pass: all 4 steps, Pass & Split, Scan Receipt, Bill History, Export/Import)

### Phase 2 — Sessions/multi-bill offline model, paid-by/settlement, React Router (complete)
- [x] `sessionStore.ts` + `session.schema.ts` (shared people pool per session, multiple bills, `paidByPersonId`, `receiptImage` ref)
- [x] `lib/personTotals.ts` extracted from `billStore.getPersonTotals()` (shared by billStore + settlement)
- [x] `lib/settlement.ts` — net balance + greedy debt-simplification, exhaustively tested incl. zero-sum invariant
- [x] `lib/imageResize.ts` — resize-to-fit, aspect-preserved, never-upscale, JPEG q0.85
- [x] React Router (`react-router-dom`, **HashRouter** — chosen over BrowserRouter since this app deploys to static GitHub Pages with no server-side SPA fallback, so deep links would 404 on refresh otherwise): `/`, `/sessions`, `/session/:sessionId`, `/session/:sessionId/bill/:billId`, `/session/:sessionId/settlement`, `/join/:code` (placeholder), `/settings`
- [x] `billStore.ts` rescoped to a non-persisted scratch editor (`hydrateFromSession()` + subscription-based commit-back in `BillEditorPage`)
- [x] Removed the superseded BillHistory UI (`BillHistoryButton`/`Context`/`Modal`, `useBillHistoryModal`, `billHistoryStore.ts`) — `SessionsListPage` replaces it
- [x] Migration script `migrations/toSessionStore.ts`, run once at boot, migrates old `billHistory`/`billSplitter` localStorage data into `sessionStore`, using frozen legacy schemas in `schemas/legacy/`
- [x] `PaidBySelector` in `BillSummary` reads/writes `sessionStore.setBillPaidBy` directly
- [x] `lib/imageStore.ts` (IndexedDB via `idb`) + `ScanReceiptButton` wired to resize/store the scanned receipt, `ReceiptImagePreview` in `BillSummary` re-displays it
- [x] `sessionStore.importSession` distinguishes an old pre-session export from a corrupt one with a clear error message
- [x] Verified via typecheck/lint/test/build (all green, 120/120 tests) + manual code review of hydration/commit effect ordering

**Commits:** `9ae5801`, `6b36b4d`, `fe348b1`, `2bfb35a` on `feature/v3Major`

**⚠️ Not yet manually verified in a live browser** — the sandboxed browser tool used in this session can reach external sites but not `localhost` at all (confirmed across dev server, HMR, and production preview build, on multiple ports), so the new routing/hydration flow was originally verified only via types, tests, and manual code review, not an actual click-through. **Superseded by real browser coverage — see Phase Test below.**

### Phase Test — Playwright end-to-end coverage of Phase 1 + 2 (complete)
Closes the manual-browser-verification gap left open above: a real Chromium browser now drives the app end-to-end instead of relying on code review alone.
- [x] `@playwright/test` added as a dev dependency, Chromium browser installed (`npx playwright install chromium`)
- [x] `playwright.config.ts` — boots the Vite dev server on port 5173 (`webServer`), runs against Chromium, HTML+list reporters, trace on first retry
- [x] `npm run e2e` / `npm run e2e:ui` scripts added; `jest.config.js` given `testPathIgnorePatterns` for `e2e/` so Jest doesn't also try to collect Playwright specs (they use an incompatible `test`/`expect` from `@playwright/test`)
- [x] `eslint.config.js` — added a `globals.node` override scoped to `e2e/**` and `playwright.config.ts` (`Buffer`, `process`) so lint stays clean without loosening the browser-code ruleset
- [x] 15 specs across 4 files, all green against Chromium:
  - `e2e/navigation.spec.ts` — root redirect creates/loads a session and lands on session home (not directly in the editor — a fresh session starts with 0 bills), sidebar Sessions/Settings navigation, unknown session/bill ids redirect to `/sessions`, `/join/:code` placeholder, browser back/forward across routes
  - `e2e/bill-editor-flow.spec.ts` — full 4-step flow (people → items → assignment → summary) with a real computed total assertion, bill edits committing back to `sessionStore` and surviving a bill switch (shared people pool visible on a second bill), paid-by selection persisting across a full page reload (confirms it's read from `sessionStore`, not local `billStore` state, since a reload always re-hydrates the editor at step 1)
  - `e2e/sessions-list.spec.ts` — create/delete, export→delete→import round-trip (via real file download/upload), malformed-JSON import error, well-formed-but-wrong-shape import error, old pre-session-export import error message
  - `e2e/settlement.spec.ts` — net balance + "who pays whom" transaction text for a paid bill, "settled up" / "no people yet" empty states
- [x] **Found and documented a real (pre-existing, not introduced by v3) bug while writing these tests**: `currencyStore.ts`'s `detectCurrency()` calls `Intl.NumberFormat().resolvedOptions().currency` — but `resolvedOptions()` only has a `currency` field when `style: 'currency'` is passed, so this always evaluates to `undefined` and silently falls back to the `USD` default regardless of the user's actual locale. Left unfixed (out of scope for this pass); tests assert against the real `$`-formatted output rather than the intended locale-detected currency. Worth a follow-up fix.
- [x] Verified via `npm run typecheck`, `npm run lint` (still only the 2 pre-existing `ModalPortal` issues), `npm test` (120/120 Jest tests unaffected), `npm run build`, and `npx playwright test` (15/15)

**Still not covered by this pass** (acceptable gaps, not blockers): receipt image capture/display (needs a real camera/file-upload + OCR backend call), the `Go Live` button (disabled placeholder), and the migration script's real-world path from actual pre-v3 exported data (covered only by unit tests against synthetic fixtures).

### Phase 3 — Go backend + live collaboration (server-side complete; frontend partially wired)
- [x] `/server` Go project scaffold: `go.mod` (`billsplitter/server`), `cmd/server/main.go`, `internal/config` (env-driven `PORT`/`DB_PATH`/`IMAGE_DIR`/`ALLOWED_ORIGINS`/`ADMIN_TOKEN`/`CLEANUP_INTERVAL_MINUTES`), stdlib `net/http` `ServeMux` (Go 1.22+ method+path routing, no router dependency), `modernc.org/sqlite` (pure-Go driver)
- [x] SQLite schema (`internal/db/migrations/0001_init.sql`, applied idempotently via `CREATE TABLE IF NOT EXISTS` on every boot): `sessions`, `people`, `bills`, `items`, `item_allocations` (normalized — one row per `{item, person}`, specifically so concurrent claims are row-level inserts, not read-modify-write races on a JSON blob), `joiners`, `item_claims`, `images`. `PRAGMA foreign_keys=ON`, `busy_timeout=5000`, `journal_mode=WAL`, connection pool capped to 1 (SQLite allows one writer regardless of pool size — this avoids `SQLITE_BUSY` under concurrent writes from this process without needing per-call retry logic)
- [x] `internal/store` — hand-written SQL repository layer (no ORM) shared by the API handlers and the cleanup job
- [x] Localhost + domain allowlist middleware (`internal/middleware/allowlist.go`): localhost/127.0.0.1/`::1` always pass, `ALLOWED_ORIGINS` exact-matched otherwise, 403 out; requests with no `Origin` header (curl, server-to-server) pass through — this guards browser cross-origin access, not general network access. Unit tested.
- [x] Go-Live API (`internal/api`): `POST /api/sessions` (create + creator token), `GET /api/sessions/{code}`, `POST /api/sessions/{code}/join` (branches on `join_mode`: `approval_code` → pending + 2-digit code, `open_link` → auto-approved), `POST .../joiners/{id}/approve|disapprove` (creator-only via `X-Creator-Token`), `POST .../bills`, `POST .../bills/{billId}/items`, `POST .../bills/{billId}/items/{itemId}/claims` (`free_select` → direct insert-only allocation, `claims_require_approval` → pending `item_claims` row), `POST .../claims/{id}/approve`, `POST .../settle`, `GET .../settlement` (server-computed, so all joiners see identical numbers), plus `POST .../bills/{billId}/images` / `GET /api/images/{refKey}` for receipt image upload/serve (image sync onto the server wasn't explicitly speced in 3.5 but is in the 3.1 layout — added to close that gap)
- [x] SSE hub (`internal/sse/hub.go`): per-session-code subscriber registry, `GET /api/sessions/{code}/events`, small entity-id-only event payloads (`joiner.pending`, `joiner.approved`, `claim.pending`, `claim.approved`, `item.updated`, `bill.updated`, `session.settled`), non-blocking broadcast (a stuck subscriber is dropped for that event rather than blocking the broadcaster). Unit tested.
- [x] Client-side live sync (`src/lib/liveSync.ts`): `EventSource` if available, falls back to polling after `EventSource` is undefined or after 3 reconnect failures within 30s; `live`/`reconnecting`/`polling` status surfaced, not failed silently. Deliberately decoupled from `import.meta.env` (takes `baseUrl` as an explicit param) so it stays unit-testable under Jest/Babel's CommonJS transform, which can't represent `import.meta` — 5 tests with a mocked `EventSource`, including one that caught a real bug (see below)
- [x] 48h cleanup job (`internal/cleanup/job.go`): ticker-based (default 30 min), purges `is_settled=1 AND settled_at<=now-48h` OR `is_settled=0 AND last_access_at<=now-48h`; image files removed *before* the cascading SQL delete so a mid-purge crash never orphans a file. `last_access_at` bumped on every session-touching store call. Unit tested against a backdated session with a real on-disk image file.
- [x] Admin panel (`internal/api/admin_handlers.go`): server-rendered `html/template` (not a separate app), `GET /admin` (session list + per-row purge form), `GET /admin/stats` (session/bill/image counts, avg bills/session), `POST /admin/sessions/{code}/purge`; gated by the allowlist middleware plus a static `ADMIN_TOKEN` from config (disabled entirely if unset)
- [x] Go settlement port (`internal/settlement`): hand-mirrored (not shared via any TS/Go bridge, per plan) from `src/lib/settlement.ts` and its `personTotals.ts` dependency; same balance/greedy-debt-simplification algorithm, same epsilon/rounding convention. 12 tests mirroring `settlement.test.ts`'s exact fixtures (single/multiple payers, overlapping people, null-payer bills, zero-sum invariant, fractional-cent rounding)
- [x] `httptest.Server`-based integration tests (`internal/api/integration_test.go`): full join → approve → add bill/item → pending claim → approve claim → settlement flow; a concurrent-claims test (`free_select` mode, two goroutines claiming different items on the same item simultaneously) that **caught a real concurrency bug** — see below
- [x] Frontend: `sessionStore.ts` gained `liveCode`/`liveCreatorToken` fields + a `markSessionLive` action; `GoLiveSection.tsx` on `SessionHomePage` — join-mode/claim-mode picker → `POST /api/sessions` → shows the resulting code/link; `JoinPage.tsx` rewired from a static placeholder to the real flow — loads the session by code, lets the joiner pick an existing person or enter a name, submits, shows the pending-approval state (with the 2-digit code) or immediate-admission state depending on `join_mode`
- [x] **Found and fixed a real concurrency bug while writing the integration test**: the SQLite connection was opened without `busy_timeout`/WAL, so two goroutines writing concurrently (simulating two joiners claiming different items at once) hit `SQLITE_BUSY` and one write failed outright. Fixed in `internal/db/db.go` by adding `_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)` and capping the connection pool to 1 (SQLite only ever allows one writer regardless of pool size, so a bigger pool just added contention, not throughput).
- [x] **Found and fixed a real timestamp-comparison bug**: `store.go`'s timestamps were originally written in Go's RFC3339 format (`2006-01-02T15:04:05Z`), but `PurgeStaleSessions`'s SQL compares them as plain strings against SQLite's own `datetime('now', ...)` output (`2006-01-02 15:04:05`, space-separated, no `Z`) — the `T`/`Z` vs space mismatch meant string comparison didn't reliably agree with chronological order on same-day boundaries. Fixed by changing the Go-side `now()` helper to emit timestamps in SQLite's own format, verified by `cleanup/job_test.go` purging a real backdated session.
- [x] **Found and fixed a real bug in `liveSync.ts` during its own test-writing**: `startEventSource` checked `typeof EventSource === 'undefined'` before checking for an injected `eventSourceFactory` override, so under Jest/jsdom (where `EventSource` is undefined) it always fell straight to polling regardless of the test's mock — the tests couldn't actually exercise the `EventSource` path at all until fixed.
- [x] Verified: `go build ./...`, `gofmt -l .` (clean), `go vet ./...` (clean), `go test ./...` (all packages green) for the server; `npm run typecheck` / `npm run lint` (still only the 2 pre-existing `ModalPortal` issues) / `npm test` (125/125, up from 120) / `npm run build` / `npx playwright test` (17/17, up from 15 — added `e2e/go-live.spec.ts` and updated the `/join/:code` navigation test for the new real flow) for the frontend
- [x] Live end-to-end smoke test against the actual running binary (`go run ./cmd/server`, not just `go test`): `/healthz` 200, unconfigured-origin 403, `POST /api/sessions` 201 with a real code/creator-token, `/admin` 403 without a token / 200 with one

**Not covered by this pass** (explicitly deferred, not silently skipped):
- Live item-claiming UI for joiners (the `JoinPage` shows pending/admitted state but doesn't yet expose a claim-items screen — the server API for it is done and integration-tested, just not wired into a joiner-facing component)
- The creator-side approvals page (approve/disapprove pending joiners and claims) — server endpoints exist and are tested, no frontend UI yet
- Two-way entity-id-based merge of SSE/poll events into `sessionStore` for the *creator's* client (planv3.md 3.10's "merge by entity id, never wholesale-replace" strategy) — `liveSync.ts`'s event delivery mechanism is built and tested, but nothing currently subscribes to it from a page component
- `joinerId` token persistence in the joiner's own localStorage (so a refresh doesn't lose their place) — not yet implemented
- Receipt image sync to the server during live sessions (upload/serve endpoints exist server-side and are wired into no frontend call site yet)
- Deployment/hosting story for the Go server (env var documentation, systemd/Docker, etc.) — out of scope for this pass, `server/` runs via `go run ./cmd/server` today with sane local defaults

## Reference
- Full phased plan: `planv3.md` (repo root)
- Branch: `feature/v3Major`

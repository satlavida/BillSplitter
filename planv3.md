# BillSplitter v3 — Implementation Plan

Branch: `feature/v3Major` (created from a clean `main` after stashing current uncommitted work — `.env`/`.env.production` changes, `src/Components/VoiceCommand/`, `src/voiceToolStore.js`, `src/App.jsx` edits — which stays stashed and untouched by this plan).

## Context

BillSplitter today is a single-page, step-driven (no router) app for splitting one receipt at a time among people, with state in three Zustand stores (`billStore`, `currencyStore`, `billHistoryStore`) persisted to localStorage as untyped JS objects, no runtime validation anywhere (including on the external receipt-OCR worker's response), and no way to collaborate live with the people you're splitting with. The user wants a major v3 that:

- Puts the codebase on solid footing (TypeScript + Zod) before adding features, so the bigger data-model and networking changes that follow aren't built on unvalidated `any`-typed JS.
- Reframes the core unit from "one bill" to "a session that can hold multiple bills," with a shared people pool, per-bill "who paid" tracking, and a net settlement across the whole session — while staying fully usable offline exactly as today.
- Adds an optional live-collaboration layer (a Go/SQLite backend) so a session can be shared with friends in real time via a short code/link, with configurable join-approval and item-claim rules.
- Adds React Router so sessions, bills, and live-join links are real, shareable, bookmarkable URLs instead of only living in component state.

This is staged as three independently shippable phases so the app stays working and tested at every phase boundary, rather than one long non-shippable rewrite.

Confirmed design decisions:
- **People are a shared pool per session** (not per-bill) — every bill in a session references the same person IDs. This is required for clean cross-bill settlement math and matches the "joiner picks from existing pool or adds themselves" requirement.
- **Route shape**: `/session/:sessionId` (session home), `/session/:sessionId/bill/:billId` (bill editor, replaces today's step 1-4 flow for one bill), `/session/:sessionId/settlement` (net who-owes-who view), `/join/:code` (live-join entry point for joiners).

---

## Phase 1 — TypeScript + Zod migration (no feature change)

Goal: same app, same behavior, fully typed, with Zod validating every boundary that touches untrusted/persisted data. Everything below keeps `npm run build`, `npm test`, `npm run lint` green after each step — no big-bang flip.

### 1.1 Tooling, in this order
1. Install `typescript`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `zod`, `@babel/preset-typescript`.
2. Add `tsconfig.json`: `allowJs: true`, `strict: true` (with `noUncheckedIndexedAccess: false` initially — revisit post-Phase-1), `checkJs: false`, `target: ES2022`, `moduleResolution: Bundler`, `jsx: react-jsx`, `paths` mirroring the existing Vite aliases (`src/*`, `components/*` → `src/Components/*`, `ui/*` → `src/ui/*`).
3. Fix the existing alias gap in `jest.config.js`: add matching `moduleNameMapper` entries (`^src/(.*)$`, `^components/(.*)$`, `^ui/(.*)$`) and `moduleFileExtensions` including `ts`/`tsx`. `babel-jest` already matches `.ts`/`.tsx` in its transform regex — just add the TS preset to the babel config.
4. Extend `eslint.config.js` globs to `**/*.{js,jsx,ts,tsx}`, add `typescript-eslint` recommended rules scoped to `**/*.{ts,tsx}`.
5. Add `"typecheck": "tsc --noEmit"` to `package.json` scripts — run manually/in CI throughout the migration to track progress; Vite build stays on esbuild transpilation (no build-time type-checking, consistent with `allowJs`).

### 1.2 New directories
- `src/schemas/` — Zod schemas, one file per domain (`bill.schema.ts`, `billHistory.schema.ts`, `receiptScan.schema.ts`, `currency.schema.ts`, `index.ts` barrel). **Schemas are the source of truth**; types are derived via `z.infer`, not hand-duplicated.
- `src/types/` — only for shapes that aren't validated data (component prop types, action signatures) plus barrel re-exports of the `z.infer` types.

### 1.3 Migration order (dependency-first)
1. **Zod schemas first** (pure, no React deps, unit-testable in isolation):
   - `bill.schema.ts`: `PersonSchema`, `ItemSchema`, and the key pattern for `consumedBy` — a union of the legacy bare-string personId shape and the current `{personId, value}` object shape, with a `.transform()` that normalizes both into the canonical object shape at parse time:
     ```
     ConsumedByEntrySchema = z.union([z.string(), z.object({personId: z.string(), value: z.number()})])
       .transform(v => typeof v === 'string' ? {personId: v, value: 1} : v)
     ```
     Every downstream reader only ever sees the normalized object shape after this.
   - `receiptScan.schema.ts`: validates the Cloudflare Worker's response (`{items:[{name,price,quantity,discount?}], tax?}`) before it reaches `billStore` — today this has zero validation, the single highest-value place to start.
   - `billHistory.schema.ts`, `currency.schema.ts` — permissive with `.default()`/`.optional()` so real existing localStorage data parses.
   - Write `src/schemas/*.test.ts` covering: legacy string `consumedBy` normalization, malformed worker responses rejected cleanly, malformed persisted blobs falling back gracefully via `.safeParse()`.
2. **Leaf utility modules**: `src/ThemeContext.jsx` → `.tsx`, `src/ui/components.jsx` → `.tsx` (typing `Button`/`Input`/`Modal`/etc. once eliminates prop drift across ~15+ call sites).
3. **Stores, bottom-up** (matches actual dependency graph):
   - `currencyStore.js` → `.ts` (standalone).
   - `billStore.js` → `.ts`: state typed as `z.infer<typeof BillStateSchema>`; every getter (`getPersonTotals`, `getSubtotal`, `getGrandTotal`, `getItemSplitDetails`, `validateAllocations`, `normalizeAllocations`) gets an explicit return type defined once and reused by consuming components. Wire the `persist` middleware's hydration path to run incoming localStorage data through `BillStateSchema.safeParse`, falling back to `initialState` on failure instead of crashing.
   - `billHistoryStore.js` → `.ts` using `billHistory.schema.ts`.
   - `src/Components/PassAndSplit/stores/passAndSplitStore.js` → `.ts` (depends on billStore types). **Keep its existing string-vs-object `consumedBy` defensive check in place through Phase 1** — mark with a `// TODO(phase2): remove once all state is schema-normalized on load` comment rather than deleting it as a side effect of typing.
   - `billStore.test.js` → `.test.ts` last in this group, to catch type-level regressions.
4. **Components**, leaf-to-root by import graph: small presentational pieces first (`EditableTitle`, `EditPersonModal`, `FractionalSplitInput`, `PercentageSplitInput`, `BillTotalsSummary`, `SplitTypeDrawer`, `EditItemModal`, `ThemeSwitcher`), then `Sidebar/`, `PassAndSplit/` subtree (after its store is converted), `ScanReceiptButton.jsx` → `.tsx` (wire `ReceiptScanResponseSchema.parse()` onto the fetch response here), then the four step screens (`PeopleInput`, `ItemsInput`, `ItemAssignment`, `BillSummary`) + `Settings.jsx` + `BillHistory/`, finally `App.jsx` and `main.jsx` → `.tsx`.

### 1.4 Strictness
`strict: true` from day one (codebase is small enough — ~40 files — that fixing strict errors during conversion beats a second cleanup pass later). Only exception: `noUncheckedIndexedAccess: false` initially. `.js`/`.jsx` files not yet converted stay under `allowJs`/`checkJs: false` so `tsc --noEmit` is runnable throughout, not just at the end.

### 1.5 Phase 1 acceptance checklist
- [ ] `npm run typecheck` passes with zero errors, no `.js`/`.jsx` remaining
- [ ] `npm run lint` and `npm test` pass; `billStore.test.ts` behavior unchanged, only types added
- [ ] New Zod tests pass for legacy `consumedBy` normalization, malformed receipt-scan rejection, malformed persisted-blob fallback
- [ ] Manual smoke test: all 4 steps, PassAndSplit, Scan, History, Export/Import all behave identically to pre-migration
- [ ] No `any` outside a small, documented allowlist

---

## Phase 2 — Sessions/multi-bill offline model, paid-by/settlement, React Router

Goal: still fully offline/local-only, but the top-level unit becomes a **Session** containing a shared people pool and multiple **Bills**, each with a "paid by" person and a settlement view across the whole session. Real URLs replace the step-only navigation.

### 2.1 New store: `src/sessionStore.ts` (replaces `billHistoryStore.ts`, persisted key `billSplitterSession`, version `2.0.0`)
```
Session = { id, title, createdAt, updatedAt, people: Person[], bills: Bill[], currentBillId, isLive: boolean }
Bill = { id, title, date, items: Item[], taxAmount, currency, paidByPersonId: string|null,
         receiptImage: {refKey, width, height} | null, splitStateVersion }
```
`Session.people` is the shared pool; every `Bill.items[].consumedBy[].personId` references `Session.people[].id`. Mirrored exactly in `src/schemas/session.schema.ts`, reusing `ItemSchema`/`PersonSchema` from Phase 1's `bill.schema.ts` (no duplication).

### 2.2 Reconciling with today's step flow + wiring React Router
- Install `react-router-dom`. Routes:
  - `/session/:sessionId` — **Session Home**: list of bills, "Add Bill", "Go Live" button (wired but disabled/hidden until Phase 3), link to Settlement.
  - `/session/:sessionId/bill/:billId` — today's step 1-4 flow, now scoped to editing one bill within the session (step 1 = shared people editor, operating on `sessionStore.people`, not a per-bill list).
  - `/session/:sessionId/settlement` — net who-owes-who view.
  - `/join/:code` — placeholder route wired now, functional in Phase 3.
- `billStore.ts` stops being independently persisted; it becomes a thin **non-persisted scratch editor** hydrated from `sessionStore.getBill(sessionId, billId)` on route entry and written back via a `commitToSession()` call on mutating actions — the same "secondary store synced against a primary store's `getState()`" pattern already proven by `passAndSplitStore`, just one layer up.
- `App.jsx`'s step-only switch is replaced by the router; the existing 4 step components stay largely as-is internally, just re-scoped as "editing bill N."

### 2.3 Migration for existing localStorage users
New `src/migrations/toSessionStore.ts`, run once on boot (keyed off absence of the `billSplitterSession` key):
1. Read raw old `billHistory` and `billSplitter` keys directly, validate with the **old** (Phase-1) schemas kept around under `src/schemas/legacy/`.
2. Each old `billHistoryStore` entry → one new `Session` containing exactly one `Bill` (old data has no multi-bill grouping); if an unsaved active `billStore` blob exists separately, wrap it as one more standalone session.
3. Write result into the new `sessionStore` key; leave old keys untouched (cheap safety net); set `migratedFromV1: true` so migration doesn't re-run.
4. Unit test against fixture blobs matching the real old shapes.

### 2.4 Paid-by + settlement algorithm — `src/lib/settlement.ts`
Pure, framework-free module (extract the per-person total calculation out of `billStore`'s `getPersonTotals()` into a shared pure function first, e.g. `src/lib/personTotals.ts`, so `billStore` and `settlement.ts` share one implementation instead of duplicating discount/tax/allocation math).

1. **Per-bill per-person totals** via the shared pure function.
2. **Net balance per person across the session**: for each bill, `balance[p] += (p === bill.paidByPersonId ? billTotal - personShare[p] : -personShare[p])`. A bill with `paidByPersonId: null` contributes nothing to balances (documented, deliberate — no payer means no settlement claim from that bill).
3. **Greedy debt-simplification settlement**: split into creditors (balance > 0) / debtors (balance < 0), repeatedly match largest creditor against largest debtor, settle `min(|amounts|)`, record `{from, to, amount}`, repeat to zero (epsilon `1e-6` for float rounding, matching `billStore`'s existing rounding convention). Document explicitly that this greedy approach is the standard practical approximation (not always the true minimum transaction count, which is NP-hard) — same approach Splitwise-style apps use.
4. Output: `{balances: {personId, amount}[], transactions: {from, to, amount}[]}`, rendered by a new `SessionSettlement.jsx` at the `/session/:id/settlement` route.
5. Exhaustive unit tests in `src/lib/settlement.test.ts`: single bill/single payer, multiple bills/same payer, multiple bills/different payers with overlapping people, a person absent from some bills, zero-sum invariant (`sum(balances) === 0` always), rounding edge cases, null-payer bill treatment.

### 2.5 Receipt image capture (client-side; Phase 3 adds server sync on top)
`src/lib/imageResize.ts`: `resizeImageToDataUrl(file, maxWidth=1920, maxHeight=1080)` via offscreen canvas, scaling by `Math.min(maxW/naturalW, maxH/naturalH, 1)` (never upscale), aspect-preserved, JPEG q0.85. Runs **after** the existing full-resolution OCR call in `ScanReceiptButton.jsx` (so scanning fidelity isn't affected), storing only the resized copy.

**Storage**: given dataURL sizes (~200-500KB per image at this resolution) risk blowing localStorage's ~5-10MB quota once a session has many bills, store image bytes in **IndexedDB** (via the `idb` package) keyed by `Bill.receiptImage.refKey`, with `sessionStore`'s persisted JSON holding only the reference/metadata — not the bytes. This also sets up Phase 3 cleanly: "sync to server" becomes "upload the IndexedDB blob for this refKey," not "extract a giant dataURL from the JSON state tree."

### 2.6 Phase 2 acceptance checklist
- [ ] Existing 4-step flow fully functional at `/session/:id/bill/:billId`, operating against `sessionStore`
- [ ] Multi-bill session: 2+ bills, each independently editable, shared people pool correct across all of them
- [ ] `paidByPersonId` settable per bill via UI; settlement view at `/session/:id/settlement` shows correct net who-owes-who for 3+ bills with different payers, verified against a hand-computed fixture
- [ ] `settlement.ts` tests pass including the zero-sum invariant
- [ ] Migration from real exported old-format data (via existing `exportBills()`/`exportBill()`) verified end-to-end
- [ ] Receipt image capture round-trips (scan → resize → IndexedDB → re-displayed)
- [ ] Deep links work: sharing a `/session/:id/bill/:billId` URL loads directly into that bill; browser back/forward behaves correctly across the step flow
- [ ] Export/import JSON updated to session shape with version tagging so old-era exports are distinguishable on import

---

## Phase 3 — Go backend + live collaboration

Goal: an optional live layer on top of the still-fully-functional offline app — "Go Live" seeds a server-side mirror of the current session, joiners interact through the Go API, and creator/joiner clients converge via SSE (falling back to polling).

### 3.1 Project layout — new top-level `/server` directory
```
/server
  cmd/server/main.go
  internal/
    config/                # ALLOWED_ORIGINS, DB path, image dir, port — env-driven
    db/migrations/0001_init.sql
    models/                # Session, Bill, Person, Item, Joiner, Approval, ImageMeta structs
    middleware/allowlist.go, logging.go
    api/session_handlers.go, bill_handlers.go, item_handlers.go, sse_handlers.go, image_handlers.go, admin_handlers.go, router.go
    sse/hub.go             # per-session-code broadcast registry
    cleanup/job.go         # ticker-based 48h purge
    settlement/settlement.go  # Go port of src/lib/settlement.ts's algorithm
  go.mod
```

### 3.2 Dependencies
- Router: stdlib `net/http` (Go 1.22+ method+path-aware `ServeMux`) — sufficient for this route count, no extra dependency.
- SQLite driver: `modernc.org/sqlite` (pure-Go, no CGO) over `mattn/go-sqlite3` — trivial cross-compilation/deploy, no C toolchain requirement; performance difference is irrelevant at this scale.
- `crypto/rand` (stdlib) for 5-char session codes and 2-digit approval codes — no extra dependency.
- No ORM — hand-written SQL via `database/sql`, schema is small (7 tables) and this keeps it transparent.

### 3.3 SQLite schema
`sessions` (id 5-char PK, title, timestamps, `is_settled`, `settled_at`, `join_mode` enum `approval_code|open_link`, `claim_mode` enum `free_select|claims_require_approval`), `people`, `bills` (incl. `paid_by_person_id`), `items`, **`item_allocations`** (one row per `{item, person}` — normalized instead of a JSON array column, specifically so concurrent joiner claims are row-level inserts rather than read-modify-write races on a JSON blob), `joiners` (status `pending|approved|disapproved`, `approval_code`), `item_claims` (only used in `claims_require_approval` mode), `images` (file_path, dims). `PRAGMA foreign_keys = ON` at connection open for cascading deletes during cleanup.

### 3.4 Allowlist middleware
Reads `ALLOWED_ORIGINS` at startup; always permits `localhost`/`127.0.0.1` (dev convenience, mirrors the existing dev/prod split already used for `VITE_WORKER_URL`), exact-matches everything else against the configured list, 403 otherwise. Wraps every route except `/healthz`.

### 3.5 Go-Live API surface
- `POST /api/sessions` → `{code, link}`. Seeds server state from the creator's current local session (`title`, `people`, `joinMode`, `claimMode`). Returns a creator token (required as `X-Creator-Token` header on all creator-only mutating endpoints — approve/disapprove, settle, purge).
- `GET /api/sessions/{code}` — full session state for both creator and admitted joiners.
- `POST /api/sessions/{code}/join` — `{name?, existingPersonId?}` (pick existing or add self, per spec). Branches on `join_mode`:
  - `approval_code`: creates `pending` joiner + 2-digit code shown to the joiner ("tell the host: 42"); SSE-pushes the pending entry to the creator.
  - `open_link`: auto-`approved`; still SSE-pushed to the creator's approvals page for visibility.
- `POST /api/sessions/{code}/joiners/{id}/approve|disapprove` — creator-only.
- `POST /api/sessions/{code}/bills`, `.../bills/{id}/items` — add bill/item within a live session (joiner or creator).
- `POST /api/sessions/{code}/bills/{billId}/items/{itemId}/claims` — `free_select` writes an `item_allocations` row directly (auto-approved, insert-only so concurrent claims never conflict); `claims_require_approval` writes a pending `item_claims` row, SSE-pushed to the creator, resolved via `.../claims/{id}/approve`.
- `POST /api/sessions/{code}/settle` — `is_settled=1`, starts the 48h-from-settlement purge clock.
- `GET /api/sessions/{code}/settlement` — server-computed net who-owes-who (so all joiners see identical, server-arbitrated numbers, not a client's local computation).

### 3.6 SSE + polling fallback
`GET /api/sessions/{code}/events` (SSE), per-session-code subscriber registry in `internal/sse/hub.go`. Small, entity-id-only event payloads (`joiner.pending`, `joiner.approved`, `claim.pending`, `claim.approved`, `item.updated`, `bill.updated`, `session.settled`) — client refetches the named resource rather than receiving full state over the wire.

Client (`src/lib/liveSync.ts`, Phase 3 frontend work): `EventSource` if available; falls back to a 3-5s `setInterval` poll of `GET /api/sessions/{code}` after `EventSource` is undefined or 3 consecutive reconnect failures within 30s. Surfaces a "live / reconnecting / polling" indicator rather than failing silently.

### 3.7 Settlement logic — no cross-language sharing
The algorithm (2.4) is reimplemented in `internal/settlement/settlement.go`, not shared via any TS/Go bridge. The spec (2.4 steps 1-3) is the single source of truth in a doc comment referenced by both; the **same test fixtures** are mirrored in `settlement.test.ts` and `settlement_test.go` so drift between implementations is caught by tests.

### 3.8 48h cleanup job
`time.Ticker` (30-60 min interval — no need for minute precision on a 48h window) running:
```sql
DELETE FROM sessions
WHERE (is_settled = 1 AND settled_at <= datetime('now','-48 hours'))
   OR (is_settled = 0 AND last_access_at <= datetime('now','-48 hours'));
```
Image files for about-to-be-purged sessions are read and `os.Remove`'d *before* the cascading SQL delete (so a mid-cleanup crash leaves row+file both intact for the next tick, never an orphaned file). `last_access_at` bumped by lightweight middleware on every request to a session's routes (reads included, not just writes) so idle-but-viewed sessions correctly extend their lifetime.

### 3.9 Admin panel
Server-rendered `html/template` pages (not a separate React app — the feature set is small and internal-only): `GET /admin` (session list: created/last-access/settled + per-row purge button), `GET /admin/stats` (session counts, avg bills/session, on-disk image size). Gated by the allowlist middleware plus a separate static bearer-token/password from config.

### 3.10 Frontend sync strategy (no offline regression)
`sessionStore.ts` gains `isLive`/`liveCode`. Going live does **not** flip the app to "server authoritative" — the creator's own Zustand actions stay optimistic/local-first exactly as offline mode, with a fire-and-forget API call alongside each mutation (failure → toast + retry flag, not a blocking round-trip). SSE/poll-driven updates merge **by entity id**, never wholesale-replace local state, so a creator's in-flight edits to unrelated fields survive. Joiners are lightweight — no local `sessionStore` persistence of their own, just a `joinerId` token in their browser's localStorage so a refresh doesn't lose their place. A session that never goes live makes zero network calls beyond the existing OCR worker — full offline-first guarantee preserved.

Wire `/join/:code` (the Phase 2 placeholder route) to the actual join flow now: enter name or pick from the existing people list, submit, show pending-approval state (with the 2-digit code) or immediate admission depending on `join_mode`.

### 3.11 Phase 3 acceptance checklist
- [ ] `/server` builds/runs standalone; SQLite + migrations apply cleanly
- [ ] Allowlist verified: localhost always passes, unconfigured origin 403s, configured domain passes
- [ ] Go-Live end-to-end in both `approval_code` and `open_link` modes, including the creator's approvals page
- [ ] `free_select` vs `claims_require_approval` both function per spec, verified for concurrent-claim safety (two joiners claiming the same item doesn't lose either claim)
- [ ] SSE→polling fallback verified against a simulated dropped connection
- [ ] Go and TS settlement implementations agree on shared test fixtures
- [ ] 48h cleanup purges a backdated session (DB rows + image files) correctly
- [ ] Admin panel: list, purge, stats all functional
- [ ] Fully offline mode (never clicking "Go Live") shows zero behavioral regression from end of Phase 2

---

## Cross-cutting testing strategy
- **Phase 1**: Zod schema tests (parse/reject/transform) are the new highest-value coverage; `billStore.test.ts` behavior stays unchanged.
- **Phase 2**: `settlement.ts` gets the most exhaustive suite in the project (pure, deterministic, financially load-bearing) — zero-sum invariant checked explicitly. Migration tested against real captured localStorage fixtures.
- **Phase 3**: Go `_test.go` coverage for `internal/settlement`, `internal/cleanup` (temp-file SQLite), `internal/middleware`; an `httptest.Server`-based integration test for the join/approve/claim flow; `liveSync.ts` fallback logic unit-tested with a mocked `EventSource`.

## Critical files
- `src/billStore.js` — core data model/getters; typed in Phase 1, split into a shared pure-calc module + thin scratch editor in Phase 2
- `src/billHistoryStore.js` — direct template for `sessionStore.ts`'s persisted multi-entity shape
- `src/Components/PassAndSplit/stores/passAndSplitStore.js` — precedent for the secondary-store-synced-to-primary pattern reused for `billStore`↔`sessionStore`; also carries the EQUAL-reset data-loss bug to address during its Phase 1 conversion
- `src/Components/ScanReceiptButton.jsx` — first Zod integration point (Phase 1) and image-resize integration point (Phase 2)
- `jest.config.js`, `vite.config.js` — path-alias reconciliation required before Phase 1 TS conversion proceeds
- `src/App.jsx` — step-only switch replaced by React Router in Phase 2

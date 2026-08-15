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

### Phase 3 — Go backend + live collaboration
- [ ] `/server` Go project scaffold (stdlib router, `modernc.org/sqlite`)
- [ ] SQLite schema (sessions, bills, people, items, item_allocations, joiners, item_claims, images)
- [ ] Localhost + domain allowlist middleware
- [ ] Go-Live API: create session, join (approval-code / open-link modes), approve/disapprove, bills/items/claims endpoints, settle
- [ ] SSE endpoint + polling fallback (client-side `liveSync.ts`)
- [ ] 48h cleanup job (ticker-based, purges DB rows + image files)
- [ ] Admin panel (server-rendered `html/template`: session list, purge, stats)
- [ ] Frontend sync strategy: optimistic local writes, entity-id-based merge on SSE/poll events, `/join/:code` wired to the real join flow
- [ ] Go settlement port (`internal/settlement`) mirroring `src/lib/settlement.ts`'s test fixtures

## Reference
- Full phased plan: `planv3.md` (repo root)
- Branch: `feature/v3Major`

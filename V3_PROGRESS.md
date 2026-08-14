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

**⚠️ Not yet manually verified in a live browser** — the sandboxed browser tool used in this session can reach external sites but not `localhost` at all (confirmed across dev server, HMR, and production preview build, on multiple ports), so the new routing/hydration flow has only been verified via types, tests, and manual code review, not an actual click-through. **Recommend manually testing before trusting this in production**: root redirect creates/loads a session, session home lists bills and adds new ones, bill editor's 4 steps work and commit back to the session (switch bills, come back, edits persist), settlement view shows correct balances, sessions list create/delete/export/import, paid-by selector, receipt image capture/display, and browser back/forward across routes. Also worth testing the migration path with real pre-v3 exported data if any exists.

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

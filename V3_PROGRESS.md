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

## Todo

### Phase 2 — Sessions/multi-bill offline model, paid-by/settlement, React Router
- [ ] `sessionStore.ts` replacing `billHistoryStore.ts` (shared people pool per session, multiple bills)
- [ ] `session.schema.ts` Zod schema
- [ ] React Router: `/session/:sessionId`, `/session/:sessionId/bill/:billId`, `/session/:sessionId/settlement`, `/join/:code` (placeholder)
- [ ] Rescope `billStore.ts` into a non-persisted "scratch" editor synced against `sessionStore`
- [ ] Migration path from old `billHistory`/`billStore` localStorage shapes into `sessionStore`
- [ ] `paidByPersonId` field + UI control per bill
- [ ] `src/lib/settlement.ts` — net balance + greedy debt-simplification algorithm, with exhaustive tests
- [ ] Receipt image capture/resize (1920x1080 max) via IndexedDB, referenced from `Bill.receiptImage`
- [ ] Export/import JSON updated to session shape with version tagging

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

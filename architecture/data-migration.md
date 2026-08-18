# Data Migration

## Summary
One-time migration of the pre-v3 localStorage shape (plain JS, no
`sessionStore`/`billStore` split) into the current `sessionStore` shape. Runs
once on app boot.

## Frontend
- `src/migrations/toSessionStore.ts` — migrates the pre-v3 `billSplitter`
  and `billHistory` localStorage keys (via the legacy schemas below) into
  `sessionStore`; `runMigrationIfNeeded()` is called once from `main.tsx`
  before anything else reads the store.
- `src/schemas/legacy/billStoreV1.schema.ts` — frozen pre-v3 `billSplitter` localStorage shape.
- `src/schemas/legacy/billHistoryV1.schema.ts` — frozen pre-v3 `billHistory` localStorage shape.
- `src/schemas/billHistory.schema.ts` — legacy-adjacent bill-history entry shape (wraps a full `BillStateSchema` snapshot + `billId`).

## Backend
None.

## Related features
- [app-shell-navigation.md](app-shell-navigation.md) — invoked from `main.tsx` before app mount.

## Notes
- `AGENTS.md` in the repo root is a pre-v3 snapshot (JavaScript, no routing,
  no server, no live collaboration) — stale, kept only as historical
  reference for what this migration is converting *from*. Do not treat it as
  current.
- The legacy schemas are intentionally frozen — don't evolve them to match
  current shapes; they exist only to parse old data one time.

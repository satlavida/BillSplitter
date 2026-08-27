# Settlement

## Summary
Computes who owes whom and by how much across a session's bills, and
simplifies that into a minimal-ish set of payment transactions. Runs both
locally (offline use) and on the server (for live sessions, so every device
sees the same numbers).

## Frontend
- `src/Pages/SessionSettlementPage.tsx` — route `/session/:sessionId/settlement`; who-owes-who view, per-bill totals list, receipt image viewer modal, Basic/Detailed toggle (Detailed adds each bill's own `calculateBillBalances` breakdown via `BillBreakdown`, e.g. "Bob owes Alice ₹500").
- `src/lib/settlement.ts` — debt-simplification/settlement calculation, built on `personTotals.ts`. `calculateBalances` (session-wide) is `calculateBillBalances` (single bill) summed over every bill — a pure decomposition, not a behavior change, so it didn't need mirroring into the Go package (see Notes).
- `src/lib/personTotals.ts` — core per-person total calculation (discounts, splits); shared by `billStore` ([bill-editing.md](bill-editing.md)) and `settlement.ts`.
- `src/Components/joiner/JoinerSettlementSummary.tsx` — personal-view settlement lines for a joiner ([live-collaboration.md](live-collaboration.md)).
- Settle action UI lives in `src/Components/LiveSessionPanel.tsx`.

## Backend
- `server/internal/api/settlement.go` — thin wrapper, `computeSettlement(sess)` calls into the settlement package.
- `server/internal/settlement/settlement.go` — `CalculateBalances` (per-bill payer/consumer net balance), `SimplifyDebts` (greedy largest-creditor-vs-largest-debtor matching), `CalculateSettlement` (combines both).
- `server/internal/settlement/personTotals.go` — `calculatePersonTotals`, per-person subtotal/tax/total given items' `ConsumedBy` allocations and split type.
- Route: `GET /api/sessions/{code}/settlement` (registered in `bill_handlers.go`, see [live-collaboration.md](live-collaboration.md)).

## Related features
- [bill-editing.md](bill-editing.md) — shares the `personTotals` calculation.
- [live-collaboration.md](live-collaboration.md) — server-side settlement is only reachable for live sessions.

## Notes
- **The Go settlement package is a hand-mirrored port of the frontend's
  `src/lib/settlement.ts` / `src/lib/personTotals.ts`** — same test
  fixtures are used on both sides (`settlement_test.go` mirrors
  `settlement.test.ts`) specifically to prevent drift. If you change the
  splitting/settlement algorithm on one side, change it on the other and
  update both test fixtures in the same commit. `calculateBillBalances`
  (the per-bill decomposition backing the Detailed view) only rearranges
  the frontend's own math into a reusable, purely-frontend-UI function; the
  actual algorithm didn't change, so no Go-side change was needed for it.
- `SimplifyDebts` is greedy (largest creditor vs largest debtor), not
  guaranteed to produce the theoretical minimum number of transactions —
  this was a deliberate simplicity-over-optimality tradeoff, not an
  oversight.

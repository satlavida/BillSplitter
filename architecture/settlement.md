# Settlement

## Summary
Computes who owes whom and by how much across a session's bills, and
simplifies that into a minimal-ish set of payment transactions. Runs both
locally (offline use) and on the server (for live sessions, so every device
sees the same numbers). Always computed and displayed in the session's own
currency ([currency.md](currency.md)) — each bill's amounts are converted
using that bill's effective exchange rate before being summed.

## Frontend
- `src/Pages/SessionSettlementPage.tsx` — route `/session/:sessionId/settlement`; who-owes-who view, per-bill totals list, receipt image viewer modal, Basic/Detailed toggle (Detailed adds each bill's own `calculateBillBalances` breakdown via `BillBreakdown`, e.g. "Bob owes Alice ₹500"). "Print Summary PDF" (creator-only — this page has no joiner-facing route) forces Detailed mode then calls `window.print()`; the whole settlement section is wrapped in `PrintWrapper`/`#printable-settlement` (same technique as `BillSummary.tsx` — reuses the on-screen DOM for print rather than a separate print-only component, which would otherwise duplicate text nodes on screen). Formats every amount via `formatAmountInCurrency(amount, session.currency)` ([currency.md](currency.md)) rather than the global currency preference — this page is always in session currency, never the viewer's own default.
- `src/lib/settlement.ts` — debt-simplification/settlement calculation, built on `personTotals.ts`. `calculateBalances(bills, people, sessionCurrency)` (session-wide) is `calculateBillBalances` (single bill, still in that bill's own currency) summed over every bill, each bill's contribution multiplied by `getEffectiveRate(bill, sessionCurrency)` first — 1 if the bill matches session currency, else `bill.exchangeRate` (falling back to 1, not throwing, if unset).
- `src/lib/personTotals.ts` — core per-person total calculation (discounts, splits); shared by `billStore` ([bill-editing.md](bill-editing.md)) and `settlement.ts`.
- `src/Components/joiner/JoinerSettlementSummary.tsx` — personal-view settlement lines for a joiner ([live-collaboration.md](live-collaboration.md)).
- Settle action UI lives in `src/Components/LiveSessionPanel.tsx`.

## Backend
- `server/internal/api/settlement.go` — thin wrapper, `computeSettlement(sess)` calls into the settlement package, passing `sess.Currency` as `sessionCurrency`.
- `server/internal/settlement/settlement.go` — `CalculateBalances(bills, people, sessionCurrency)` (per-bill payer/consumer net balance, converted into `sessionCurrency` per bill — same effective-rate logic as the frontend), `SimplifyDebts` (greedy largest-creditor-vs-largest-debtor matching), `CalculateSettlement` (combines both).
- `server/internal/settlement/personTotals.go` — `calculatePersonTotals`, per-person subtotal/tax/total given items' `ConsumedBy` allocations and split type.
- Route: `GET /api/sessions/{code}/settlement` (registered in `bill_handlers.go`, see [live-collaboration.md](live-collaboration.md)).

## Related features
- [bill-editing.md](bill-editing.md) — shares the `personTotals` calculation.
- [live-collaboration.md](live-collaboration.md) — server-side settlement is only reachable for live sessions.
- [currency.md](currency.md) — session/bill currency fields and exchange rates that this feature converts by.

## Notes
- **The Go settlement package is a hand-mirrored port of the frontend's
  `src/lib/settlement.ts` / `src/lib/personTotals.ts`** — same test
  fixtures are used on both sides (`settlement_test.go` mirrors
  `settlement.test.ts`) specifically to prevent drift. If you change the
  splitting/settlement algorithm **or the currency-conversion logic** on one
  side, change it on the other and update both test fixtures in the same
  commit. `calculateBillBalances` (the per-bill decomposition backing the
  Detailed view) only rearranges the frontend's own math into a reusable,
  purely-frontend-UI function; the actual algorithm didn't change, so no
  Go-side change was needed for it.
- `getEffectiveRate(bill, sessionCurrency)` (frontend, exported from
  `settlement.ts`) is the single place that decides "1, or bill.exchangeRate,
  or fall back to 1" — `SessionSettlementPage.tsx`'s Bills list and
  `BillBreakdown` reuse it directly rather than re-deriving the same
  fallback logic, so there's one behavior to keep in sync with the Go side.
- `SimplifyDebts` is greedy (largest creditor vs largest debtor), not
  guaranteed to produce the theoretical minimum number of transactions —
  this was a deliberate simplicity-over-optimality tradeoff, not an
  oversight.

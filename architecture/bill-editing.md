# Bill Editing

## Summary
The core 3-step wizard (Items → Assign → Summary) for building a single
bill: add line items (optionally via receipt scan), assign items/splits to
people, then view per-person totals. People are no longer edited per-bill —
they're session-scoped (see [session-management.md](session-management.md)'s
`PeopleSection`) and only read here for splitting/display. Backed by a
non-persisted scratch store hydrated from the session on entry.

## Frontend
- `src/Pages/BillEditorPage.tsx` — route `/session/:sessionId/bill/:billId/step/:step`; hydrates `billStore` from `sessionStore` on entry, subscribes to commit changes back, drives live-sync polling.
- `src/Components/StepIndicator.tsx` — step nav header.
- `src/Components/ItemsInput.tsx` — Step 1, Items; embeds `ScanReceiptButton`, `EditableTitle` (bill title, "This bill is for:"), `EditItemModal`, `BillTotalsSummary`.
- `src/Components/ItemAssignment.tsx` — Step 2, Assign; embeds `SplitTypeDrawer`, `PassAndSplitButton`.
- `src/Components/BillSummary.tsx` — Step 3, Summary; per-person totals, share text, print.
- `src/Components/EditItemModal.tsx` — add/edit item modal.
- `src/Components/SplitTypeDrawer.tsx` — equal/percentage/fraction split chooser.
- `src/Components/PercentageSplitInput.tsx`, `src/Components/FractionalSplitInput.tsx` — split-type input widgets.
- `src/Components/BillTotalsSummary.tsx` — subtotal/tax/total display (shared with Summary step).
- `src/Components/EditableTitle.tsx` — inline-editable bill/session title.
- `src/Components/ImageLightbox.tsx` — click-to-view full-size image modal (built on `Modal`), used by `ReceiptImagePreview` in `BillSummary.tsx` and by `JoinerBillList.tsx` ([live-collaboration.md](live-collaboration.md)).
- `src/Components/PeopleListShared.tsx` — presentational `PersonInputForm`/`PeopleList`, shared with session-level people UI.
- `src/billStore.ts` — non-persisted scratch editor for the currently-open bill. Not the source of truth; writes from outside `BillEditorPage` must go to `sessionStore` (see root `CLAUDE.md`). Also holds `currency`/`exchangeRate`/`exchangeRateDate`/`exchangeRateIsOverride`, written by `BillSettingsModal.tsx` (see [currency.md](currency.md)) rather than any wizard step.
- `src/Components/BillSettingsModal.tsx` — gear icon top-right of `BillEditorPage.tsx`; bill currency + transaction-date + exchange-rate override UI ([currency.md](currency.md)). `ItemsInput`/`ItemAssignment`/`BillSummary` all format amounts via the open bill's own `currency` (`formatAmountInCurrency`, `src/lib/currencyDisplay.ts`), not the global currency preference.
- `src/lib/personTotals.ts` — per-person total calculation (discounts, splits).
- `src/lib/splitSummary.ts` — shareable plain-text summary generation.
- `src/schemas/bill.schema.ts` — `Person`, `Item`, `SplitType`, `DiscountType`.

## Backend
None directly — bill edits made offline stay local. When a session is live,
edits are pushed via `sessionStore.ts`'s `pushBillFieldsLive`/etc. to the
routes documented in [live-collaboration.md](live-collaboration.md).

## Related features
- [pass-and-split.md](pass-and-split.md) — alternate assignment flow launched from Step 2.
- [scan-receipt.md](scan-receipt.md) — populates Step 1 items from a photo.
- [live-collaboration.md](live-collaboration.md) — pushes local edits to the server when the session is live.
- [settlement.md](settlement.md) — shares `personTotals.ts` logic.
- [currency.md](currency.md) — per-bill currency/exchange-rate fields, set from this page's gear icon.

## Notes
- Print (`BillSummary.tsx`'s Print button): `PrintWrapper` (`src/ui/components.tsx`)
  is the single source of truth for `@media print` rules — a duplicate,
  competing block used to live in `src/App.css` (different technique:
  `display:none` vs `PrintWrapper`'s `visibility:hidden/visible`), which
  raced depending on stylesheet/DOM insertion order and was the likely
  cause of inconsistent/blank print output; removed. The scanned receipt
  image (`ReceiptImagePreview`) now renders inside `#printable-bill` (was
  previously in a separate `no-print`-wrapped section entirely outside
  `PrintWrapper`'s `.print-content`, so it never printed at all).
- `billStore` is a scratch/derived store, not persisted — see the
  `CLAUDE.md` warning about writing to it from outside `BillEditorPage`
  (only safe if `useBillStore.getState().billId === billId`).
- Zod `.default()` only applies during `.parse()`, not to hand-built object
  literals typed as `Bill` — every field must be present when constructing
  one directly (see `src/migrations/toSessionStore.ts` and test fixtures).
- `BillSummary.tsx` no longer has a bill-level "Add/Edit UPI ID" section
  (removed 2026-08-29 — local-only `upiId` state, never persisted to
  `sessionStore`/the server). `PersonCard`'s share text no longer includes
  a UPI line. Per-person UPI ID is a planned future feature (see
  `changes/20260829_UIUXEnhance.md`), not yet implemented.

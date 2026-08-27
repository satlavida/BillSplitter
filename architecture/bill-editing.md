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
- `src/Components/ItemsInput.tsx` — Step 1, Items; embeds `ScanReceiptButton`, `EditItemModal`, `BillTotalsSummary`.
- `src/Components/ItemAssignment.tsx` — Step 2, Assign; embeds `SplitTypeDrawer`, `PassAndSplitButton`.
- `src/Components/BillSummary.tsx` — Step 3, Summary; per-person totals, share text, print.
- `src/Components/EditItemModal.tsx` — add/edit item modal.
- `src/Components/SplitTypeDrawer.tsx` — equal/percentage/fraction split chooser.
- `src/Components/PercentageSplitInput.tsx`, `src/Components/FractionalSplitInput.tsx` — split-type input widgets.
- `src/Components/BillTotalsSummary.tsx` — subtotal/tax/total display (shared with Summary step).
- `src/Components/EditableTitle.tsx` — inline-editable bill/session title.
- `src/Components/PeopleListShared.tsx` — presentational `PersonInputForm`/`PeopleList`, shared with session-level people UI.
- `src/billStore.ts` — non-persisted scratch editor for the currently-open bill. Not the source of truth; writes from outside `BillEditorPage` must go to `sessionStore` (see root `CLAUDE.md`).
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

## Notes
- `billStore` is a scratch/derived store, not persisted — see the
  `CLAUDE.md` warning about writing to it from outside `BillEditorPage`
  (only safe if `useBillStore.getState().billId === billId`).
- Zod `.default()` only applies during `.parse()`, not to hand-built object
  literals typed as `Bill` — every field must be present when constructing
  one directly (see `src/migrations/toSessionStore.ts` and test fixtures).

# Session Management

## Summary
Creating, listing, and browsing sessions — the top-level container that
holds a group of people and their bills. Includes the session home
dashboard (bill cards, people, scan status) and JSON import of previously
exported sessions.

## Frontend
- `src/Pages/SessionsListPage.tsx` — route `/sessions`; lists locally-created sessions (`sessionStore`) plus "sessions I've joined" (`joinedSessionsStorage.ts`, reconciled against server status via `POST /api/sessions/status`); supports JSON import via `FileImport`.
- `src/Pages/SessionHomePage.tsx` — route `/session/:sessionId`; people list, `ThingsToTakeCareOf` (below), bill cards (with scan status/retry), "Paid by" quick-edit, "Scan New Bill" (creates an empty bill and opens it straight into the scan modal — see [scan-receipt.md](scan-receipt.md)), gear icon top-right opens `SessionSettingsModal` (session currency + exchange-rate table — see [currency.md](currency.md)), embeds `GoLiveSection` and `LiveSessionPanel` (see [live-collaboration.md](live-collaboration.md)).
- `src/Components/ThingsToTakeCareOf.tsx` — a consolidated, gentle nudge
  (amber `Alert`, `data-testid="things-to-take-care-of"`) listing every bill
  with at least one incomplete item — an equal-split item nobody's claimed,
  a fraction-split item whose claimed total falls short of its quantity, or
  a percentage-split item whose shares don't add to 100% (see
  `src/lib/unclaimedItems.ts`'s `isItemIncomplete`/`getUnclaimedItemCount`).
  Each line links straight into that bill. Renders nothing when nothing's
  outstanding. This is purely derived from `sessionStore`'s already
  live-merged `session.bills` — no separate fetch, live or offline.
  Complements, doesn't replace, the existing per-bill-card "Unclaimed
  items" pill further down the page (still computed inline in
  `SessionHomePage.tsx`, `consumedBy.length === 0` only — a narrower,
  faster-to-scan signal than the consolidated section's fuller check).
- `src/Components/PeopleSection.tsx` — session-level people list with live presence. `usePeoplePresence` also computes a per-person `nameEditLockedFor` (via `src/lib/presenceRules.ts`'s `isNameEditLocked`): the creator can't rename someone while they're claimed, currently online, and have been continuously active for under an hour.
- `src/Components/EditPersonModal.tsx` — rename person modal, used from `PeopleSection`; `PeopleSection`'s `handleEditPerson` guards against opening it for a locked person as defense in depth (the trigger is already disabled in the list). Also edits a person's UPI ID (`Person.upiId`, optional, default `''`) — lets others know where to pay them back. `onSave(personId, name, upiId)` calls `sessionStore.ts`'s `updatePerson(sessionId, personId, {name, upiId})`, an options-object patch rather than positional args so more per-person fields can be added later without another signature change.
- Creator induction: `src/Components/GoLiveSection.tsx`'s "Add myself as a new person…" path (Go Live time) includes an optional UPI ID field alongside the name field, set via `updatePerson` right after `addPerson` creates the person. Editing an *existing* person's UPI ID (including the creator picking themselves from the dropdown) goes through `EditPersonModal` instead, reachable from `PeopleSection`.
- Live sync: `updatePerson` pushes to the live server (if the session is
  live) via `sessionStore.ts`'s `pushPersonUpdateLive` → `liveApi.ts`'s
  `updateLivePerson` → `PATCH /api/sessions/{code}/people/{personId}` (see
  [live-collaboration.md](live-collaboration.md)). The creator's own edits
  are token-free (any field); a joiner's own self-service UPI-ID nudge
  (`JoinerUpiNudge.tsx`) passes their joiner token and can only touch their
  own `upiId`.
- Display: `src/Components/BillSummary.tsx` shows the bill's payer's own
  UPI ID (not each claimer's — the point is "who do I pay") next to the
  "Who Paid?" selector, when set; `JoinerBillEditorPage.tsx`'s Bill Summary
  step mirrors this.
- `src/Components/BillHistory/FileImport.tsx` — JSON file import control.
- `src/sessionStore.ts` — persisted source of truth (`Session[]`, each with `people`/`bills`), zustand + `persist`. Also owns the live-push helpers — see [live-collaboration.md](live-collaboration.md).
- `src/schemas/session.schema.ts` — `Session`, `Bill`, `ReceiptImageRef`, session-store state.
- Root `/` — `RootRedirect` (inline in `src/App.tsx`) redirects to the current/first/newly-created session.

## Backend
None for local-only sessions. When a session goes live, its creation is
mirrored server-side — see [live-collaboration.md](live-collaboration.md).

## Related features
- [bill-editing.md](bill-editing.md) — bills within a session are edited here.
- [live-collaboration.md](live-collaboration.md) — "Go Live" is initiated from `SessionHomePage`.
- [settings.md](settings.md) — `autoAddSelf` affects who's pre-populated when creating a session; the global currency preference seeds a new session's `currency`.
- [currency.md](currency.md) — the session-level `currency` field and its Session Settings panel.

## Notes
- `sessionStore.ts` is the single source of truth for local data; anything
  writing bill fields from outside `BillEditorPage` must go here directly,
  not to the scratch `billStore` (see [bill-editing.md](bill-editing.md)).

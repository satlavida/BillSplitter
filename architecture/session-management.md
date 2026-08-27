# Session Management

## Summary
Creating, listing, and browsing sessions — the top-level container that
holds a group of people and their bills. Includes the session home
dashboard (bill cards, people, scan status) and JSON import of previously
exported sessions.

## Frontend
- `src/Pages/SessionsListPage.tsx` — route `/sessions`; lists locally-created sessions (`sessionStore`) plus "sessions I've joined" (`joinedSessionsStorage.ts`, reconciled against server status via `POST /api/sessions/status`); supports JSON import via `FileImport`.
- `src/Pages/SessionHomePage.tsx` — route `/session/:sessionId`; people list, bill cards (with scan status/retry), "Paid by" quick-edit, "Scan New Bill" (creates an empty bill and opens it straight into the scan modal — see [scan-receipt.md](scan-receipt.md)), embeds `GoLiveSection` and `LiveSessionPanel` (see [live-collaboration.md](live-collaboration.md)).
- `src/Components/PeopleSection.tsx` — session-level people list with live presence.
- `src/Components/EditPersonModal.tsx` — rename person modal, used from `PeopleSection`.
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
- [settings.md](settings.md) — `autoAddSelf` affects who's pre-populated when creating a session.

## Notes
- `sessionStore.ts` is the single source of truth for local data; anything
  writing bill fields from outside `BillEditorPage` must go here directly,
  not to the scratch `billStore` (see [bill-editing.md](bill-editing.md)).

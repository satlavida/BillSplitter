# Live Collaboration ("Go Live")

## Summary
Turns a local session into a shareable multi-device session: the creator
publishes a join code/link, joiners request access (approval-code or
open-link mode), and once in, everyone sees bills/items update in real time
via Server-Sent Events and can claim items as their own. Presence tracking
shows who's currently online; a per-session activity log records
claim/unclaim history.

## Frontend
**Creator side**
- `src/Components/GoLiveSection.tsx` — seeds the server-side session mirror, shows the join code/link. Used by `SessionHomePage.tsx`.
- `src/Components/LiveSessionPanel.tsx` — joiners list, approve/disapprove, settle action, SSE connection status. Used by `SessionHomePage.tsx`. Also pushes toast notifications (`src/toastStore.ts` + `src/ui/Toast.tsx`) on `joiner.pending`/`joiner.approved`/`joiner.disapproved` (diffs the freshly-refetched joiners list against the previous one) and on `activity.created` (refetches the activity log and toasts the newest entry via `src/lib/activityLine.ts`'s `formatActivityLine`, shared with `ActivityLogPage.tsx`). The `claim.*` SSE kinds `connectLiveSync` still subscribes to are not wired to toasts — they're dead/unemitted server-side since migration `0006_remove_claims.sql`; see Notes.
- `src/Pages/ActivityLogPage.tsx` — route `/session/:sessionId/activity`; creator-only claim/unclaim audit log, filterable by person/action.

**Joiner side** — `src/Components/joiner/`
- `JoinerSessionView.tsx` — top-level joiner shell; presence heartbeat, settlement fetch. Used by `Pages/JoinPage.tsx`.
- `JoinerBillList.tsx` — list of live bills, links into `JoinerBillEditorPage`; each bill's receipt thumbnail (`bill.imageRefKey`, served from `GET /api/images/{refKey}`) opens full-size in `ImageLightbox` on click, without following the card's link. Also renders the joiner-side "Things to Take Care of" signals per bill: a "New" badge (`src/lib/joinerVisitTracking.ts`, localStorage-only, keyed by `code:billId`, set by `JoinerBillEditorPage.tsx` on mount) for a bill this joiner hasn't opened yet, and — once visited — a lighter "N still unclaimed for you" note (`src/lib/joinerUnclaimedItems.ts`'s `getMyUnclaimedItemCount`, computed from the already-fetched `LiveBill`/`LiveItem` data: items this joiner hasn't claimed anything on and aren't already fully claimed by others). The two never show together for the same bill.
- `JoinerItemRow.tsx` — claim/unclaim a live item.
- `ClaimQuantityModal.tsx` — quantity picker for claiming; its number grid
  is capped at a `max` prop (own current value + whatever's still unclaimed
  by everyone else on that item), separate from the `quantity` prop used
  only for its "How many of these N did you have?" copy — see Notes.
- `AddItemForm.tsx` — joiner adds a new item to a live bill.
- `JoinerSettlementSummary.tsx` — personal-view settlement lines (see [settlement.md](settlement.md)); Basic/Detailed toggle mirroring the creator's `SessionSettlementPage.tsx`, Detailed using `src/lib/liveBillBalances.ts`'s `calculateLiveBillBalances` (a `LiveBill`/`LivePerson`-typed adapter around `settlement.ts`'s `calculateBillBalances`, since the server's loosely-typed `discountType`/`splitType` strings don't structurally match this app's narrower literal unions).
- `src/Pages/JoinPage.tsx` — route `/join/:code`; pick/enter identity, pending-approval or immediate admission.
- `src/Pages/JoinerBillEditorPage.tsx` — route `/join/:code/bills/:billId/step/:step`; joiner-facing mirror of the bill wizard using live data instead of `billStore`. Summary step shows an items-claimed `ProgressBar` (`src/ui/components.tsx`) above the item list. When the bill's currency differs from the session's, shows amounts in the bill's own currency by default with a "Show in session currency" checkbox that converts every displayed amount via `src/lib/currencyConvert.ts`'s `toSessionCurrency` — see [currency.md](currency.md); the toggle is local UI state, not persisted or synced.

**Shared**
- `src/lib/liveApi.ts` — HTTP client for every live-collaboration route below; central error mapping via `lib/errorMessages.ts`.
- `src/lib/liveSync.ts` — EventSource/polling client (`live`/`reconnecting`/`polling` status).
- `src/lib/pendingLiveWrites.ts` — tracks in-flight fire-and-forget pushes so an incoming snapshot doesn't clobber an unacknowledged local edit.
- `src/lib/joinerStorage.ts` — per-code joinerId/token persistence so a joiner survives refresh.
- `src/lib/joinedSessionsStorage.ts` — client-side index of joined live sessions, used by `SessionsListPage.tsx`.
- `src/hooks/usePresenceHeartbeat.ts` — sends a heartbeat every 1.5s while a joiner view is mounted.
- `src/schemas/live.schema.ts` — wire-response schemas (`LiveSession`, `LiveJoiner`, `LiveBill`, `LiveItem`, `LiveSettlement`, `LiveActivityEntry`), deliberately separate from local schemas.
- `src/sessionStore.ts` — owns the fire-and-forget push helpers (`pushNewBillLive`, `pushBillFieldsLive`, `pushSessionCurrencyLive`, etc., dynamically importing `liveApi.ts`) and `mergeLiveSnapshot`/`mergeLiveBill` (merges a fetched server snapshot back in by entity id, using `pendingLiveWrites.ts` to avoid clobbering in-flight edits). `BILL_FIELD_KEYS` (the allowlist of per-bill fields synced live) includes `currency`/`exchangeRate`/`exchangeRateDate`/`exchangeRateIsOverride` — see [currency.md](currency.md) for what writes them.

## Backend
- `server/internal/api/session_handlers.go`
  - `POST /api/sessions` — create a live session mirror (people, join/claim/permission modes); returns code/link/creator token.
  - `POST /api/sessions/status` — batch status lookup for "sessions I've joined" (no auth).
  - `GET /api/sessions/{code}` — full session state (bills/items/people/joiners).
  - `DELETE /api/sessions/{code}` — creator-only permanent delete.
  - `POST /api/sessions/{code}/join` — join request; branches on join_mode.
  - `GET /api/sessions/{code}/joiners` — creator-only list.
  - `GET /api/sessions/{code}/joiners/{id}` — public poll of own status; one-time token reveal.
  - `POST /api/sessions/{code}/joiners/{id}/approve` / `/disapprove` — creator-only.
  - `POST /api/sessions/{code}/settle` — creator-only, marks session settled (read-only thereafter).
  - `PATCH /api/sessions/{code}/currency` — creator-only, updates the session's base currency (see [currency.md](currency.md)).
  - Shared auth helpers: `requireCreator`, `requireJoiner`, `requireEditPermission`, `requireNotSettled`.
- `server/internal/api/bill_handlers.go`
  - `POST /api/sessions/{code}/bills`, `PATCH .../bills/{billId}` — add/update a bill.
  - `POST .../items`, `PATCH .../items/{itemId}` — add/update an item (never touches claims).
  - `POST .../items/{itemId}/claims`, `DELETE .../claims/{personId}` — claim/unclaim (free-select, no approval queue). For a Quantity Split (`splitType: "fraction"`) item, `ClaimItem` rejects (409, "Only N left to claim on this item") a value that would push the item's total claimed quantity across everyone past its own `quantity` — see Notes. Equal-split items have no such cap.
  - `GET /api/sessions/{code}/settlement` — see [settlement.md](settlement.md).
- `server/internal/api/activity_handlers.go` — `GET /api/sessions/{code}/activity`, creator-only.
- `server/internal/api/presence_handlers.go` — `POST .../presence/heartbeat`, `GET .../presence` (public list of online personIds, plus an `activeSince` map of each online personId's continuous-activity-start timestamp — RFC3339 — used by the frontend to gate renaming an active/claimed person). Consumed by `src/lib/liveApi.ts`'s `getPresence` and `src/lib/presenceRules.ts`'s `isNameEditLocked` (see [session-management.md](session-management.md)'s `PeopleSection.tsx`).
- `server/internal/api/sse_handlers.go` — `GET /api/sessions/{code}/events`, delegates to `sse.Hub.ServeHTTP`.
- `server/internal/sse/hub.go` — per-session-code pub/sub. Payloads are entity-id-only (`{Kind, ID}`); subscribers refetch via REST. Event kinds: `joiner.pending`, `joiner.approved`, `joiner.disapproved`, `item.updated`, `bill.updated`, `session.settled`, `session.deleted`, `activity.created`. A stuck subscriber is dropped rather than blocking others.
- `server/internal/presence/presence.go` — in-memory (non-DB) online/offline tracker + identity-reclaim-lock, own sweep loop (`RunPresenceSweeper` in `api/api.go`). Also tracks each person's continuous-activity-since timestamp (`ActiveSince`): a `Touch` resets it only if the gap since the previous touch exceeds `GapThreshold` (60s — above the 1.5s heartbeat cadence, below the 1hr name-edit-lock bar), so normal heartbeating accrues a stable duration instead of resetting every beat. Not persisted, lost on server restart — matches the tracker's existing non-DB pattern, acceptable given sessions are short-lived/purged after 48h.
- `server/internal/store/store.go` — sessions, people, bills, items, item allocations (claims), item activity, joiners (including upsert-on-rejoin and token verify/reveal).
- Migrations: `0001_init.sql` (sessions/people/bills/items/item_allocations/joiners), `0003_joiner_token_and_activity_log.sql`, `0004_claim_activity_reject.sql`, `0005_permission_and_identity.sql` (permission_mode, creator_person_id), `0006_remove_claims.sql` (drops the old approval-queue `item_claims` table), `0007_joiners_unique_person.sql` (dedupe + unique index for rejoin-as-upsert), `0009_currency.sql`/`0010_exchange_rate_cache.sql` (session/bill currency + exchange-rate cache — see [currency.md](currency.md)).

## Related features
- [scan-receipt.md](scan-receipt.md) — image upload route lives under the same session/bill path structure.
- [settlement.md](settlement.md) — `GET /api/sessions/{code}/settlement`, `LiveSessionPanel`'s settle action, `JoinerSettlementSummary`.
- [background-cleanup.md](background-cleanup.md) — stale live sessions get purged; presence sweeper runs alongside.
- [admin-panel.md](admin-panel.md) — manual per-session purge.
- [currency.md](currency.md) — session `currency` column, per-bill exchange-rate columns, and the fields those add to `LiveSession`/`LiveBill`.

## Notes
- **Quantity Split items have a server-enforced claim cap.** Before this
  was added, `ClaimItem` (`server/internal/api/bill_handlers.go`) did an
  unconditional upsert of a claim's value with no check against the item's
  `quantity` or what other people already held — the frontend's grid
  (`ClaimQuantityModal.tsx`) always showed the full `1..quantity` range
  regardless of others' claims, and nothing stopped a client from posting
  past it directly. The handler now sums every other person's existing
  `ConsumedBy` value for `fraction`-split items and rejects (409) a claim
  that would push the total past `quantity`, with the actual remaining
  count in the error message (`errorMessages.ts`'s `friendlyErrorMessage`
  has a dedicated regex passthrough for this one dynamic message, since
  every other mapped error is a fixed exact-match string). The frontend
  mirrors this in `JoinerItemRow.tsx` (`maxSelectable = quantity -
  othersClaimed`, passed to `ClaimQuantityModal` as `max`) purely to shrink
  what's *shown* — the server check is what actually prevents an
  over-claim, since a client could otherwise bypass the UI's cap. This is
  still a read-then-write check (same TOCTOU class already implicit
  elsewhere in this handler, e.g. the activity-log delta calculation) —
  acceptable for now, not backed by a DB-level constraint.
- If `autoAddSelf`/`selfName` (see [settings.md](settings.md)) are set,
  `GoLiveSection.tsx`'s "Which person are you?" select and `JoinPage.tsx`'s
  "I am…" select both preselect the session person whose name matches
  `selfName` (trimmed, case-insensitive), instead of defaulting to "not in
  the list"/"Someone new". This only preselects an *existing* match — it
  doesn't create a person or affect the "Add myself as a new person…"/"Your
  name" fallback inputs.
- The original claims-approval workflow (`item_claims` table) was removed in
  migration `0006` in favor of free-select claims gated by `permission_mode`
  — if you see references to an approval queue for claims, that's stale.
  `liveSync.ts`'s frontend event-kind list still subscribes to
  `claim.pending`/`claim.approved`/`claim.rejected` even though the server
  never emits them anymore — a cleanup candidate, deliberately left alone
  here since `LiveSessionPanel.tsx`'s toast wiring only listens for kinds
  the server actually fires.
- SSE payloads intentionally carry no state, only `{Kind, ID}` — don't add
  full entities to the payload; keep the refetch-on-event pattern.
- `LiveSessionPanel.tsx`'s `joinersRef` resets to `[]` on every component
  mount, so the first `listJoiners()` fetch after a remount (e.g. navigating
  away from and back to `SessionHomePage`) must not diff against that empty
  baseline — it would otherwise re-toast "X joined" for every
  already-approved joiner. A `hasLoadedJoinersRef` flag skips toasting on
  that first fetch (seeding the ref silently instead), mirroring the same
  guard `lastToastedActivityIdRef` already used for the activity-log toast.
- `middleware/logging.go`'s `statusWriter` forwards `Flush()` specifically so
  it doesn't break SSE streaming — see [infrastructure.md](infrastructure.md).
- CORS/allowlist (`middleware/allowlist.go`) fully implements preflight
  `OPTIONS` because `liveApi.ts` sends JSON bodies, which triggers browser
  preflight.

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
- `src/Components/LiveSessionPanel.tsx` — joiners list, approve/disapprove, settle action, SSE connection status. Used by `SessionHomePage.tsx`.
- `src/Pages/ActivityLogPage.tsx` — route `/session/:sessionId/activity`; creator-only claim/unclaim audit log, filterable by person/action.

**Joiner side** — `src/Components/joiner/`
- `JoinerSessionView.tsx` — top-level joiner shell; presence heartbeat, settlement fetch. Used by `Pages/JoinPage.tsx`.
- `JoinerBillList.tsx` — list of live bills, links into `JoinerBillEditorPage`.
- `JoinerItemRow.tsx` — claim/unclaim a live item.
- `ClaimQuantityModal.tsx` — quantity picker for claiming.
- `AddItemForm.tsx` — joiner adds a new item to a live bill.
- `JoinerSettlementSummary.tsx` — personal-view settlement lines (see [settlement.md](settlement.md)); Basic/Detailed toggle mirroring the creator's `SessionSettlementPage.tsx`, Detailed using `src/lib/liveBillBalances.ts`'s `calculateLiveBillBalances` (a `LiveBill`/`LivePerson`-typed adapter around `settlement.ts`'s `calculateBillBalances`, since the server's loosely-typed `discountType`/`splitType` strings don't structurally match this app's narrower literal unions).
- `src/Pages/JoinPage.tsx` — route `/join/:code`; pick/enter identity, pending-approval or immediate admission.
- `src/Pages/JoinerBillEditorPage.tsx` — route `/join/:code/bills/:billId/step/:step`; joiner-facing mirror of the bill wizard using live data instead of `billStore`.

**Shared**
- `src/lib/liveApi.ts` — HTTP client for every live-collaboration route below; central error mapping via `lib/errorMessages.ts`.
- `src/lib/liveSync.ts` — EventSource/polling client (`live`/`reconnecting`/`polling` status).
- `src/lib/pendingLiveWrites.ts` — tracks in-flight fire-and-forget pushes so an incoming snapshot doesn't clobber an unacknowledged local edit.
- `src/lib/joinerStorage.ts` — per-code joinerId/token persistence so a joiner survives refresh.
- `src/lib/joinedSessionsStorage.ts` — client-side index of joined live sessions, used by `SessionsListPage.tsx`.
- `src/hooks/usePresenceHeartbeat.ts` — sends a heartbeat every 1.5s while a joiner view is mounted.
- `src/schemas/live.schema.ts` — wire-response schemas (`LiveSession`, `LiveJoiner`, `LiveBill`, `LiveItem`, `LiveSettlement`, `LiveActivityEntry`), deliberately separate from local schemas.
- `src/sessionStore.ts` — owns the fire-and-forget push helpers (`pushNewBillLive`, `pushBillFieldsLive`, etc., dynamically importing `liveApi.ts`) and `mergeLiveSnapshot`/`mergeLiveBill` (merges a fetched server snapshot back in by entity id, using `pendingLiveWrites.ts` to avoid clobbering in-flight edits).

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
  - Shared auth helpers: `requireCreator`, `requireJoiner`, `requireEditPermission`, `requireNotSettled`.
- `server/internal/api/bill_handlers.go`
  - `POST /api/sessions/{code}/bills`, `PATCH .../bills/{billId}` — add/update a bill.
  - `POST .../items`, `PATCH .../items/{itemId}` — add/update an item (never touches claims).
  - `POST .../items/{itemId}/claims`, `DELETE .../claims/{personId}` — claim/unclaim (free-select, no approval queue).
  - `GET /api/sessions/{code}/settlement` — see [settlement.md](settlement.md).
- `server/internal/api/activity_handlers.go` — `GET /api/sessions/{code}/activity`, creator-only.
- `server/internal/api/presence_handlers.go` — `POST .../presence/heartbeat`, `GET .../presence` (public list of online personIds).
- `server/internal/api/sse_handlers.go` — `GET /api/sessions/{code}/events`, delegates to `sse.Hub.ServeHTTP`.
- `server/internal/sse/hub.go` — per-session-code pub/sub. Payloads are entity-id-only (`{Kind, ID}`); subscribers refetch via REST. Event kinds: `joiner.pending`, `joiner.approved`, `joiner.disapproved`, `item.updated`, `bill.updated`, `session.settled`, `session.deleted`, `activity.created`. A stuck subscriber is dropped rather than blocking others.
- `server/internal/presence/presence.go` — in-memory (non-DB) online/offline tracker + identity-reclaim-lock, own sweep loop (`RunPresenceSweeper` in `api/api.go`).
- `server/internal/store/store.go` — sessions, people, bills, items, item allocations (claims), item activity, joiners (including upsert-on-rejoin and token verify/reveal).
- Migrations: `0001_init.sql` (sessions/people/bills/items/item_allocations/joiners), `0003_joiner_token_and_activity_log.sql`, `0004_claim_activity_reject.sql`, `0005_permission_and_identity.sql` (permission_mode, creator_person_id), `0006_remove_claims.sql` (drops the old approval-queue `item_claims` table), `0007_joiners_unique_person.sql` (dedupe + unique index for rejoin-as-upsert).

## Related features
- [scan-receipt.md](scan-receipt.md) — image upload route lives under the same session/bill path structure.
- [settlement.md](settlement.md) — `GET /api/sessions/{code}/settlement`, `LiveSessionPanel`'s settle action, `JoinerSettlementSummary`.
- [background-cleanup.md](background-cleanup.md) — stale live sessions get purged; presence sweeper runs alongside.
- [admin-panel.md](admin-panel.md) — manual per-session purge.

## Notes
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
- SSE payloads intentionally carry no state, only `{Kind, ID}` — don't add
  full entities to the payload; keep the refetch-on-event pattern.
- `middleware/logging.go`'s `statusWriter` forwards `Flush()` specifically so
  it doesn't break SSE streaming — see [infrastructure.md](infrastructure.md).
- CORS/allowlist (`middleware/allowlist.go`) fully implements preflight
  `OPTIONS` because `liveApi.ts` sends JSON bodies, which triggers browser
  preflight.

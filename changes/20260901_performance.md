# Go server: eliminate full-session over-fetch + N+1 hydration

Follow-up to `7c4ed15` (`GetSessionGate`, SQLite pool/pragma tuning). That
commit fixed `requireNotSettled`/`requireEditPermission`; this pass finds
and fixes every other place in `server/internal/api` that still called
`store.GetSession` (full people/bills/items/allocations/payments hydrate)
to read one field, plus the N+1 query shape hiding inside `GetSession`
itself.

## Analysis

`store.GetSession` recursively hydrates the whole session graph:
`listBills` (1 query) → `listItems` per bill (N queries) → `listAllocations`
per item (M queries) → plus people + payments. For 5 bills x 10 items that's
~58 round trips for one call. Every handler below called this just to read
a handful of fields off the result, using in-memory helpers
(`findBillTitle`, `findItemName`, `findPersonName`, `findItem`,
`currentAllocationValue`) that walked the fully-loaded tree instead of
letting SQL answer a point query.

| Handler | Full session fields actually used | Fix |
|---|---|---|
| `requireCreator` (every creator-authed route) | `CreatorToken` | `GetCreatorToken` |
| `Join` | `CreatorPersonID`, `JoinMode`, one person's name | `GetSessionJoinInfo` + `GetPersonName` |
| `ClaimItem` | `IsSettled`, one item + its allocations, one person's name | `GetSessionGate` (already existed, wasn't used here) + `GetItem` + `GetPersonName` |
| `UnclaimItem` | one item + its allocations, one person's name | `GetItem` + `GetPersonName` |
| `AddPayment` | `RequirePaymentVerification` | `GetRequirePaymentVerification` |
| `DeleteBill` / `PermanentlyDeleteBill` | one bill's title (+ person name) | `GetBillTitle` + `GetPersonName` |
| `UpdateItem` / `DeleteItem` | one item's old row, one person's name | `GetItem` + `GetPersonName` |

`GetSettlement` and the public `GetSession` handler genuinely need the
whole graph and were left as full hydrates — but they, and `Join`, still
paid for the N+1 loop underneath, which was fixed separately.

No new indexes were needed — every batched query below reuses an existing
FK index (`idx_items_bill`, `idx_allocations_item`); the fix is query
shape, not schema.

## Changes

**`server/internal/store/store.go`**
- Added narrow point-lookup methods: `GetCreatorToken`, `GetSessionJoinInfo`,
  `GetRequirePaymentVerification`, `GetBillTitle`, `GetPersonName`,
  `GetItem` (item row + its own allocations only).
- Replaced the `listBills` → per-bill `listItems` → per-item
  `listAllocations` fan-out with `listItemsForBills`/
  `listAllocationsForItems`: 2 batched `WHERE ... IN (...)` queries for the
  whole session instead of `1 + N + M`. Benefits every caller of
  `GetSession` (`Join`, the public session-read route, `GetSettlement`) for
  free, not just the handlers rewired below.

**`server/internal/api/{session,bill,payment}_handlers.go`**
- `requireCreator`, `Join`, `ClaimItem`, `UnclaimItem`, `AddPayment`,
  `DeleteBill`, `PermanentlyDeleteBill`, `UpdateItem`, `DeleteItem` rewired
  onto the narrow queries above instead of `store.GetSession`.
- `ClaimItem` also used to duplicate work: `requireEditPermission` already
  calls `GetSessionGate` for `is_settled` on the same request, and
  `ClaimItem` re-checked `sess.IsSettled` from a *second*, full-hydrate
  fetch. Now both gates share the same narrow `GetSessionGate` shape (still
  two round trips, both single-row, matching the existing gate-call
  pattern elsewhere).
- Removed the now-dead in-memory helpers `findBillTitle`, `findItemName`,
  `findItem`, `findPersonName`, `currentAllocationValue`.

**`server/benchmark/`**
- Added `scripts/bench_claim_item.sh` (no existing coverage for the
  claim-item write path) and wired it into `run_all.sh`.
- `scripts/seed.sh` now also creates a second person and one item so
  claim/unclaim have something to benchmark against.
- `architecture/benchmarking.md` — new "Fixed 2026-09-01" entry in Known
  findings.

## Verification

- `go build ./...`, `go vet ./...`, `go test ./...` — all clean, no test
  changes needed (response shapes are unchanged; only the queries behind
  them changed).

## Benchmark: before vs. after

Same methodology as `7c4ed15`/prior entries — Docker container capped at
1 CPU / 512MB, `hey` as load generator, one real session/bill/item seeded
through the live API. Both runs measured against the same working tree
(`git commit 64aaea7` + this change, uncommitted at measurement time — see
raw reports for exact params).

- Before: `server/benchmark/results/full_run_20260901_100525.md`
- After: `server/benchmark/results/full_run_20260901_100905.md`

| Endpoint | Before | After | Change |
|---|---|---|---|
| `POST .../items/{itemId}/claims` | 109.7 req/s, p50 453ms, p99 627ms | 2,953.9 req/s, p50 13ms, p99 60ms | **~27x throughput, ~10x p99** |
| `POST .../join` | 1,116.0 req/s, p99 121ms | 3,936.9 req/s, p99 44ms | **~3.5x throughput** |
| `GET /api/sessions/{code}` | 6,170.6 req/s, p99 65ms | 6,949.1 req/s, p99 63ms | ~13% (only 1 bill/1 item seeded — the N+1 batching payoff grows with session size) |
| `POST .../bills/{billId}/items` | 3,432.8 req/s, p99 44ms | 4,136.7 req/s, p99 33ms | ~20% (unrelated to this pass; run-to-run variance on the shared 1-CPU container) |
| `GET /healthz` (control) | 33,390.5 req/s | 34,340.9 req/s | within noise, confirms the container/host wasn't the variable |

Claim-item was the standout: it's the single hottest write in live
collaboration (fires on every item tap during joint editing), and it was
paying for the entire session's data on every call. The `GET /api/sessions`
read-session number is capped by only 1 item existing in the seeded
session — the batched-query fix removes a *per-item, per-bill* query
fan-out, so its win compounds with session size and will show up more on a
multi-bill, multi-item session than this single-item benchmark can capture.

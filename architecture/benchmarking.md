# Server Benchmarking

## Summary
Load-tests the real Go server (real SQLite, real handlers, no mocks) inside
a Docker container capped to a fixed CPU/RAM budget (default: 1 CPU /
512MB), using [`hey`](https://github.com/rakyll/hey) as the load generator.
Every run seeds one real session + bill through the actual API, then
benchmarks a set of endpoints and writes a dated markdown report. Purely a
backend diagnostic tool — nothing here ships or affects runtime behavior.

## Frontend
None.

## Backend
- `server/benchmark/Dockerfile` — builds the real `server/cmd/server`
  binary (`CGO_ENABLED=0`, matches the pure-Go `modernc.org/sqlite` driver)
  into a `distroless/static` image. Build context is `server/`, same module
  root as a real deploy — not a separate fixture.
- `server/benchmark/scripts/lib.sh` — shared helpers: `run_hey` (runs `hey`,
  parses its text summary — req/s, avg/p50/p90/p95/p99, status-code
  distribution, error count — and appends a markdown section to a report
  file, alongside a `docker stats` snapshot of the container taken
  immediately after that run), `report_header`, `docker_stats_line`.
- `server/benchmark/scripts/{setup,teardown,seed}.sh` — build+run the
  capped container, stop/remove it, seed a session/bill via the real API
  (writes ids/tokens to gitignored `.seed.env`).
- `server/benchmark/scripts/bench_*.sh` — one script per endpoint
  (`bench_healthz.sh`, `bench_read_session.sh`, `bench_join.sh`,
  `bench_add_item.sh`); each is runnable standalone (own timestamped
  report) or via `run_all.sh` (single combined report, all endpoints).
  `bench_realistic_item_load.sh` is different — it's not a single-endpoint
  `hey` run but a small curl+xargs driver that seeds N sessions x M bills
  and fires item-adds across all of them concurrently, matching this app's
  actual traffic shape (several people editing several bills at once)
  rather than one bill taking thousands of sequential inserts.
- `server/benchmark/results/*.md` — committed, dated reports; each carries
  the git commit sha it was measured against.
- `server/benchmark/README.md` — full usage, how to add a new endpoint
  benchmark, config knobs (`CPUS`/`MEMORY`/`PORT`), and a running "Known
  findings" section for diagnosed hot spots (separate from the raw
  `results/*.md` numbers — this is where a settled diagnosis belongs).

## Related features
- [infrastructure.md](infrastructure.md) — the server this benchmarks
  (config, router, deployment); `server/DEPLOYMENT.md`'s systemd/Docker
  instructions are a real deploy and are unaffected by this tool.
- [live-collaboration.md](live-collaboration.md) — the endpoints currently
  covered (session read, join, item add) are its core write/read paths.

## Notes
- Not wired into CI or any deploy pipeline — run manually
  (`server/benchmark/scripts/run_all.sh`) when characterizing or
  investigating performance. Requires Docker Desktop running locally and
  `hey` (`brew install hey`).
- `hey` v0.1.5 silently sends `c * floor(n/c)` requests when `-n` isn't
  evenly divisible by `-c` — not a server error. See the README's
  "Gotchas" section; all `bench_*.sh` defaults are chosen to divide evenly.
- **Fixed 2026-08-31**: `POST .../bills/{billId}/items` throughput used to
  collapse under sustained load into one bill (~930 req/s for `join` vs.
  ~200 req/s for item-add at similar concurrency, climbing further as the
  bill grew) because `requireNotSettled`/`requireEditPermission` called
  `store.GetSession` — a full session hydrate (all people/bills/items) —
  just to read one `IsSettled` bool / `PermissionMode` string, on every
  single write. Replaced with `store.GetSessionGate` (`SELECT is_settled,
  permission_mode FROM sessions WHERE id = ?`, `internal/store/store.go`).
  Item-add went from ~200 req/s (climbing to 1.3s p99 as the bill grew) to
  a flat ~2,000-2,700 req/s regardless of bill size — see
  `results/full_run_20260831_220640.md` (after) vs.
  `results/full_run_20260831_220341.md` (before).
- **Fixed 2026-08-31**: `db.Open` (`internal/db/db.go`) capped the SQLite
  connection pool to `SetMaxOpenConns(1)`, which serialized every read
  behind every other read and write — defeating WAL's whole point (WAL
  lets readers run concurrently with the one active writer). Raised to 8;
  SQLite's own file locking + the existing `busy_timeout(5000)` pragma
  already made concurrent writers block-and-retry rather than error, so
  the single-connection cap wasn't actually required for correctness.
- **Fixed 2026-08-31**: added `synchronous=NORMAL` (safe with WAL — the
  SQLite-documented risk is losing the most recent commit(s) on an OS
  crash, not corruption; avoids an fsync on every commit) and
  `_txlock=immediate` (write transactions take the writer lock at `BEGIN`
  instead of deferring it to the first write statement, avoiding the
  classic Go+SQLite failure mode where two deferred transactions both
  start as readers and collide on the upgrade). `journal_mode=WAL` and
  `busy_timeout(5000)` were already set from day one — WAL was not the
  gap; the gap was the pool cap above plus these two pragmas. Combined
  effect on the full suite: item-add ~1,889→~3,394 req/s, join
  ~941→~1,144 req/s. See `results/full_run_20260831_221408.md`.
- **Investigated, not fixed — SQLite's single-writer model means join
  throughput *drops* as concurrency rises, not just plateaus.** Isolated
  test (`hey` at `-c 1` vs `-c 50` against `/join`): 1 CPU cap, ~2,058
  req/s sequential vs. ~619-1,144 req/s at 50 concurrent — i.e. more
  concurrent clients made total throughput *worse*, the signature of
  goroutines thrashing on `busy_timeout` retries for the one write lock
  rather than a hard ceiling. Confirmed it's not lock-upgrade contention
  specifically (`_txlock=immediate` barely moved it) and is partly
  CPU-scarcity-driven (2 CPUs recovered more of the sequential ceiling
  than 1 did). `CreateJoiner`'s multi-statement transaction
  (`internal/store/store.go`) holds the writer lock longer than
  `AddItem`'s single-statement write, which is likely why join suffers
  more. The architectural fix — an application-level single-writer queue
  (one goroutine draining a channel of write jobs, so concurrent requests
  wait in cheap Go channel order instead of retrying against SQLite's busy
  handler) — is a real design change, not a one-line tweak, and wasn't
  applied; flagging it here for a deliberate decision rather than doing it
  unprompted.
- **Deprioritized the above by design, not oversight.** `join`/session
  creation is a low-frequency action (a handful of times per session,
  ever) — the endpoint that actually matters under concurrency is item-add
  across many sessions/bills at once (e.g. 10 sessions x 5 bills x 10
  items being edited around the same time). Verified that shape directly
  with `bench_realistic_item_load.sh`: 500 item-add requests spread across
  50 different bills in 10 different sessions, concurrency 50, **0
  errors**, p50 2.9ms / p99 36.5ms — no sign of the join-style
  concurrency degradation, consistent with `AddItem`'s single-statement
  write (vs. `CreateJoiner`'s multi-statement transaction) scaling *up*
  with concurrency in isolation too (~3,881 req/s at `-c 1` →
  ~5,284 req/s at `-c 50` via direct `hey` test). The write-serialization
  queue idea above stays parked unless join/create-session traffic
  patterns actually change.

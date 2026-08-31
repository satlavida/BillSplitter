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

# Server benchmarking

Load-tests the real Go server (real SQLite, real handlers, no mocks) inside
a Docker container capped to a fixed CPU/RAM budget, using
[`hey`](https://github.com/rakyll/hey) as the load generator. Every run
produces a dated markdown report in `results/`. See
[`architecture/benchmarking.md`](../../architecture/benchmarking.md) for how
this fits the rest of the backend.

## Prerequisites

- Docker Desktop (daemon running — `docker info` should succeed)
- `hey` — `brew install hey`
- `curl`

## Quick start

```bash
cd server/benchmark/scripts
./run_all.sh              # setup -> seed -> every endpoint -> results/full_run_<ts>.md
./run_all.sh --teardown   # same, then stop/remove the container afterwards
```

That builds the image from `Dockerfile` (build context is `server/`,
matching the real module root), starts it with `docker run --cpus=1
--memory=512m`, seeds one session + bill through the real API, runs every
`bench_*.sh` script against it, and writes one combined report.

## Running things individually

Useful once you're digging into a specific endpoint rather than running the
whole suite:

```bash
./setup.sh          # build + start the capped container
./seed.sh           # create a session/bill, write ids to .seed.env (gitignored)
./bench_join.sh      # run just this one benchmark -> its own results/*.md
./bench_add_item.sh
./bench_realistic_item_load.sh   # SESSIONS=10 BILLS_PER_SESSION=5 ITEMS_PER_BILL=10 CONCURRENCY=50 by default
./teardown.sh        # stop + remove the container when done
```

`bench_realistic_item_load.sh` is different from the other `bench_*.sh` scripts:
it doesn't use `hey` (which only targets one URL per run). It seeds N sessions
each with several bills, then fires item-add requests across *all* of them
concurrently via a small curl+xargs driver — the shape that matches this app's
actual traffic (several people editing several bills around the same time),
as opposed to `bench_add_item.sh`'s one-bill/many-sequential-inserts shape.
**Its `Requests/sec` number is a client-side driver ceiling (bash+curl process
spawn cost on the host machine, measured directly against a no-op endpoint),
not the server's real capacity** — trust its latency percentiles and error
count instead; see the script's own report output for the full caveat.

Each `bench_*.sh` is standalone: run it directly and it makes its own
timestamped report; pass it a path (`./bench_join.sh some/report.md`) and it
appends to that file instead — that's how `run_all.sh` merges every
endpoint into one report.

## Adding a new endpoint benchmark

Copy the shortest existing script (`bench_join.sh` is a good template) and
change the request. The pattern:

```bash
source ./lib.sh
[ -f "$BENCH_DIR/.seed.env" ] || die "run seed.sh first"
source "$BENCH_DIR/.seed.env"

REPORT="${1:-$RESULTS_DIR/my_endpoint_$(date +%Y%m%d_%H%M%S).md}"
[ -s "$REPORT" ] || report_header "$REPORT" "My Endpoint Benchmark"

run_hey "description" METHOD "$BASE_URL/api/..." 'json body or ""' N C "$REPORT" [extra hey args, e.g. -H "X-Creator-Token: $CREATOR_TOKEN"]
```

`run_hey` (in `lib.sh`) runs `hey`, parses req/s, avg/p50/p90/p95/p99
latency, status-code distribution, and a `docker stats` snapshot of the
container immediately after the run, and appends it all as a markdown
section. Add the new script's invocation to `run_all.sh` if it should be
part of the standard suite.

## Config knobs

All env-overridable (defaults in `lib.sh`):

| Var | Default | Meaning |
|---|---|---|
| `CPUS` | `1` | `docker run --cpus` |
| `MEMORY` | `512m` | `docker run --memory` (and `--memory-swap`, same value — no swap) |
| `PORT` | `18080` | host port the container's `:8080` is mapped to |
| `CONTAINER_NAME` | `billsplitter-benchmark` | so it doesn't collide with a real dev container |
| `IMAGE_NAME` | `billsplitter-server-benchmark` | |

Example — try a tighter cap:

```bash
CPUS=0.5 MEMORY=256m ./run_all.sh
```

## Gotchas

- **`hey` (v0.1.5, the `brew` version at time of writing) sends fewer
  requests than `-n` if `-n` isn't evenly divisible by `-c`** — it actually
  sends `c * floor(n/c)`, silently. E.g. `-n 1000 -c 30` sends 990, not
  1000. A report's "Errors | 0 / 990" for a `-n 1000` run is this quirk, not
  990 failures — the "Errors" denominator is always the *actual* request
  count from the status-code table, not the requested `-n`. Pick N values
  divisible by C (all `bench_*.sh` defaults already are) to avoid the
  confusion entirely.

## Known findings (starting points, not exhaustive)

- **Fixed 2026-08-31 — `POST .../bills/{billId}/items` used to degrade as
  the target bill grew.** `requireNotSettled`/`requireEditPermission`
  called `store.GetSession`, hydrating the *entire* session (all people,
  bills, items) just to read one `IsSettled` bool / `PermissionMode`
  string — O(n²) total work for bulk item creation into one bill, not
  O(n). Replaced with `store.GetSessionGate`, a single narrow query. Went
  from ~200 req/s (p99 climbing to 1.3s as the bill grew) to a flat
  ~2,000-2,700 req/s. See `results/full_run_20260831_220341.md` (before)
  vs. `results/full_run_20260831_220640.md` (after) and
  `architecture/benchmarking.md`'s Notes for the full writeup.
- **Fixed 2026-08-31 — SQLite pool capped at 1 connection serialized every
  read behind every write.** `db.Open` (`internal/db/db.go`) had
  `SetMaxOpenConns(1)` despite `journal_mode=WAL`, which defeats WAL's
  point (concurrent readers alongside the one writer). Raised to 8 —
  `busy_timeout(5000)` already made writers block-and-retry safely, so the
  cap of 1 wasn't load-bearing for correctness.
- **Fixed 2026-08-31 — added `synchronous=NORMAL` and `_txlock=immediate`.**
  `journal_mode=WAL` and `busy_timeout(5000)` were already set; these two
  pragmas were the actual gap. `synchronous=NORMAL` is the standard safe
  pairing with WAL and skips an fsync per commit; `_txlock=immediate`
  takes the write lock at `BEGIN` instead of the first write statement,
  avoiding deferred-transaction upgrade collisions. Item-add
  ~1,889→~3,394 req/s, join ~941→~1,144 req/s.
- **Not fixed — join throughput drops as concurrency rises** (SQLite's
  single-writer model + `CreateJoiner`'s multi-statement transaction
  holding the lock longer than a single-statement write). ~2,058 req/s at
  `-c 1` vs. ~619-1,144 req/s at `-c 50` — more concurrent clients make it
  *worse*, not just plateau. Fixing this for real needs an
  application-level single-writer queue, a real architectural change —
  see `architecture/benchmarking.md`'s Notes for the full investigation.

Add more findings here as they're confirmed — this file, not the dated
`results/*.md` reports, is where a settled diagnosis belongs so the next
person doesn't have to re-derive it from a report's raw numbers.

## What's committed vs. not

- `results/*.md` reports **are** committed — they're the point, a running
  record of measured behavior over time (see report filenames' dates and
  each report's git-commit-sha line to correlate a number with the code
  that produced it).
- `.seed.env` is gitignored — regenerated every `seed.sh` run, holds a
  live session code/token that's meaningless once the container is torn
  down.
- The Docker image itself isn't pushed anywhere; it's built locally each
  time (`setup.sh`), same source `server/` as everything else.

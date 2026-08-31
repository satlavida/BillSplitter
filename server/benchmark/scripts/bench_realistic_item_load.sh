#!/usr/bin/env bash
# Benchmarks the shape of load that actually matters for this app: many
# sessions each with several bills, each bill getting several items added
# around the same time (people building out a bill together) — not one
# bill taking thousands of sequential inserts (bench_add_item.sh's shape),
# and not join/create-session churn (low-frequency, see README's
# "Known findings" for why that's deprioritized).
#
# hey only targets one URL per invocation, so a multi-bill concurrent load
# needs its own driver here: seed SESSIONS x BILLS_PER_SESSION bills, then
# fire ITEMS_PER_BILL requests per bill, all bills' requests interleaved
# and run through xargs -P for real cross-bill concurrency.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh
require_cmds curl xargs awk sort

SESSIONS="${SESSIONS:-10}"
BILLS_PER_SESSION="${BILLS_PER_SESSION:-5}"
ITEMS_PER_BILL="${ITEMS_PER_BILL:-10}"
CONCURRENCY="${CONCURRENCY:-50}"

curl -sf "$BASE_URL/healthz" >/dev/null || die "server not reachable at $BASE_URL — run setup.sh first"

TARGETS_FILE="$(mktemp)"
SHUFFLED_FILE="$(mktemp)"
TIMES_FILE="$(mktemp)"
WORKER="$(mktemp)"
trap 'rm -f "$TARGETS_FILE" "$SHUFFLED_FILE" "$TIMES_FILE" "$WORKER"' EXIT

log "Seeding $SESSIONS sessions x $BILLS_PER_SESSION bills..."
for s in $(seq 1 "$SESSIONS"); do
  # people.id is a global TEXT PRIMARY KEY (not scoped per session), so
  # every session needs its own unique person id — a real client always
  # generates one; reusing "p1" across sessions here would 500 on the
  # second session's insert.
  person_id="bench-p-$s-$$"
  create_resp="$(curl -sf -X POST "$BASE_URL/api/sessions" \
    -H 'Content-Type: application/json' \
    -d '{
      "title": "Realistic Load Session",
      "people": [{"id":"'"$person_id"'","name":"Alice","upiId":""}],
      "joinMode": "open_link",
      "claimMode": "free_select",
      "permissionMode": "edit",
      "creatorPersonId": "'"$person_id"'",
      "currency": "INR"
    }')"
  code="$(echo "$create_resp" | grep -oE '"code":"[^"]*"' | cut -d'"' -f4)"
  token="$(echo "$create_resp" | grep -oE '"creatorToken":"[^"]*"' | cut -d'"' -f4)"
  [ -n "$code" ] && [ -n "$token" ] || die "session creation failed: $create_resp"

  for b in $(seq 1 "$BILLS_PER_SESSION"); do
    bill_resp="$(curl -sf -X POST "$BASE_URL/api/sessions/$code/bills" \
      -H 'Content-Type: application/json' -H "X-Creator-Token: $token" \
      -d '{"title":"Bill","currency":"INR","taxAmount":0}')"
    bill_id="$(echo "$bill_resp" | grep -oE '"id":"[^"]*"' | head -1 | cut -d'"' -f4)"
    [ -n "$bill_id" ] || die "bill creation failed: $bill_resp"
    for i in $(seq 1 "$ITEMS_PER_BILL"); do
      echo "$code $token $bill_id" >>"$TARGETS_FILE"
    done
  done
done

total_requests=$(wc -l <"$TARGETS_FILE" | tr -d ' ')
log "Seeded. Firing $total_requests item-add requests ($SESSIONS sessions x $BILLS_PER_SESSION bills x $ITEMS_PER_BILL items) at concurrency $CONCURRENCY..."

# Shuffle (portable — macOS has no `shuf`) so concurrent requests hit
# different sessions/bills throughout the run, not all of session 1's
# bills first — that's the "several people editing several bills around
# the same time" shape this benchmark exists to test.
awk 'BEGIN{srand()} {print rand() "\t" $0}' "$TARGETS_FILE" | sort -n | cut -f2- >"$SHUFFLED_FILE"

cat >"$WORKER" <<WORKEREOF
#!/usr/bin/env bash
curl -s -o /dev/null -w "%{time_total} %{http_code}\n" \\
  -X POST "$BASE_URL/api/sessions/\$1/bills/\$3/items" \\
  -H "Content-Type: application/json" -H "X-Creator-Token: \$2" \\
  -d '{"name":"Item","price":100,"quantity":1}'
WORKEREOF
chmod +x "$WORKER"

# -L 1: one line -> one invocation, its 3 space-separated fields become
# $1 $2 $3 for WORKER. A tiny fixed-size command per invocation (unlike an
# inline bash -c script) avoids BSD xargs's "command line cannot be
# assembled" on large concurrent batches.
start_ts=$(date +%s.%N)
xargs -P "$CONCURRENCY" -L 1 "$WORKER" <"$SHUFFLED_FILE" >>"$TIMES_FILE"
end_ts=$(date +%s.%N)

wall_time=$(awk -v s="$start_ts" -v e="$end_ts" 'BEGIN{printf "%.4f", e-s}')
rps=$(awk -v n="$total_requests" -v t="$wall_time" 'BEGIN{printf "%.2f", n/t}')

success=$(awk '$2 ~ /^2/' "$TIMES_FILE" | wc -l | tr -d ' ')
errors=$(awk '$2 !~ /^2/' "$TIMES_FILE" | wc -l | tr -d ' ')

percentile() {
  local p="$1"
  awk '{print $1}' "$TIMES_FILE" | sort -n | awk -v p="$p" '
    { a[NR]=$1 } END {
      idx = int(NR * p / 100); if (idx < 1) idx = 1; if (idx > NR) idx = NR
      printf "%.4f", a[idx]
    }'
}
avg=$(awk '{s+=$1; n++} END{printf "%.4f", s/n}' "$TIMES_FILE")
p50=$(percentile 50)
p90=$(percentile 90)
p95=$(percentile 95)
p99=$(percentile 99)

stats="$(docker_stats_line)"

REPORT="${1:-$RESULTS_DIR/realistic_item_load_$(date +%Y%m%d_%H%M%S).md}"
[ -s "$REPORT" ] || report_header "$REPORT" "Realistic Multi-Session Item-Add Load"

{
  echo "### Realistic item-add load: $SESSIONS sessions x $BILLS_PER_SESSION bills x $ITEMS_PER_BILL items"
  echo
  echo "Simulates several sessions each with several bills getting items added around"
  echo "the same time — the shape that actually matters for this app, vs. one bill"
  echo "taking thousands of sequential inserts. Requests interleaved across all"
  echo "bills and fired at concurrency $CONCURRENCY via a custom curl+xargs driver"
  echo "(not \`hey\`, which only targets one URL per run)."
  echo
  echo "**Requests/sec here is a client-side driver ceiling, not the server's"
  echo "capacity** — this driver forks a bash+curl process per request, and on this"
  echo "machine that alone caps out around 250-300 req/s even against a no-op"
  echo "\`GET /healthz\` (measured directly, no server work at all). Trust the"
  echo "**p50/p90/p95/p99 latencies** (each is curl's own per-request timing, not"
  echo "inflated by scheduling overhead before the request starts) and the **error"
  echo "count** as the real signal from this benchmark; for a true throughput"
  echo "ceiling on one endpoint, use \`hey\` directly (see bench_add_item.sh, which"
  echo "hit ~3,000-5,000 req/s on AddItem — this app's real capacity is nowhere"
  echo "near this driver's ~300 req/s limit)."
  echo
  echo "| Metric | Value |"
  echo "|---|---|"
  echo "| Requests/sec | $rps |"
  echo "| Avg latency | ${avg}s |"
  echo "| p50 | ${p50}s |"
  echo "| p90 | ${p90}s |"
  echo "| p95 | ${p95}s |"
  echo "| p99 | ${p99}s |"
  echo "| Total wall time | ${wall_time}s |"
  echo "| Errors | $errors / $total_requests |"
  echo "| Container after run | $stats |"
  echo
} >>"$REPORT"

log "-> $rps req/s, p50=${p50}s p99=${p99}s, errors=$errors/$total_requests"
log "Report: $REPORT"

#!/usr/bin/env bash
# Benchmarks POST /api/sessions/{code}/join — a DB write (open_link mode:
# insert person + auto-approve). Every request uses the same name; the
# handler doesn't dedupe, so this measures steady-state insert cost, not a
# growing-session effect (see bench_add_item.sh for that).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh
[ -f "$BENCH_DIR/.seed.env" ] || die "run seed.sh first"
source "$BENCH_DIR/.seed.env"

N="${N:-2000}"
C="${C:-50}"
REPORT="${1:-$RESULTS_DIR/join_$(date +%Y%m%d_%H%M%S).md}"
[ -s "$REPORT" ] || report_header "$REPORT" "POST /api/sessions/{code}/join Benchmark"

run_hey "POST .../join (DB write)" POST "$BASE_URL/api/sessions/$SESSION_CODE/join" \
  '{"name":"StressJoiner"}' "$N" "$C" "$REPORT"

log "Report: $REPORT"

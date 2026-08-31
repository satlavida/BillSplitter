#!/usr/bin/env bash
# Benchmarks GET /api/sessions/{code} — a real DB read (session + people +
# bills + items via store.GetSession). Requires seed.sh to have run first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh
[ -f "$BENCH_DIR/.seed.env" ] || die "run seed.sh first"
source "$BENCH_DIR/.seed.env"

N="${N:-10000}"
C="${C:-100}"
REPORT="${1:-$RESULTS_DIR/read_session_$(date +%Y%m%d_%H%M%S).md}"
[ -s "$REPORT" ] || report_header "$REPORT" "GET /api/sessions/{code} Benchmark"

run_hey "GET /api/sessions/{code} (DB read)" GET "$BASE_URL/api/sessions/$SESSION_CODE" "" "$N" "$C" "$REPORT"

log "Report: $REPORT"

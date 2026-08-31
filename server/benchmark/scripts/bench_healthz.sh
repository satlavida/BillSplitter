#!/usr/bin/env bash
# Benchmarks GET /healthz — no DB, no auth. Baseline ceiling for the
# container: everything else should be measured relative to this number,
# not to some absolute "good" req/s.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

N="${N:-20000}"
C="${C:-200}"
REPORT="${1:-$RESULTS_DIR/healthz_$(date +%Y%m%d_%H%M%S).md}"
[ -s "$REPORT" ] || report_header "$REPORT" "GET /healthz Benchmark"

run_hey "GET /healthz (baseline, no DB)" GET "$BASE_URL/healthz" "" "$N" "$C" "$REPORT"

log "Report: $REPORT"

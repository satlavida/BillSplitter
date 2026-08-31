#!/usr/bin/env bash
# Benchmarks POST .../bills/{billId}/items — a DB write, creator-authed.
# Used to climb badly as the target bill accumulated items within one run
# (requireNotSettled doing a full store.GetSession per insert) — fixed
# 2026-08-31 via store.GetSessionGate, see README.md "Known findings".
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh
[ -f "$BENCH_DIR/.seed.env" ] || die "run seed.sh first"
source "$BENCH_DIR/.seed.env"

N="${N:-900}"
C="${C:-30}"
REPORT="${1:-$RESULTS_DIR/add_item_$(date +%Y%m%d_%H%M%S).md}"
[ -s "$REPORT" ] || report_header "$REPORT" "POST .../items Benchmark"

run_hey "POST .../bills/{billId}/items (DB write, same bill — growth effect included)" \
  POST "$BASE_URL/api/sessions/$SESSION_CODE/bills/$BILL_ID/items" \
  '{"name":"Item","price":100,"quantity":1}' "$N" "$C" "$REPORT" \
  -H "X-Creator-Token: $CREATOR_TOKEN"

log "Report: $REPORT"

#!/usr/bin/env bash
# Benchmarks POST .../items/{itemId}/claims — the hottest live-collaboration
# write (every item tap during joint editing). Repeats an upsert claim by
# the same person on the same seeded item (ClaimItemFreeSelect is
# idempotent on (item_id, person_id), see store.go), so this measures
# steady-state claim cost, not a growing-item effect.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh
[ -f "$BENCH_DIR/.seed.env" ] || die "run seed.sh first"
source "$BENCH_DIR/.seed.env"

N="${N:-2000}"
C="${C:-50}"
REPORT="${1:-$RESULTS_DIR/claim_item_$(date +%Y%m%d_%H%M%S).md}"
[ -s "$REPORT" ] || report_header "$REPORT" "POST .../items/{itemId}/claims Benchmark"

run_hey "POST .../items/{itemId}/claims (DB write)" POST \
  "$BASE_URL/api/sessions/$SESSION_CODE/bills/$BILL_ID/items/$ITEM_ID/claims" \
  "{\"personId\":\"$PERSON_ID\",\"value\":1}" "$N" "$C" "$REPORT"

log "Report: $REPORT"

#!/usr/bin/env bash
# Full benchmark suite: setup -> seed -> every bench_*.sh -> one combined
# markdown report in results/. Container is left running afterwards for
# follow-up ad-hoc runs (curl, individual bench_*.sh) — pass --teardown to
# stop it when the suite finishes.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

TEARDOWN=0
[ "${1:-}" = "--teardown" ] && TEARDOWN=1

REPORT="$RESULTS_DIR/full_run_$(date +%Y%m%d_%H%M%S).md"
mkdir -p "$RESULTS_DIR"

./setup.sh
./seed.sh

report_header "$REPORT" "BillSplitter Server — Full Benchmark Run"

./bench_healthz.sh "$REPORT"
./bench_read_session.sh "$REPORT"
./bench_join.sh "$REPORT"
./bench_add_item.sh "$REPORT"
./bench_claim_item.sh "$REPORT"
./bench_realistic_item_load.sh "$REPORT"

{
  echo "## Resource cap summary"
  echo
  echo "Ran the whole suite inside a single container capped at ${CPUS} CPU /"
  echo "${MEMORY} RAM. See each section above for the container snapshot"
  echo "taken immediately after that endpoint's run."
} >>"$REPORT"

log "Full report written to $REPORT"

if [ "$TEARDOWN" -eq 1 ]; then
  ./teardown.sh
else
  log "Container '$CONTAINER_NAME' left running on $BASE_URL — run ./teardown.sh when done"
fi

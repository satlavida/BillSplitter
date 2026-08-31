#!/usr/bin/env bash
# Shared helpers for the benchmark scripts. Sourced, not executed directly:
#   source "$(dirname "$0")/lib.sh"
#
# Config is all env-overridable so a caller can point at a different cap,
# port, or container without editing scripts:
#   CPUS, MEMORY, PORT, CONTAINER_NAME, IMAGE_NAME

: "${CPUS:=1}"
: "${MEMORY:=512m}"
: "${PORT:=18080}"
: "${CONTAINER_NAME:=billsplitter-benchmark}"
: "${IMAGE_NAME:=billsplitter-server-benchmark}"
BASE_URL="http://localhost:${PORT}"

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$(dirname "$BENCH_DIR")"
RESULTS_DIR="$BENCH_DIR/results"

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_cmds() {
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "'$c' is required but not installed"
  done
}

# docker_stats_line — one-line CPU%/MEM snapshot of the benchmark container,
# for embedding after a run so the report shows what the run actually cost
# against the cap, not just latency numbers.
docker_stats_line() {
  docker stats --no-stream --format '{{.CPUPerc}} CPU, {{.MemUsage}} ({{.MemPerc}})' "$CONTAINER_NAME" 2>/dev/null || echo "n/a"
}

# run_hey NAME METHOD URL BODY N C REPORT_FILE [EXTRA_HEY_ARGS...]
#
# Runs `hey`, parses its text summary, and appends a markdown section to
# REPORT_FILE. BODY may be "" for GET. EXTRA_HEY_ARGS lets a caller pass
# extra -H headers etc.
run_hey() {
  local name="$1" method="$2" url="$3" body="$4" n="$5" c="$6" report="$7"
  shift 7
  local extra_args=("$@")

  local hey_args=(-n "$n" -c "$c" -m "$method")
  if [ -n "$body" ]; then
    hey_args+=(-H "Content-Type: application/json" -d "$body")
  fi
  # ${arr[@]+"${arr[@]}"} rather than "${arr[@]}" — bash 3.2 (macOS default)
  # treats expanding an empty array under `set -u` as an unbound-variable
  # error; this idiom short-circuits to nothing when the array is empty.
  hey_args+=(${extra_args[@]+"${extra_args[@]}"})

  log "Running: $name ($method $url, n=$n c=$c)"
  local raw
  raw="$(hey "${hey_args[@]}" "$url" 2>&1)"

  # `|| true` on every extraction below: a regex not matching (format
  # drift in a future `hey` version) must degrade to "n/a" in the report,
  # not kill the whole run under `set -e` — the last command in each pipe
  # exiting 1 on no-match would otherwise abort the script.
  local total slowest fastest average rps
  total=$(echo "$raw" | grep -oE 'Total:[[:space:]]+[0-9.]+ secs' | grep -oE '[0-9.]+' || true)
  slowest=$(echo "$raw" | grep -oE 'Slowest:[[:space:]]+[0-9.]+ secs' | grep -oE '[0-9.]+' || true)
  fastest=$(echo "$raw" | grep -oE 'Fastest:[[:space:]]+[0-9.]+ secs' | grep -oE '[0-9.]+' || true)
  average=$(echo "$raw" | grep -oE 'Average:[[:space:]]+[0-9.]+ secs' | grep -oE '[0-9.]+' || true)
  rps=$(echo "$raw" | grep -oE 'Requests/sec:[[:space:]]+[0-9.]+' | grep -oE '[0-9.]+$' || true)

  local p50 p90 p95 p99
  p50=$(echo "$raw" | grep -E '^[[:space:]]*50%+ in' | grep -oE '[0-9.]+ secs' | grep -oE '[0-9.]+' || true)
  p90=$(echo "$raw" | grep -E '^[[:space:]]*90%+ in' | grep -oE '[0-9.]+ secs' | grep -oE '[0-9.]+' || true)
  p95=$(echo "$raw" | grep -E '^[[:space:]]*95%+ in' | grep -oE '[0-9.]+ secs' | grep -oE '[0-9.]+' || true)
  p99=$(echo "$raw" | grep -E '^[[:space:]]*99%+ in' | grep -oE '[0-9.]+ secs' | grep -oE '[0-9.]+' || true)

  local status_lines
  status_lines=$(echo "$raw" | grep -E '^\s*\[[0-9]{3}\]' | sed -E 's/^\s*\[([0-9]{3})\]\s+([0-9]+) responses/  - `\1`: \2/' || true)
  local total_reqs error_reqs
  total_reqs=$(echo "$raw" | grep -E '^\s*\[[0-9]{3}\]' | grep -oE '[0-9]+ responses' | grep -oE '^[0-9]+' | awk '{s+=$1} END{print s+0}' || true)
  error_reqs=$(echo "$raw" | grep -E '^\s*\[[0-9]{3}\]' | grep -vE '^\s*\[2[0-9]{2}\]' | grep -oE '[0-9]+ responses' | grep -oE '^[0-9]+' | awk '{s+=$1} END{print s+0}' || true)

  local stats
  stats="$(docker_stats_line)"

  {
    echo "### $name"
    echo
    echo "\`$method $url\` — $n requests, $c concurrent"
    echo
    echo "| Metric | Value |"
    echo "|---|---|"
    echo "| Requests/sec | ${rps:-n/a} |"
    echo "| Avg latency | ${average:-n/a}s |"
    echo "| p50 | ${p50:-n/a}s |"
    echo "| p90 | ${p90:-n/a}s |"
    echo "| p95 | ${p95:-n/a}s |"
    echo "| p99 | ${p99:-n/a}s |"
    echo "| Fastest / Slowest | ${fastest:-n/a}s / ${slowest:-n/a}s |"
    echo "| Total wall time | ${total:-n/a}s |"
    echo "| Errors | ${error_reqs:-0} / ${total_reqs:-$n} |"
    echo "| Container after run | $stats |"
    echo
    echo "Status codes:"
    echo "$status_lines"
    echo
  } >>"$report"

  log "  -> ${rps:-?} req/s, p50=${p50:-?}s p99=${p99:-?}s, errors=${error_reqs:-0}"
}

report_header() {
  local report="$1" title="$2"
  local git_sha
  git_sha="$(cd "$SERVER_DIR" && git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  {
    echo "# $title"
    echo
    echo "- Date: $(date '+%Y-%m-%d %H:%M %Z')"
    echo "- Git commit: \`$git_sha\`"
    echo "- Container cap: ${CPUS} CPU / ${MEMORY} RAM (\`docker run --cpus=${CPUS} --memory=${MEMORY}\`)"
    echo "- Base URL: $BASE_URL"
    echo
  } >"$report"
}

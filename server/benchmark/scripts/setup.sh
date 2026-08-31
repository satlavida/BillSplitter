#!/usr/bin/env bash
# Builds the benchmark image and starts it resource-capped in the
# background. Safe to re-run — removes any prior container of the same
# name first. See README.md for CPUS/MEMORY/PORT overrides.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh
require_cmds docker curl

log "Building $IMAGE_NAME from benchmark/Dockerfile (context: server/)"
docker build -f "$BENCH_DIR/Dockerfile" -t "$IMAGE_NAME" "$SERVER_DIR" >/dev/null

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

log "Starting $CONTAINER_NAME capped at ${CPUS} CPU / ${MEMORY}, mapped to :$PORT"
docker run -d --name "$CONTAINER_NAME" \
  --cpus="$CPUS" --memory="$MEMORY" --memory-swap="$MEMORY" \
  -p "${PORT}:8080" \
  -e ALLOWED_ORIGINS="http://localhost:5173" \
  "$IMAGE_NAME" >/dev/null

log "Waiting for /healthz..."
for _ in $(seq 1 30); do
  if curl -sf "$BASE_URL/healthz" >/dev/null 2>&1; then
    log "Server is up at $BASE_URL"
    exit 0
  fi
  sleep 1
done
die "server did not become healthy in time — check 'docker logs $CONTAINER_NAME'"

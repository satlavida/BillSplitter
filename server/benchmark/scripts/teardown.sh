#!/usr/bin/env bash
# Stops and removes the benchmark container. Leaves the built image cached
# (rebuilds are fast) — pass --rmi to also remove it.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 && log "Removed $CONTAINER_NAME" || log "$CONTAINER_NAME was not running"

if [ "${1:-}" = "--rmi" ]; then
  docker rmi "$IMAGE_NAME" >/dev/null 2>&1 && log "Removed image $IMAGE_NAME" || true
fi

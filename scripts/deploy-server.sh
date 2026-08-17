#!/usr/bin/env bash
# Cross-compiles the Go live-collaboration server for the production host and
# pushes it (plus this repo's install-server.sh) up via scp. Run from
# anywhere in the repo: `npm run deploy:server` or `./scripts/deploy-server.sh`.
#
# This only stages the new binary in satyajeet's home directory — it does
# NOT touch the running service. To actually install and restart it, ssh in
# and run the install script this staged alongside it:
#
#   ssh billsplitter
#   sudo ~/deploy/install-server.sh
#
# (install-server.sh backs up the current binary to server.bak, installs the
# new one, restarts billsplitter-server.service, health-checks it, and rolls
# back automatically if the health check fails.)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_TARGET="${BILLSPLITTER_SSH_TARGET:-satyajeet@billsplitter}" # explicit user@ overrides ~/.ssh/config's stale "User root" on this alias
REMOTE_DEPLOY_DIR="deploy"

echo "==> Cross-compiling server for linux/amd64..."
VERSION="$(git -C "$REPO_ROOT" describe --tags --always --dirty 2>/dev/null || echo dev)"
BUILD_OUT="$(mktemp -t billsplitter-server-XXXXXX)"
(
  cd "$REPO_ROOT/server"
  GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
    -ldflags "-X main.version=$VERSION" \
    -o "$BUILD_OUT" ./cmd/server
)
echo "    built version $VERSION -> $BUILD_OUT"

echo "==> Staging on $SSH_TARGET:~/$REMOTE_DEPLOY_DIR ..."
ssh "$SSH_TARGET" "mkdir -p ~/$REMOTE_DEPLOY_DIR"
scp "$BUILD_OUT" "$SSH_TARGET:~/$REMOTE_DEPLOY_DIR/billsplitter-server.new"
scp "$REPO_ROOT/scripts/install-server.sh" "$SSH_TARGET:~/$REMOTE_DEPLOY_DIR/install-server.sh"
ssh "$SSH_TARGET" "chmod +x ~/$REMOTE_DEPLOY_DIR/install-server.sh"

rm -f "$BUILD_OUT"

cat <<EOF

==> Staged. To install and restart on the server, run:

    ssh $SSH_TARGET
    sudo ~/$REMOTE_DEPLOY_DIR/install-server.sh

EOF

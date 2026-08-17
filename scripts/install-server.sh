#!/usr/bin/env bash
# Installs a binary staged by deploy-server.sh (~/deploy/billsplitter-server.new)
# and restarts billsplitter-server.service, with an automatic rollback if the
# new binary fails its health check. Run ON THE SERVER, via sudo:
#
#   sudo ~/deploy/install-server.sh
#
# Also makes sure the beta frontend's origin is allowed to call this server
# (ALLOWED_ORIGINS in the systemd unit) — idempotent, only adds it once.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo: sudo $0" >&2
  exit 1
fi

DEPLOY_USER="${SUDO_USER:-$(logname 2>/dev/null || echo satyajeet)}"
DEPLOY_HOME="$(eval echo "~$DEPLOY_USER")"
NEW_BINARY="$DEPLOY_HOME/deploy/billsplitter-server.new"

APP_USER=billsplitter
APP_GROUP=billsplitter
INSTALL_DIR=/opt/billsplitter
SERVICE=billsplitter-server
UNIT_FILE=/etc/systemd/system/$SERVICE.service
BETA_ORIGIN="https://betabillsplit.satyajeetnigade.in"

if [[ ! -f "$NEW_BINARY" ]]; then
  echo "No staged binary at $NEW_BINARY — run scripts/deploy-server.sh from your dev machine first." >&2
  exit 1
fi

echo "==> Backing up current binary to server.bak"
cp -f "$INSTALL_DIR/server" "$INSTALL_DIR/server.bak"

echo "==> Installing new binary"
install -o "$APP_USER" -g "$APP_GROUP" -m 0755 "$NEW_BINARY" "$INSTALL_DIR/server"
rm -f "$NEW_BINARY"

# Idempotent: only appends the beta origin if it isn't already on the
# ALLOWED_ORIGINS line (comma-separated list, see internal/config/config.go).
if [[ -f "$UNIT_FILE" ]] && ! grep -q "$BETA_ORIGIN" "$UNIT_FILE"; then
  echo "==> Adding $BETA_ORIGIN to ALLOWED_ORIGINS"
  sed -i -E "s#^(Environment=ALLOWED_ORIGINS=)(.*)#\1\2,$BETA_ORIGIN#" "$UNIT_FILE"
  systemctl daemon-reload
fi

echo "==> Restarting $SERVICE"
systemctl restart "$SERVICE"

echo "==> Health-checking..."
HEALTHY=false
for _ in $(seq 1 10); do
  if curl -sf http://127.0.0.1:8080/healthz >/dev/null; then
    HEALTHY=true
    break
  fi
  sleep 1
done

if [[ "$HEALTHY" != true ]]; then
  echo "!! Health check failed — rolling back to server.bak" >&2
  cp -f "$INSTALL_DIR/server.bak" "$INSTALL_DIR/server"
  systemctl restart "$SERVICE"
  echo "!! Rolled back. Check: journalctl -u $SERVICE -n 100" >&2
  exit 1
fi

echo "==> Deployed successfully. $(curl -s http://127.0.0.1:8080/healthz)"

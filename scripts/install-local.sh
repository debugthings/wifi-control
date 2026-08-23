#!/bin/bash
# User-space production install (no root). Mirrors install.sh for dev/WSL
# or when you cannot write to /opt. For Proxmox LXC use install.sh as root.
set -euo pipefail

REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${WIFI_CONTROL_HOME:-$HOME/.local/opt/wifi-control}"
PORT="${WIFI_CONTROL_PORT:-3002}"
SERVICE_NAME="wifi-control"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "Building from $REPO_ROOT..."
cd "$REPO_ROOT"
npm run install:all
npm run build:deploy

log "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR/data"
rm -rf "$INSTALL_DIR/dist" "$INSTALL_DIR/public" "$INSTALL_DIR/node_modules"
cp -r backend/dist backend/public backend/node_modules backend/prisma backend/package.json "$INSTALL_DIR/"

if [ ! -f "$INSTALL_DIR/.env" ]; then
  ENCRYPTION_KEY=$(openssl rand -base64 32)
  cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="file:${INSTALL_DIR}/data/wifi-control.db"
PORT=${PORT}
NODE_ENV=production
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
EOF
  log "Created $INSTALL_DIR/.env with new ENCRYPTION_KEY"
else
  log "Keeping existing $INSTALL_DIR/.env"
fi

cd "$INSTALL_DIR"
export DATABASE_URL="file:${INSTALL_DIR}/data/wifi-control.db"
npx prisma migrate deploy

SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"
cat > "$SYSTEMD_USER_DIR/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=WiFi Control
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=$(command -v node) dist/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable "${SERVICE_NAME}.service"
systemctl --user restart "${SERVICE_NAME}.service"

log "WiFi Control running at http://127.0.0.1:${PORT}"
log "Status: systemctl --user status ${SERVICE_NAME}"

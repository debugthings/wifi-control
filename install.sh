#!/bin/bash
set -euo pipefail

REPO_URL="${WIFI_CONTROL_REPO:-https://github.com/debugthings/wifi-control.git}"
INSTALL_DIR="/opt/wifi-control"
SERVICE_USER="wifi-control"
PORT=3002

log() { echo "[$(date '+%H:%M:%S')] $*"; }
die() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root inside the LXC container"
  exit 1
fi

log "Installing dependencies..."
apt-get update
apt-get install -y curl git build-essential sqlite3 openssl

if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

log "Cloning repository..."
BUILD_DIR=$(mktemp -d)
git clone --depth 1 "$REPO_URL" "$BUILD_DIR"

cd "$BUILD_DIR"
npm run install:all
npm run build:deploy

log "Creating service user..."
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd -r -s /bin/false "$SERVICE_USER"

mkdir -p "$INSTALL_DIR/data"
rm -rf "$INSTALL_DIR/dist" "$INSTALL_DIR/public" "$INSTALL_DIR/node_modules" "$INSTALL_DIR/prisma"
cp -r backend/dist backend/public backend/node_modules backend/prisma backend/package.json "$INSTALL_DIR/"

# Keep existing ENCRYPTION_KEY on reinstall
if [[ -f "$INSTALL_DIR/.env" ]] && grep -q '^ENCRYPTION_KEY=' "$INSTALL_DIR/.env"; then
  ENCRYPTION_KEY="$(grep '^ENCRYPTION_KEY=' "$INSTALL_DIR/.env" | cut -d= -f2- | tr -d '"')"
else
  ENCRYPTION_KEY="$(openssl rand -base64 32)"
fi

# Prisma SQLite absolute URL: file:/path (same pattern as timer-app)
cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="file:${INSTALL_DIR}/data/wifi-control.db"
PORT=${PORT}
HOST=0.0.0.0
NODE_ENV=production
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
EOF

cd "$INSTALL_DIR"
export DATABASE_URL="file:${INSTALL_DIR}/data/wifi-control.db"
npx prisma generate
npx prisma migrate deploy

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

cat > /etc/systemd/system/wifi-control.service <<EOF
[Unit]
Description=WiFi Control
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=HOST=0.0.0.0
Environment=DATABASE_URL=file:${INSTALL_DIR}/data/wifi-control.db
Environment=ENCRYPTION_KEY=${ENCRYPTION_KEY}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable wifi-control
systemctl restart wifi-control

sleep 2
if ! systemctl is-active --quiet wifi-control; then
  journalctl -u wifi-control -n 40 --no-pager || true
  die "wifi-control.service failed to start"
fi

if ! curl -fsS "http://127.0.0.1:${PORT}/api/auth/settings" >/dev/null; then
  journalctl -u wifi-control -n 40 --no-pager || true
  die "Service is up but not answering on :${PORT}"
fi

CT_IP="$(hostname -I | awk '{print $1}')"
log "WiFi Control installed at http://${CT_IP}:${PORT}"
rm -rf "$BUILD_DIR"

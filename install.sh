#!/bin/bash
set -euo pipefail

REPO_URL="${WIFI_CONTROL_REPO:-https://github.com/debugthings/wifi-control.git}"
INSTALL_DIR="/opt/wifi-control"
SERVICE_USER="wifi-control"
PORT=3002

log() { echo "[$(date '+%H:%M:%S')] $*"; }

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
cp -r backend/dist backend/public backend/node_modules backend/prisma backend/package.json "$INSTALL_DIR/"

ENCRYPTION_KEY=$(openssl rand -base64 32)
cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="file:${INSTALL_DIR}/data/wifi-control.db"
PORT=${PORT}
NODE_ENV=production
ENCRYPTION_KEY="${ENCRYPTION_KEY}"
EOF

cd "$INSTALL_DIR"
export DATABASE_URL="file:${INSTALL_DIR}/data/wifi-control.db"
npx prisma migrate deploy

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

cat > /etc/systemd/system/wifi-control.service <<EOF
[Unit]
Description=WiFi Control
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
EnvironmentFile=${INSTALL_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable wifi-control
systemctl restart wifi-control

log "WiFi Control installed at http://$(hostname -I | awk '{print $1}'):${PORT}"
rm -rf "$BUILD_DIR"

#!/bin/bash
REPO_URL="${WIFI_CONTROL_REPO:-https://github.com/debugthings/wifi-control.git}"
BUILD_DIR="/tmp/wifi-control-build"
DEPLOY_DIR="/opt/wifi-control"
BRANCH="${WIFI_CONTROL_BRANCH:-main}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

if [ ! -f "$DEPLOY_DIR/.auto-update-enabled" ]; then
  log "Auto-update disabled. touch $DEPLOY_DIR/.auto-update-enabled to enable."
  exit 0
fi

set -e
rm -rf "$BUILD_DIR"
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$BUILD_DIR"
cd "$BUILD_DIR"
npm run install:all
npm run build:deploy

systemctl stop wifi-control || true
rm -rf "$DEPLOY_DIR/dist" "$DEPLOY_DIR/public"
cp -r backend/dist backend/public backend/node_modules backend/prisma "$DEPLOY_DIR/"
cp backend/package.json "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
export DATABASE_URL="file:${DEPLOY_DIR}/data/wifi-control.db"
npx prisma migrate deploy
chown -R wifi-control:wifi-control "$DEPLOY_DIR"
systemctl start wifi-control
rm -rf "$BUILD_DIR"
log "Deployment complete"

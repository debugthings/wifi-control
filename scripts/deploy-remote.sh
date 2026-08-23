#!/bin/bash
# Deploy wifi-control to a remote Debian/Proxmox LXC over SSH.
# Usage: ./deploy-remote.sh root@timerinternal
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 user@host" >&2
  exit 1
fi

TARGET="$1"
REPO_URL="${WIFI_CONTROL_REPO:-https://github.com/debugthings/wifi-control.git}"
REMOTE_DIR="/tmp/wifi-control-install"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "Deploying to ${TARGET}..."
ssh "$TARGET" "rm -rf '$REMOTE_DIR' && git clone --depth 1 '$REPO_URL' '$REMOTE_DIR'"
ssh "$TARGET" "cd '$REMOTE_DIR' && bash install.sh"
ssh "$TARGET" "rm -rf '$REMOTE_DIR'"

log "Deployed. Verify: ssh ${TARGET} 'systemctl status wifi-control && curl -s http://127.0.0.1:3002/api/auth/settings'"

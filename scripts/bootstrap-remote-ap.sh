#!/bin/bash
# Bootstrap an OpenWRT AP over SSH from your workstation or LXC.
# Usage: ./bootstrap-remote-ap.sh root@192.168.1.1
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 user@ap-host" >&2
  exit 1
fi

AP_SSH="$1"
REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/tmp/wifi-control-openwrt"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "Copying openwrt/ to ${AP_SSH}:${REMOTE_DIR}..."
ssh "$AP_SSH" "rm -rf '$REMOTE_DIR' && mkdir -p '$REMOTE_DIR'"
scp -r "$REPO_ROOT/openwrt/" "${AP_SSH}:${REMOTE_DIR}/"

log "Running bootstrap-ap.sh on AP..."
ssh "$AP_SSH" "cd '${REMOTE_DIR}/scripts' && chmod +x bootstrap-ap.sh wifi-iface-toggle.sh && ./bootstrap-ap.sh"

log "Bootstrap complete. Save the wifi-control password printed above."

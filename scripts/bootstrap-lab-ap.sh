#!/bin/bash
# Install mock ubus + save lab AP credentials for configure-initial.sh
set -euo pipefail

REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CREDS="$HOME/.local/opt/wifi-control/lab-ap.env"
MOCK_USER="${MOCK_UBUS_USER:-wifi-control}"
MOCK_PASS="${MOCK_UBUS_PASS:-testpass123}"
MOCK_PORT="${MOCK_UBUS_PORT:-8080}"
NODE_BIN="$(command -v node)"

mkdir -p "$(dirname "$CREDS")"
cat > "$CREDS" <<EOF
# Lab mock AP credentials (mock-ubus-server.mjs)
export WIFI_CONTROL_AP_HOST=127.0.0.1:${MOCK_PORT}
export WIFI_CONTROL_AP_USER=${MOCK_USER}
export WIFI_CONTROL_AP_PASS=${MOCK_PASS}
EOF

chmod 600 "$CREDS"

# Validate OpenWRT bootstrap script syntax
bash -n "$REPO_ROOT/openwrt/scripts/bootstrap-ap.sh"
bash -n "$REPO_ROOT/openwrt/scripts/wifi-iface-toggle.sh"

# Install mock ubus user service
mkdir -p "$HOME/.config/systemd/user"
sed -e "s|%h|$HOME|g" -e "s|/usr/bin/node|$NODE_BIN|g" \
  "$REPO_ROOT/deploy/systemd/mock-ubus.service" > "$HOME/.config/systemd/user/mock-ubus.service"
systemctl --user daemon-reload
systemctl --user enable mock-ubus.service
systemctl --user restart mock-ubus.service

echo "Mock AP bootstrap complete."
echo "Credentials saved to $CREDS"
echo "For real OpenWRT APs run: scripts/bootstrap-remote-ap.sh root@<ap-ip>"

#!/bin/bash
# Initial UI/API setup via curl. Requires wifi-control running locally or remotely.
set -euo pipefail

BASE_URL="${WIFI_CONTROL_URL:-http://127.0.0.1:3002}"
PIN="${WIFI_CONTROL_PIN:-1234}"
AP_ID="${WIFI_CONTROL_AP_ID:-lab-ap}"
AP_NAME="${WIFI_CONTROL_AP_NAME:-Lab AP}"
AP_HOST="${WIFI_CONTROL_AP_HOST:-127.0.0.1}"
AP_USER="${WIFI_CONTROL_AP_USER:-wifi-control}"
AP_PASS="${WIFI_CONTROL_AP_PASS:?Set WIFI_CONTROL_AP_PASS}"

json() { curl -sf -H 'Content-Type: application/json' "$@"; }

echo "==> Checking service at $BASE_URL"
json "$BASE_URL/api/auth/settings"

echo
echo "==> Setting PIN"
json -X POST "$BASE_URL/api/auth/set-pin" -d "{\"newPin\":\"$PIN\"}"

echo
echo "==> Adding access point $AP_ID"
json -X POST "$BASE_URL/api/access-points" \
  -H "x-admin-pin: $PIN" \
  -d "{\"id\":\"$AP_ID\",\"name\":\"$AP_NAME\",\"host\":\"$AP_HOST\",\"ubusUsername\":\"$AP_USER\",\"ubusPassword\":\"$AP_PASS\"}"

echo
echo "==> Testing AP connection"
json -X POST "$BASE_URL/api/access-points/$AP_ID/test" -H "x-admin-pin: $PIN"

echo
echo "==> Discovering SSIDs"
DISCOVER=$(json -X POST "$BASE_URL/api/access-points/$AP_ID/discover" -H "x-admin-pin: $PIN")
echo "$DISCOVER"

SECTION=$(echo "$DISCOVER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ifaces'][0]['section'] if d.get('ifaces') else '')" 2>/dev/null || true)
SSID=$(echo "$DISCOVER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['ifaces'][0].get('ssid','') if d.get('ifaces') else '')" 2>/dev/null || true)

if [ -n "$SECTION" ]; then
  NET_ID="${AP_ID}-${SECTION}"
  LABEL="${SSID:-$SECTION}"
  echo
  echo "==> Adding network $NET_ID ($LABEL)"
  json -X POST "$BASE_URL/api/networks" \
    -H "x-admin-pin: $PIN" \
    -d "{\"id\":\"$NET_ID\",\"accessPointId\":\"$AP_ID\",\"label\":\"$LABEL\",\"uciSection\":\"$SECTION\",\"ssid\":\"$SSID\"}"
fi

echo
echo "Setup complete. Open $BASE_URL and log in with PIN $PIN"

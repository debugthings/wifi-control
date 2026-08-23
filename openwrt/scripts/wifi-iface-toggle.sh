#!/bin/sh
# Toggle a wifi-iface section on or off and reload its radio.
# Used by cron jobs on the AP.

SECTION="$1"
ACTION="$2"

if [ -z "$SECTION" ] || [ -z "$ACTION" ]; then
  echo "Usage: $0 <uci-section> <on|off>" >&2
  exit 1
fi

case "$ACTION" in
  off|OFF|0) DISABLED=1 ;;
  on|ON|1)   DISABLED=0 ;;
  *)
    echo "Action must be on or off" >&2
    exit 1
    ;;
esac

uci -q set "wireless.${SECTION}.disabled=${DISABLED}"
uci commit wireless

RADIO="$(uci -q get "wireless.${SECTION}.device")"
if [ -n "$RADIO" ]; then
  wifi reload "$RADIO"
else
  wifi reload
fi

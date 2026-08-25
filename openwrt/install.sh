#!/bin/sh
# One-liner OpenWrt AP bootstrap (no local copy needed).
# Run as root on the AP:
#   wget -qO- https://raw.githubusercontent.com/debugthings/wifi-control/main/openwrt/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/debugthings/wifi-control/main/openwrt/install.sh | sh

set -e

UBUS_USER="wifi-control"
TOGGLE_DEST="/usr/local/bin/wifi-iface-toggle"
ACL_DEST="/usr/share/rpcd/acl.d/wifi-control.json"
REPO_RAW="${WIFI_CONTROL_RAW:-https://raw.githubusercontent.com/debugthings/wifi-control/main}"

pkg_update() {
  if command -v apk >/dev/null 2>&1; then
    apk update
  elif command -v opkg >/dev/null 2>&1; then
    opkg update
  else
    echo "Neither apk nor opkg found." >&2
    exit 1
  fi
}

pkg_install() {
  if command -v apk >/dev/null 2>&1; then
    apk add "$@"
  elif command -v opkg >/dev/null 2>&1; then
    opkg install "$@"
  else
    echo "Neither apk nor opkg found." >&2
    exit 1
  fi
}

fetch() {
  # fetch <url> <dest>
  if command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  elif command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2"
  else
    echo "Need wget or curl to download helper files." >&2
    exit 1
  fi
}

echo "==> Installing packages..."
pkg_update
pkg_install uhttpd-mod-ubus rpcd rpcd-mod-file rpcd-mod-uci

# openssl used for password hash (usually present; install if missing)
if ! command -v openssl >/dev/null 2>&1; then
  pkg_install openssl-util 2>/dev/null || pkg_install openssl || true
fi

echo "==> Installing toggle script..."
mkdir -p "$(dirname "$TOGGLE_DEST")"
fetch "${REPO_RAW}/openwrt/scripts/wifi-iface-toggle.sh" "$TOGGLE_DEST"
chmod 755 "$TOGGLE_DEST"

echo "==> Installing rpcd ACL..."
mkdir -p "$(dirname "$ACL_DEST")"
fetch "${REPO_RAW}/openwrt/acl.d/wifi-control.json" "$ACL_DEST"
chmod 644 "$ACL_DEST"

if ! uci -q get rpcd."@${UBUS_USER}[0]" >/dev/null 2>&1; then
  PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"
  uci add rpcd login
  uci set "rpcd.@login[-1].username=${UBUS_USER}"
  uci set "rpcd.@login[-1].password=\$1\$\$$(openssl passwd -1 "$PASS")"
  uci add_list "rpcd.@login[-1].read=wifi-control"
  uci add_list "rpcd.@login[-1].write=wifi-control"
  uci commit rpcd
  echo ""
  echo "Created rpcd user: ${UBUS_USER}"
  echo "Password (save this): ${PASS}"
  echo ""
else
  echo "rpcd user ${UBUS_USER} already exists — skipping user creation"
fi

/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart

LAN_IP="$(uci -q get network.lan.ipaddr 2>/dev/null || true)"
echo "==> Bootstrap complete."
echo "Add this AP in the wifi-control admin UI with host ${LAN_IP:-<lan-ip>}"
echo "  username: ${UBUS_USER}"

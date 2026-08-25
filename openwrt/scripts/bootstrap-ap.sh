#!/bin/sh
# One-time bootstrap for an OpenWRT AP.
# Run as root on the AP (via SSH or serial console).
#
# Package manager: apk on OpenWrt 25.12+, opkg on 24.10 and older.

set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
ACL_FILE="${SCRIPT_DIR}/../acl.d/wifi-control.json"
TOGGLE_SRC="${SCRIPT_DIR}/wifi-iface-toggle.sh"
UBUS_USER="wifi-control"
TOGGLE_DEST="/usr/local/bin/wifi-iface-toggle"

pkg_update() {
  if command -v apk >/dev/null 2>&1; then
    apk update
  elif command -v opkg >/dev/null 2>&1; then
    opkg update
  else
    echo "Neither apk nor opkg found. Install packages manually." >&2
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

echo "==> Installing packages..."
pkg_update
# OpenWrt 25.12+: UCI is built into rpcd (rpcd-mod-uci removed).
# Optionally install rpcd-mod-uci on older releases that still ship it.
pkg_install uhttpd-mod-ubus rpcd rpcd-mod-file
if command -v apk >/dev/null 2>&1; then
  apk add rpcd-mod-uci >/dev/null 2>&1 || true
elif command -v opkg >/dev/null 2>&1; then
  opkg install rpcd-mod-uci >/dev/null 2>&1 || true
fi

echo "==> Installing toggle script..."
install -m 755 "$TOGGLE_SRC" "$TOGGLE_DEST"

echo "==> Installing rpcd ACL..."
install -m 644 "$ACL_FILE" /usr/share/rpcd/acl.d/wifi-control.json

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

echo "==> Bootstrap complete."
echo "Add this AP in the admin UI with host $(uci -q get network.lan.ipaddr 2>/dev/null || hostname -I | awk '{print $1}')"

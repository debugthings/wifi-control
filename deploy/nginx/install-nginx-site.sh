#!/bin/bash
# Install NGINX site config on a Debian/Ubuntu proxy host.
# Usage: sudo ./install-nginx-site.sh [upstream-host:port]
set -euo pipefail

UPSTREAM="${1:-127.0.0.1:3002}"
REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
SITE="wifi.debugthings.com"
CONF="/etc/nginx/sites-available/${SITE}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root on the NGINX proxy host" >&2
  exit 1
fi

sed "s|127.0.0.1:3002|${UPSTREAM}|g" \
  "$REPO_ROOT/deploy/nginx/wifi.debugthings.com.conf" > "$CONF"

ln -sf "$CONF" "/etc/nginx/sites-enabled/${SITE}"
nginx -t
systemctl reload nginx

echo "NGINX configured for ${SITE} -> ${UPSTREAM}"
echo "Run: certbot --nginx -d ${SITE}"

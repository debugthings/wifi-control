# WiFi Control

Self-hosted web app to toggle OpenWRT WiFi SSIDs across multiple access points and manage per-SSID cron schedules. Uses ubus JSON-RPC over HTTP from a central Node service.

## Features

- Quick on/off toggles for individual SSIDs (`wifi-iface` sections)
- Per-SSID schedule (cron) with day-of-week selection
- Simple PIN login (bcrypt)
- Multi-AP support via scoped rpcd users
- Proxmox LXC deployment (timer-app pattern)

## Architecture

- **Frontend**: React, TypeScript, Tailwind, Vite
- **Backend**: Node 20, Express, Prisma, SQLite
- **AP control**: ubus JSON-RPC (`uhttpd-mod-ubus`) with rpcd ACL

## Development

```bash
npm run install:all
cd backend && cp .env.example .env && npx prisma migrate dev
npm run dev:backend   # terminal 1 — port 3002
npm run dev:frontend  # terminal 2 — port 5173
```

## OpenWRT AP setup

On each AP (as root), one-liner:

```sh
wget -qO- https://raw.githubusercontent.com/debugthings/wifi-control/main/openwrt/install.sh | sh
```

Or with curl:

```sh
curl -fsSL https://raw.githubusercontent.com/debugthings/wifi-control/main/openwrt/install.sh | sh
```

Save the generated `wifi-control` password. In the admin UI, add the AP with its LAN IP and credentials.

Offline / local copy alternative: copy `openwrt/` to the AP and run `./scripts/bootstrap-ap.sh`.


## Production build

```bash
npm run build:deploy
cd backend && npx prisma migrate deploy && npm start
```

## Proxmox deployment

**Recommended (disaster recovery one-liner on Proxmox host):**

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/debugthings/proxmox-apps/main/ct/timer-app.sh)"
```

Or manually inside a Debian LXC:

```bash
git clone https://github.com/debugthings/wifi-control.git /tmp/wifi-control
cd /tmp/wifi-control
bash install.sh
```

Or from your workstation if the LXC is SSH-reachable:

```bash
./scripts/deploy-remote.sh root@your-lxc-host
```

For WSL/local user-space install (no root):

```bash
./scripts/install-local.sh
systemctl --user status wifi-control   # http://127.0.0.1:3002
```

Service listens on port **3002**. Optional NGINX reverse proxy to your domain (see below).

## NGINX / HTTPS (wifi.debugthings.com)

On your edge proxy host:

```bash
sudo ./deploy/nginx/install-nginx-site.sh 10.x.x.x:3002   # LXC IP
sudo certbot --nginx -d wifi.debugthings.com
```

Config template: [`deploy/nginx/wifi.debugthings.com.conf`](deploy/nginx/wifi.debugthings.com.conf)

## OpenWRT AP bootstrap

On each AP (as root):

```sh
wget -qO- https://raw.githubusercontent.com/debugthings/wifi-control/main/openwrt/install.sh | sh
```

Or from your workstation over SSH (copies `openwrt/` then runs local bootstrap):

```bash
./scripts/bootstrap-remote-ap.sh root@192.168.1.1
```

For local lab testing without hardware:

```bash
./scripts/bootstrap-lab-ap.sh          # starts mock ubus on :8080
source ~/.local/opt/wifi-control/lab-ap.env
./scripts/configure-initial.sh         # PIN 1234, adds lab AP + TestNet SSID
```

## API

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/networks` | none | SSID status (live from APs) |
| `POST /api/networks/:id/toggle` | PIN | Enable/disable SSID |
| `PUT /api/schedules/:networkId` | PIN | Save schedule + update AP cron |
| `POST /api/access-points/:id/discover` | PIN | List wifi-iface sections |

Send PIN as `x-admin-pin` header on protected routes.

## Security

- Keep `/ubus` LAN-only on APs
- Use HTTPS via reverse proxy for the web UI
- Rotate rpcd `wifi-control` passwords if compromised
- Set a strong `ENCRYPTION_KEY` in production `.env`

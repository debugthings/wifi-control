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

On each AP (as root):

```bash
# Copy openwrt/ folder to the AP, then:
cd openwrt/scripts
chmod +x bootstrap-ap.sh wifi-iface-toggle.sh
./bootstrap-ap.sh
```

Save the generated `wifi-control` password. In the admin UI, add the AP with its LAN IP and credentials.

## Production build

```bash
npm run build:deploy
cd backend && npx prisma migrate deploy && npm start
```

## Proxmox deployment

```bash
bash install.sh   # inside a Debian LXC container
```

Service listens on port **3002**. Optional NGINX reverse proxy to your domain.

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

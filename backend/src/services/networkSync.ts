import { AccessPoint, PrismaClient } from '@prisma/client';
import {
  discoverWifiIfaces,
  WifiIfaceInfo,
} from './openwrt';
import { toAccessPointConfig } from './accessPointHelpers';

const SKIP_MODES = new Set(['sta', 'mesh', 'adhoc', 'monitor']);

export function isControllableWifiIface(iface: WifiIfaceInfo): boolean {
  const mode = (iface.mode || 'ap').toLowerCase();
  return !SKIP_MODES.has(mode);
}

export function filterControllableIfaces(
  ifaces: WifiIfaceInfo[]
): WifiIfaceInfo[] {
  return ifaces.filter(isControllableWifiIface);
}

export function slugifyId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'ap';
}

export interface SyncResult {
  added: number;
  updated: number;
  ifaces: WifiIfaceInfo[];
  skipped: number;
}

export async function syncNetworksFromAp(
  prisma: PrismaClient,
  accessPoint: AccessPoint,
  ifaces?: WifiIfaceInfo[]
): Promise<SyncResult> {
  const discovered =
    ifaces ??
    (await discoverWifiIfaces(toAccessPointConfig(accessPoint)));
  const controllable = filterControllableIfaces(discovered);
  const skipped = discovered.length - controllable.length;

  let added = 0;
  let updated = 0;

  for (const iface of controllable) {
    const id = `${accessPoint.id}-${iface.section}`;
    const defaultLabel = iface.ssid || iface.section;
    const existing = await prisma.network.findUnique({
      where: {
        accessPointId_uciSection: {
          accessPointId: accessPoint.id,
          uciSection: iface.section,
        },
      },
    });

    if (!existing) {
      await prisma.network.create({
        data: {
          id,
          accessPointId: accessPoint.id,
          label: defaultLabel,
          uciSection: iface.section,
          ssid: iface.ssid ?? null,
        },
      });
      added += 1;
      continue;
    }

    const preserveLabel =
      existing.label !== existing.ssid &&
      existing.label !== existing.uciSection;

    await prisma.network.update({
      where: { id: existing.id },
      data: {
        ssid: iface.ssid ?? null,
        ...(preserveLabel ? {} : { label: defaultLabel }),
      },
    });
    updated += 1;
  }

  return { added, updated, ifaces: discovered, skipped };
}

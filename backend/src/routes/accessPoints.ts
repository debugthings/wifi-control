import express from 'express';
import { prisma } from '../index';
import { requirePin } from '../middleware/pinAuth';
import { encrypt } from '../utils/encryption';
import { paramId } from '../utils/params';
import { testConnection, discoverWifiIfaces } from '../services/openwrt';
import {
  sanitizeAccessPoint,
  toAccessPointConfig,
} from '../services/accessPointHelpers';
import {
  slugifyId,
  syncNetworksFromAp,
} from '../services/networkSync';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const accessPoints = await prisma.accessPoint.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(accessPoints.map(sanitizeAccessPoint));
  } catch (error) {
    console.error('List APs error:', error);
    res.status(500).json({ error: 'Failed to list access points' });
  }
});

router.post('/', requirePin, async (req, res) => {
  const { id, name, host, ubusUsername, ubusPassword, ubusUrl, useHttps } =
    req.body as {
      id?: string;
      name?: string;
      host?: string;
      ubusUsername?: string;
      ubusPassword?: string;
      ubusUrl?: string;
      useHttps?: boolean;
    };

  if (!name || !host || !ubusUsername || !ubusPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apId = (id && id.trim()) || slugifyId(name);

  try {
    const accessPoint = await prisma.accessPoint.create({
      data: {
        id: apId,
        name,
        host,
        ubusUsername,
        ubusPassword: encrypt(ubusPassword),
        ubusUrl: ubusUrl || '/ubus',
        useHttps: !!useHttps,
      },
    });

    let sync:
      | { added: number; updated: number; skipped: number; ifaces: unknown[] }
      | undefined;
    let syncError: string | undefined;

    try {
      const result = await syncNetworksFromAp(prisma, accessPoint);
      sync = {
        added: result.added,
        updated: result.updated,
        skipped: result.skipped,
        ifaces: result.ifaces,
      };
    } catch (error) {
      syncError =
        error instanceof Error ? error.message : 'SSID discovery failed';
      console.error('AP create sync error:', error);
    }

    res.status(201).json({
      ...sanitizeAccessPoint(accessPoint),
      sync,
      syncError,
    });
  } catch (error) {
    console.error('Create AP error:', error);
    res.status(500).json({ error: 'Failed to create access point' });
  }
});

router.put('/:id', requirePin, async (req, res) => {
  const id = paramId(req);
  const { name, host, ubusUsername, ubusPassword, ubusUrl, useHttps, enabled } =
    req.body as {
      name?: string;
      host?: string;
      ubusUsername?: string;
      ubusPassword?: string;
      ubusUrl?: string;
      useHttps?: boolean;
      enabled?: boolean;
    };

  try {
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (host !== undefined) data.host = host;
    if (ubusUsername !== undefined) data.ubusUsername = ubusUsername;
    if (ubusPassword) data.ubusPassword = encrypt(ubusPassword);
    if (ubusUrl !== undefined) data.ubusUrl = ubusUrl;
    if (useHttps !== undefined) data.useHttps = useHttps;
    if (enabled !== undefined) data.enabled = enabled;

    const accessPoint = await prisma.accessPoint.update({
      where: { id },
      data,
    });
    res.json(sanitizeAccessPoint(accessPoint));
  } catch (error) {
    console.error('Update AP error:', error);
    res.status(500).json({ error: 'Failed to update access point' });
  }
});

router.delete('/:id', requirePin, async (req, res) => {
  try {
    await prisma.accessPoint.delete({ where: { id: paramId(req) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete AP error:', error);
    res.status(500).json({ error: 'Failed to delete access point' });
  }
});

router.post('/:id/test', requirePin, async (req, res) => {
  try {
    const accessPoint = await prisma.accessPoint.findUnique({
      where: { id: paramId(req) },
    });
    if (!accessPoint) {
      return res.status(404).json({ error: 'Access point not found' });
    }

    await testConnection(toAccessPointConfig(accessPoint));
    res.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Connection test failed';
    res.status(502).json({ error: message, ok: false });
  }
});

router.post('/:id/discover', requirePin, async (req, res) => {
  const syncRequested = (req.body as { sync?: boolean })?.sync !== false;

  try {
    const accessPoint = await prisma.accessPoint.findUnique({
      where: { id: paramId(req) },
    });
    if (!accessPoint) {
      return res.status(404).json({ error: 'Access point not found' });
    }

    if (!syncRequested) {
      const ifaces = await discoverWifiIfaces(
        toAccessPointConfig(accessPoint)
      );
      return res.json({ ifaces, added: 0, updated: 0, skipped: 0 });
    }

    const result = await syncNetworksFromAp(prisma, accessPoint);
    res.json({
      ifaces: result.ifaces,
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Discovery failed';
    res.status(502).json({ error: message });
  }
});

export default router;

import express from 'express';
import { prisma } from '../index';
import { requirePin } from '../middleware/pinAuth';
import { getIfaceDisabled, setIfaceEnabled } from '../services/openwrt';
import { toAccessPointConfig } from '../services/accessPointHelpers';
import { paramId } from '../utils/params';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const networks = await prisma.network.findMany({
      include: {
        accessPoint: true,
        schedule: true,
      },
      orderBy: [{ accessPoint: { name: 'asc' } }, { label: 'asc' }],
    });

    const results = await Promise.all(
      networks.map(async (network) => {
        let disabled: boolean | null = null;
        let reachable = false;
        let error: string | undefined;

        if (network.enabled && network.accessPoint.enabled) {
          try {
            disabled = await getIfaceDisabled(
              toAccessPointConfig(network.accessPoint),
              network.uciSection
            );
            reachable = true;
          } catch (err) {
            error = err instanceof Error ? err.message : 'Unreachable';
          }
        }

        return {
          id: network.id,
          label: network.label,
          uciSection: network.uciSection,
          ssid: network.ssid,
          enabled: network.enabled,
          accessPoint: {
            id: network.accessPoint.id,
            name: network.accessPoint.name,
            host: network.accessPoint.host,
            enabled: network.accessPoint.enabled,
          },
          disabled,
          reachable,
          error,
          schedule: network.schedule
            ? {
                enabled: network.schedule.enabled,
                offTime: network.schedule.offTime,
                onTime: network.schedule.onTime,
                days: JSON.parse(network.schedule.days) as string[],
              }
            : null,
        };
      })
    );

    res.json({ networks: results });
  } catch (error) {
    console.error('List networks error:', error);
    res.status(500).json({ error: 'Failed to list networks' });
  }
});

router.post('/', requirePin, async (req, res) => {
  const { id, accessPointId, label, uciSection, ssid } = req.body as {
    id?: string;
    accessPointId?: string;
    label?: string;
    uciSection?: string;
    ssid?: string;
  };

  if (!id || !accessPointId || !label || !uciSection) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const network = await prisma.network.create({
      data: { id, accessPointId, label, uciSection, ssid },
      include: { accessPoint: true },
    });
    res.status(201).json(network);
  } catch (error) {
    console.error('Create network error:', error);
    res.status(500).json({ error: 'Failed to create network' });
  }
});

router.delete('/:id', requirePin, async (req, res) => {
  try {
    await prisma.network.delete({ where: { id: paramId(req) } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete network error:', error);
    res.status(500).json({ error: 'Failed to delete network' });
  }
});

router.post('/:id/toggle', requirePin, async (req, res) => {
  const { enabled } = req.body as { enabled?: boolean };
  if (enabled === undefined) {
    return res.status(400).json({ error: 'enabled is required' });
  }

  try {
    const network = await prisma.network.findUnique({
      where: { id: paramId(req) },
      include: { accessPoint: true },
    });
    if (!network) {
      return res.status(404).json({ error: 'Network not found' });
    }

    await setIfaceEnabled(
      toAccessPointConfig(network.accessPoint),
      network.uciSection,
      enabled
    );

    const disabled = await getIfaceDisabled(
      toAccessPointConfig(network.accessPoint),
      network.uciSection
    );

    res.json({ id: network.id, disabled, enabled: !disabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Toggle failed';
    res.status(502).json({ error: message });
  }
});

export default router;

import express from 'express';
import { prisma } from '../index';
import { requirePin } from '../middleware/pinAuth';
import {
  applyScheduleToAp,
  DEFAULT_DAYS,
  verifyCronLines,
} from '../services/cronManager';
import { readCrontab } from '../services/openwrt';
import { toAccessPointConfig } from '../services/accessPointHelpers';
import { paramId } from '../utils/params';

const router = express.Router();

router.get('/:networkId', requirePin, async (req, res) => {
  try {
    const networkId = paramId(req, 'networkId');
    const network = await prisma.network.findUnique({
      where: { id: networkId },
      include: { accessPoint: true, schedule: true },
    });
    if (!network) {
      return res.status(404).json({ error: 'Network not found' });
    }

    let cronSynced = false;
    if (network.schedule) {
      try {
        const crontab = await readCrontab(
          toAccessPointConfig(network.accessPoint)
        );
        cronSynced = verifyCronLines(crontab, network.uciSection, {
          enabled: network.schedule.enabled,
          offTime: network.schedule.offTime,
          onTime: network.schedule.onTime,
          days: JSON.parse(network.schedule.days),
        });
      } catch {
        cronSynced = false;
      }
    }

    res.json({
      schedule: network.schedule
        ? {
            enabled: network.schedule.enabled,
            offTime: network.schedule.offTime,
            onTime: network.schedule.onTime,
            days: JSON.parse(network.schedule.days) as string[],
          }
        : {
            enabled: false,
            offTime: '22:00',
            onTime: '07:00',
            days: DEFAULT_DAYS,
          },
      cronSynced,
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

router.put('/:networkId', requirePin, async (req, res) => {
  const { enabled, offTime, onTime, days } = req.body as {
    enabled?: boolean;
    offTime?: string;
    onTime?: string;
    days?: string[];
  };

  if (
    enabled === undefined ||
    !offTime ||
    !onTime ||
    !Array.isArray(days) ||
    days.length === 0
  ) {
    return res.status(400).json({ error: 'Invalid schedule payload' });
  }

  try {
    const networkId = paramId(req, 'networkId');
    const network = await prisma.network.findUnique({
      where: { id: networkId },
      include: { accessPoint: true, schedule: true },
    });
    if (!network) {
      return res.status(404).json({ error: 'Network not found' });
    }

    const schedule = await prisma.schedule.upsert({
      where: { networkId: network.id },
      create: {
        networkId: network.id,
        enabled,
        offTime,
        onTime,
        days: JSON.stringify(days),
      },
      update: {
        enabled,
        offTime,
        onTime,
        days: JSON.stringify(days),
      },
    });

    await applyScheduleToAp(
      toAccessPointConfig(network.accessPoint),
      network.uciSection,
      { enabled, offTime, onTime, days }
    );

    res.json({
      schedule: {
        enabled: schedule.enabled,
        offTime: schedule.offTime,
        onTime: schedule.onTime,
        days: JSON.parse(schedule.days) as string[],
      },
      cronSynced: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save schedule';
    res.status(502).json({ error: message });
  }
});

export default router;

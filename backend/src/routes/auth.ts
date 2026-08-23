import express from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../index';
import { requirePin } from '../middleware/pinAuth';

const router = express.Router();

router.get('/settings', async (_req, res) => {
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: 1 } });
    }
    res.json({ hasPinConfigured: !!settings.adminPinHash });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.post('/verify-pin', async (req, res) => {
  const { pin } = req.body as { pin?: string };
  if (!pin) {
    return res.status(400).json({ error: 'PIN required' });
  }

  try {
    const settings = await prisma.settings.findFirst();
    if (!settings?.adminPinHash) {
      return res.status(400).json({ error: 'PIN not configured' });
    }
    const valid = await bcrypt.compare(pin, settings.adminPinHash);
    res.json({ valid });
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

router.post('/set-pin', async (req, res) => {
  const { currentPin, newPin } = req.body as {
    currentPin?: string;
    newPin?: string;
  };

  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 characters' });
  }

  try {
    const settings = await prisma.settings.findFirst();
    if (settings?.adminPinHash) {
      if (!currentPin) {
        return res.status(400).json({ error: 'Current PIN required' });
      }
      const valid = await bcrypt.compare(currentPin, settings.adminPinHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid current PIN' });
      }
    }

    const adminPinHash = await bcrypt.hash(newPin, 10);
    if (settings) {
      await prisma.settings.update({
        where: { id: 1 },
        data: { adminPinHash },
      });
    } else {
      await prisma.settings.create({ data: { id: 1, adminPinHash } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

export default router;

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../index';

export async function requirePin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const pin = req.headers['x-admin-pin'] as string | undefined;

  if (!pin) {
    return res.status(401).json({ error: 'PIN required' });
  }

  try {
    const settings = await prisma.settings.findFirst();
    if (!settings?.adminPinHash) {
      return res.status(500).json({ error: 'PIN not configured' });
    }

    const valid = await bcrypt.compare(pin, settings.adminPinHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    next();
  } catch (error) {
    console.error('PIN auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

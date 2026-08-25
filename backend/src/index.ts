import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import accessPointRoutes from './routes/accessPoints';
import networkRoutes from './routes/networks';
import scheduleRoutes from './routes/schedules';
import groupRoutes from './routes/groups';

export const app = express();
const port = process.env.PORT || 3002;

export const prisma = new PrismaClient({
  datasources: process.env.DATABASE_URL
    ? { db: { url: process.env.DATABASE_URL } }
    : undefined,
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/access-points', accessPointRoutes);
app.use('/api/networks', networkRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/groups', groupRoutes);

app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

if (process.env.NODE_ENV !== 'test') {
  const host = process.env.HOST || '0.0.0.0';
  app.listen(Number(port), host, () => {
    console.log(`WiFi Control running on http://${host}:${port}`);
  });
}

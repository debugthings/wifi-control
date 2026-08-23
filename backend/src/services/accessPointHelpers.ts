import { AccessPoint } from '@prisma/client';
import { decrypt } from '../utils/encryption';
import { AccessPointConfig } from './ubusClient';

export function toAccessPointConfig(ap: AccessPoint): AccessPointConfig {
  return {
    host: ap.host,
    ubusUrl: ap.ubusUrl,
    username: ap.ubusUsername,
    password: decrypt(ap.ubusPassword),
    useHttps: ap.useHttps,
  };
}

export function sanitizeAccessPoint(ap: AccessPoint) {
  const { ubusPassword: _password, ...rest } = ap;
  return rest;
}

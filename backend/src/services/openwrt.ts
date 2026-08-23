import { AccessPointConfig, createUbusClient } from './ubusClient';

export interface WifiIfaceInfo {
  section: string;
  ssid?: string;
  device?: string;
  disabled: boolean;
  mode?: string;
}

function parseDisabled(value: unknown): boolean {
  return value === '1' || value === 1 || value === true;
}

function extractValues(data: unknown): Record<string, Record<string, unknown>> {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const root = data as Record<string, unknown>;
  if (root.values && typeof root.values === 'object') {
    return root.values as Record<string, Record<string, unknown>>;
  }

  return root as Record<string, Record<string, unknown>>;
}

export async function testConnection(config: AccessPointConfig): Promise<boolean> {
  const client = createUbusClient(config);
  await client.login();
  return true;
}

export async function discoverWifiIfaces(
  config: AccessPointConfig
): Promise<WifiIfaceInfo[]> {
  const client = createUbusClient(config);
  const result = await client.call('uci', 'get', { config: 'wireless' });
  const sections = extractValues(result.data);
  const ifaces: WifiIfaceInfo[] = [];

  for (const [section, values] of Object.entries(sections)) {
    if (values['.type'] !== 'wifi-iface') {
      continue;
    }
    ifaces.push({
      section,
      ssid: typeof values.ssid === 'string' ? values.ssid : undefined,
      device: typeof values.device === 'string' ? values.device : undefined,
      disabled: parseDisabled(values.disabled),
      mode: typeof values.mode === 'string' ? values.mode : undefined,
    });
  }

  return ifaces.sort((a, b) => a.section.localeCompare(b.section));
}

export async function getIfaceDisabled(
  config: AccessPointConfig,
  section: string
): Promise<boolean> {
  const client = createUbusClient(config);
  const result = await client.call('uci', 'get', {
    config: 'wireless',
    section,
  });
  const values = extractValues(result.data);
  const sectionValues = values[section] ?? values;
  return parseDisabled(sectionValues.disabled);
}

export async function setIfaceEnabled(
  config: AccessPointConfig,
  section: string,
  enabled: boolean
): Promise<void> {
  const client = createUbusClient(config);
  await client.call('uci', 'set', {
    config: 'wireless',
    section,
    values: { disabled: enabled ? '0' : '1' },
  });
  await client.call('uci', 'commit', { config: 'wireless' });

  try {
    await client.call('uci', 'reload_config', { config: 'wireless' });
  } catch {
    await client.call('service', 'event', {
      type: 'config.change',
      data: { package: 'wireless' },
    });
  }
}

export async function readCrontab(config: AccessPointConfig): Promise<string> {
  const client = createUbusClient(config);
  const result = await client.call('file', 'read', {
    path: '/etc/crontabs/root',
  });
  const data = result.data as { data?: string };
  return data.data ?? '';
}

export async function writeCrontab(
  config: AccessPointConfig,
  contents: string
): Promise<void> {
  const client = createUbusClient(config);
  await client.call('file', 'write', {
    path: '/etc/crontabs/root',
    data: contents,
  });
  await client.call('rc', 'restart', { name: 'cron' });
}

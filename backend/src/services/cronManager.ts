import { AccessPointConfig } from './ubusClient';
import { readCrontab, writeCrontab } from './openwrt';

export interface ScheduleConfig {
  enabled: boolean;
  offTime: string;
  onTime: string;
  days: string[];
}

const DAY_TO_CRON: Record<string, string> = {
  sun: '0',
  mon: '1',
  tue: '2',
  wed: '3',
  thu: '4',
  fri: '5',
  sat: '6',
};

const TAG_PREFIX = 'wifi-control';

function cronDays(days: string[]): string {
  if (days.length === 0 || days.length === 7) {
    return '*';
  }
  return days.map((day) => DAY_TO_CRON[day.toLowerCase()] ?? day).join(',');
}

function parseTime(time: string): { minute: string; hour: string } {
  const [hour, minute] = time.split(':');
  return { hour: hour ?? '0', minute: minute ?? '0' };
}

export function buildCronLines(
  uciSection: string,
  schedule: ScheduleConfig
): string[] {
  if (!schedule.enabled) {
    return [];
  }

  const dow = cronDays(schedule.days);
  const off = parseTime(schedule.offTime);
  const on = parseTime(schedule.onTime);

  return [
    `${off.minute} ${off.hour} * * ${dow} /usr/local/bin/wifi-iface-toggle ${uciSection} off # ${TAG_PREFIX}:${uciSection}-off`,
    `${on.minute} ${on.hour} * * ${dow} /usr/local/bin/wifi-iface-toggle ${uciSection} on # ${TAG_PREFIX}:${uciSection}-on`,
  ];
}

export function stripTaggedLines(contents: string, uciSection: string): string {
  const tagPattern = new RegExp(
    `# ${TAG_PREFIX}:${uciSection}-(?:off|on)\\s*$`
  );
  return contents
    .split('\n')
    .filter((line) => !tagPattern.test(line))
    .join('\n')
    .replace(/\n+$/, '');
}

export function mergeCrontab(
  existing: string,
  uciSection: string,
  schedule: ScheduleConfig
): string {
  const stripped = stripTaggedLines(existing, uciSection);
  const newLines = buildCronLines(uciSection, schedule);
  if (newLines.length === 0) {
    return stripped;
  }
  const base = stripped.trimEnd();
  return base ? `${base}\n${newLines.join('\n')}\n` : `${newLines.join('\n')}\n`;
}

export async function applyScheduleToAp(
  config: AccessPointConfig,
  uciSection: string,
  schedule: ScheduleConfig
): Promise<void> {
  const existing = await readCrontab(config);
  const updated = mergeCrontab(existing, uciSection, schedule);
  await writeCrontab(config, updated);
}

export function verifyCronLines(
  contents: string,
  uciSection: string,
  schedule: ScheduleConfig
): boolean {
  const expected = buildCronLines(uciSection, schedule);
  if (expected.length === 0) {
    return !contents.includes(`${TAG_PREFIX}:${uciSection}-`);
  }
  return expected.every((line) => contents.includes(line.trim()));
}

export const DEFAULT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

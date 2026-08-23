import { describe, expect, it } from 'vitest';
import {
  buildCronLines,
  mergeCrontab,
  stripTaggedLines,
} from './cronManager';

describe('cronManager', () => {
  it('builds off/on cron lines with tags', () => {
    const lines = buildCronLines('wifinet0', {
      enabled: true,
      offTime: '22:30',
      onTime: '07:15',
      days: ['mon', 'wed', 'fri'],
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('wifinet0 off # wifi-control:wifinet0-off');
    expect(lines[1]).toContain('wifinet0 on # wifi-control:wifinet0-on');
    expect(lines[0]).toContain('30 22');
    expect(lines[0]).toContain('1,3,5');
  });

  it('merges and replaces tagged lines', () => {
    const existing = [
      '0 8 * * * /usr/bin/backup.sh',
      '30 22 * * * /usr/local/bin/wifi-iface-toggle wifinet0 off # wifi-control:wifinet0-off',
    ].join('\n');

    const merged = mergeCrontab(existing, 'wifinet0', {
      enabled: true,
      offTime: '23:00',
      onTime: '06:00',
      days: ['mon', 'tue'],
    });

    expect(merged).toContain('/usr/bin/backup.sh');
    expect(merged).not.toContain('30 22');
    expect(merged).toContain('0 23 * * 1,2');
    expect(stripTaggedLines(merged, 'wifinet0')).not.toContain('wifi-control:wifinet0');
  });
});

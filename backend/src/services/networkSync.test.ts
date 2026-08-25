import { describe, expect, it } from 'vitest';
import {
  filterControllableIfaces,
  isControllableWifiIface,
  slugifyId,
} from './networkSync';
import type { WifiIfaceInfo } from './openwrt';

function iface(partial: Partial<WifiIfaceInfo> & { section: string }): WifiIfaceInfo {
  return {
    disabled: false,
    ...partial,
  };
}

describe('isControllableWifiIface', () => {
  it('keeps ap and missing mode', () => {
    expect(isControllableWifiIface(iface({ section: 'a', mode: 'ap' }))).toBe(
      true
    );
    expect(isControllableWifiIface(iface({ section: 'b' }))).toBe(true);
    expect(
      isControllableWifiIface(iface({ section: 'c', mode: 'ap-wpa3' }))
    ).toBe(true);
  });

  it('skips sta mesh adhoc monitor', () => {
    for (const mode of ['sta', 'mesh', 'adhoc', 'monitor']) {
      expect(
        isControllableWifiIface(iface({ section: mode, mode }))
      ).toBe(false);
    }
  });
});

describe('filterControllableIfaces', () => {
  it('filters mixed discovery list', () => {
    const result = filterControllableIfaces([
      iface({ section: 'wifinet0', ssid: 'NETGEAR13', mode: 'ap' }),
      iface({ section: 'wifinet1', ssid: 'uplink', mode: 'sta' }),
      iface({ section: 'wifinet2', ssid: 'NETGEAR13-5G', mode: 'ap' }),
      iface({ section: 'mesh0', mode: 'mesh' }),
    ]);
    expect(result.map((i) => i.section)).toEqual(['wifinet0', 'wifinet2']);
  });
});

describe('slugifyId', () => {
  it('slugifies AP names', () => {
    expect(slugifyId('Basement AP')).toBe('basement-ap');
    expect(slugifyId('!!!')).toBe('ap');
  });
});

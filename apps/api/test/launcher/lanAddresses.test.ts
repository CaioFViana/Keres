import { describe, expect, it } from 'vitest';
import { formatLanUrls, lanHttpUrls, listLanIPv4 } from '../../src/launcher/lanAddresses';

describe('listLanIPv4', () => {
  it('keeps non-internal IPv4 addresses and skips loopback, IPv6 and APIPA', () => {
    const addresses = listLanIPv4({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [
        { address: '192.168.1.18', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false },
      ],
      wifi: [{ address: '10.0.0.4', family: 4, internal: false }],
      apipa: [{ address: '169.254.12.3', family: 'IPv4', internal: false }],
    });

    expect(addresses).toEqual(['10.0.0.4', '192.168.1.18']);
  });

  it('formats http URLs for every address', () => {
    expect(lanHttpUrls(3000, ['192.168.1.18', '10.0.0.4'])).toEqual([
      'http://192.168.1.18:3000',
      'http://10.0.0.4:3000',
    ]);
    expect(formatLanUrls(['http://192.168.1.18:3000'])).toBe('http://192.168.1.18:3000');
  });
});

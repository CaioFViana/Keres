import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/launcher/i18n';
import {
  describeLanAddresses,
  LAN_REPEAT_MS,
  startLanAddressHeartbeat,
} from '../../src/launcher/heartbeat';

describe('LAN address heartbeat', () => {
  const t = createTranslator('en');

  it('always lists LAN URLs and warns when bound to localhost', () => {
    const lines = describeLanAddresses('3000', '127.0.0.1', t, ['192.168.1.18']);
    expect(lines[0]).toContain('http://192.168.1.18:3000');
    expect(lines[1]).toMatch(/only accepts connections on this computer/i);
  });

  it('repeats the current addresses on the slow interval and reprints when they change', () => {
    const logs: string[] = [];
    let now = 0;
    let current = ['192.168.1.18'];
    const ticks: Array<() => void> = [];

    const stop = startLanAddressHeartbeat({
      port: 3000,
      host: '0.0.0.0',
      t,
      print: (message) => logs.push(message),
      listAddresses: () => current,
      now: () => now,
      setIntervalFn: ((handler: () => void) => {
        ticks.push(handler);
        return 1 as unknown as NodeJS.Timeout;
      }) as typeof setInterval,
    });

    ticks[0]?.();
    expect(logs).toHaveLength(0);

    now = LAN_REPEAT_MS;
    ticks[0]?.();
    expect(logs.some((line) => line.includes('http://192.168.1.18:3000'))).toBe(true);

    current = ['192.168.1.19'];
    ticks[0]?.();
    expect(
      logs.some((line) => line.includes('changed') && line.includes('http://192.168.1.19:3000')),
    ).toBe(true);

    stop();
  });
});

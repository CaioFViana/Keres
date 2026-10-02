import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/launcher/i18n';
import {
  describeLanAddresses,
  LAN_POLL_MS,
  startLanAddressHeartbeat,
} from '../../src/launcher/heartbeat';

describe('LAN address heartbeat', () => {
  const t = createTranslator('en');

  it('always lists LAN URLs and warns when bound to localhost', () => {
    const lines = describeLanAddresses('3000', '127.0.0.1', t, ['192.168.1.18']);
    expect(lines[0]).toContain('http://192.168.1.18:3000');
    expect(lines[1]).toMatch(/only accepts connections on this computer/i);
  });

  const watch = (host: string, list: () => string[]) => {
    const logs: string[] = [];
    const ticks: Array<() => void> = [];
    const stop = startLanAddressHeartbeat({
      port: 3000,
      host,
      t,
      print: (message) => logs.push(message),
      listAddresses: list,
      setIntervalFn: ((handler: () => void, interval: number) => {
        expect(interval).toBe(LAN_POLL_MS);
        ticks.push(handler);
        return 1 as unknown as NodeJS.Timeout;
      }) as typeof setInterval,
    });
    return { logs, tick: () => ticks[0]?.(), stop };
  };

  it('prints nothing while the addresses stay the same, however long it runs', () => {
    const { logs, tick, stop } = watch('0.0.0.0', () => ['192.168.1.18']);

    for (let i = 0; i < 200; i++) tick();

    expect(logs).toEqual([]);
    stop();
  });

  it('prints once when the addresses change, and goes quiet again', () => {
    let current = ['192.168.1.18'];
    const { logs, tick, stop } = watch('0.0.0.0', () => current);

    tick();
    current = ['192.168.1.19'];
    tick();
    tick();
    tick();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('changed');
    expect(logs[0]).toContain('http://192.168.1.19:3000');
    stop();
  });

  it('ignores the order the system lists the addresses in', () => {
    let current = ['192.168.1.18', '10.0.0.4'];
    const { logs, tick, stop } = watch('0.0.0.0', () => current);

    current = ['10.0.0.4', '192.168.1.18'];
    tick();

    expect(logs).toEqual([]);
    stop();
  });

  it('says so when the last address is gone, and repeats the localhost note when bound to it', () => {
    let current = ['192.168.1.18'];
    const { logs, tick, stop } = watch('127.0.0.1', () => current);

    current = [];
    tick();

    expect(logs[0]).toMatch(/changed/);
    expect(logs[0]).toMatch(/No LAN IPv4/i);
    expect(logs[1]).toMatch(/only accepts connections on this computer/i);
    stop();
  });
});

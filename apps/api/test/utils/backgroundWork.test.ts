import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  drainBackground,
  pendingBackgroundCount,
  trackBackground,
} from '../../src/utils/backgroundWork';
import { logger, setLogSink } from '../../src/utils/logger';

afterEach(async () => {
  await drainBackground(1000);
  vi.restoreAllMocks();
});

describe('backgroundWork', () => {
  it('counts work until it settles, whichever way it ends', async () => {
    let finish!: () => void;
    const slow = trackBackground(new Promise<void>((resolve) => (finish = resolve)));
    const failing = trackBackground(Promise.reject(new Error('no')));
    failing.catch(() => undefined);
    expect(pendingBackgroundCount()).toBeGreaterThanOrEqual(1);

    finish();
    await slow;
    expect(await drainBackground(1000)).toEqual({ drained: true, remaining: 0 });
  });

  it('waits for work that starts while it waits', async () => {
    const order: string[] = [];
    trackBackground(
      new Promise<void>((resolve) =>
        setTimeout(() => {
          order.push('first');
          // The write being waited for starts another (a log line about itself).
          trackBackground(
            new Promise<void>((next) =>
              setTimeout(() => {
                order.push('second');
                next();
              }, 20),
            ),
          );
          resolve();
        }, 20),
      ),
    );

    const result = await drainBackground(2000);

    expect(order).toEqual(['first', 'second']);
    expect(result.drained).toBe(true);
  });

  it('stops waiting at the deadline and says how much is left', async () => {
    let release!: () => void;
    trackBackground(new Promise<void>((resolve) => (release = resolve)));

    const started = Date.now();
    const result = await drainBackground(60);

    expect(Date.now() - started).toBeLessThan(1000);
    expect(result).toEqual({ drained: false, remaining: 1 });
    release();
  });

  it('returns at once when nothing is running', async () => {
    expect(await drainBackground(1000)).toEqual({ drained: true, remaining: 0 });
  });
});

describe('the logger and a sink that writes in the background', () => {
  it('is waited for by the drain, and a failing sink does not surface', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    let written = false;
    setLogSink(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            written = true;
            resolve();
          }, 30),
        ),
    );
    logger.info('last words');
    expect(written).toBe(false);

    await drainBackground(1000);
    expect(written).toBe(true);

    setLogSink(() => Promise.reject(new Error('database gone')));
    logger.info('this one fails to persist');
    await expect(drainBackground(1000)).resolves.toMatchObject({ drained: true });

    setLogSink(() => undefined);
  });
});

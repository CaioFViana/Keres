import { Platform } from 'react-native';
import { keepPageOutOfBackForwardCache } from '../../src/utils/pageLifecycle';

describe('keepPageOutOfBackForwardCache', () => {
  const original = Platform.OS;
  const target = globalThis as unknown as Record<string, unknown>;
  const saved = {
    add: target.addEventListener,
    remove: target.removeEventListener,
    navigator: target.navigator,
  };
  const added: string[] = [];
  const removed: string[] = [];

  beforeEach(() => {
    added.length = 0;
    removed.length = 0;
    Platform.OS = 'web';
    target.addEventListener = (name: string) => void added.push(name);
    target.removeEventListener = (name: string) => void removed.push(name);
  });

  afterEach(() => {
    Platform.OS = original;
    target.addEventListener = saved.add;
    target.removeEventListener = saved.remove;
    Object.defineProperty(globalThis, 'navigator', { value: saved.navigator, configurable: true });
  });

  const withLocks = (request: jest.Mock) =>
    Object.defineProperty(globalThis, 'navigator', {
      value: { locks: { request } },
      configurable: true,
    });

  it('adds the unload listener and holds a lock for the life of the page, releasing both on undo', async () => {
    let held: (() => void) | null = null;
    const request = jest.fn(
      (_name: string, callback: () => Promise<void>) =>
        new Promise<void>((resolve) => {
          held = () => void callback().then(resolve);
        }),
    );
    withLocks(request);

    const undo = keepPageOutOfBackForwardCache();

    expect(added).toEqual(['unload']);
    expect(request).toHaveBeenCalledWith('keres-page-alive', expect.any(Function));
    undo();
    expect(removed).toEqual(['unload']);
    expect(held).not.toBeNull();
  });

  it('still keeps the unload listener where there are no Web Locks', () => {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });

    const undo = keepPageOutOfBackForwardCache();

    expect(added).toEqual(['unload']);
    expect(() => undo()).not.toThrow();
  });

  it('survives a refused lock request', async () => {
    withLocks(jest.fn(() => Promise.reject(new Error('refused'))));

    expect(() => keepPageOutOfBackForwardCache()).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing off the web', () => {
    Platform.OS = 'android';

    keepPageOutOfBackForwardCache()();

    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });
});

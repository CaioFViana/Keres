import { ensureCrossOriginIsolation, workerUrlOf } from '../../src/utils/crossOriginIsolation';

function makeEnv(overrides: { crossOriginIsolated?: boolean; flag?: string | null } = {}) {
  const store = new Map<string, string>();
  if (overrides.flag) store.set('keres-coi-reload', overrides.flag);
  const serviceWorker = {
    register: jest.fn(async () => ({})),
    ready: Promise.resolve({}),
  };
  const env = {
    crossOriginIsolated: overrides.crossOriginIsolated ?? false,
    serviceWorker: serviceWorker as unknown as ServiceWorkerContainer,
    session: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    reload: jest.fn(),
    workerUrl: 'https://host.test/Keres/client/coi-sw.js',
    pageUrl: 'https://host.test/Keres/client/',
    replace: jest.fn(),
  };
  return { env, serviceWorker, store };
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SERVERLESS;
});

describe('ensureCrossOriginIsolation', () => {
  it('does nothing outside the serverless build', async () => {
    const { env, serviceWorker } = makeEnv();

    await expect(ensureCrossOriginIsolation(env)).resolves.toBe(true);
    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(env.reload).not.toHaveBeenCalled();
  });

  it('boots an isolated page at once and forgets the reload', async () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    const { env, serviceWorker, store } = makeEnv({ crossOriginIsolated: true, flag: '1' });

    await expect(ensureCrossOriginIsolation(env)).resolves.toBe(true);
    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(store.has('keres-coi-reload')).toBe(false);
  });

  it('installs the worker under the base path and reloads once', async () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    const { env, serviceWorker, store } = makeEnv();

    await expect(ensureCrossOriginIsolation(env)).resolves.toBe(false);
    expect(serviceWorker.register).toHaveBeenCalledWith('https://host.test/Keres/client/coi-sw.js');
    expect(env.reload).toHaveBeenCalledTimes(1);
    expect(store.get('keres-coi-reload')).toBe('1');
  });

  it('moves a page opened without the trailing slash to it first: the worker cannot control a page outside its scope', async () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    const { env, serviceWorker } = makeEnv();

    await expect(
      ensureCrossOriginIsolation({
        ...env,
        pageUrl: 'https://host.test/Keres/client?story=1#top',
      }),
    ).resolves.toBe(false);
    expect(env.replace).toHaveBeenCalledWith('https://host.test/Keres/client/?story=1#top');
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('moves a page opened in another case to the canonical address', async () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    const { env, serviceWorker } = makeEnv();

    await expect(
      ensureCrossOriginIsolation({ ...env, pageUrl: 'https://host.test/keres/client/story/1?x=2' }),
    ).resolves.toBe(false);
    expect(env.replace).toHaveBeenCalledWith('https://host.test/Keres/client/story/1?x=2');
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('boots rather than wait for ever on a worker that never takes control', async () => {
    jest.useFakeTimers();
    try {
      process.env.EXPO_PUBLIC_SERVERLESS = '1';
      const { env, serviceWorker } = makeEnv();
      serviceWorker.ready = new Promise(() => {}) as never;
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = ensureCrossOriginIsolation(env);
      await jest.advanceTimersByTimeAsync(10000);

      await expect(result).resolves.toBe(true);
      expect(env.reload).not.toHaveBeenCalled();
      spy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  it('boots anyway when the reload did not isolate the page, instead of looping', async () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    const { env, serviceWorker, store } = makeEnv({ flag: '1' });

    await expect(ensureCrossOriginIsolation(env)).resolves.toBe(true);
    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(env.reload).not.toHaveBeenCalled();
    expect(store.has('keres-coi-reload')).toBe(false);
  });

  it('boots when workers are unavailable or refuse to register', async () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    const none = makeEnv();
    await expect(
      ensureCrossOriginIsolation({ ...none.env, serviceWorker: undefined }),
    ).resolves.toBe(true);

    const refused = makeEnv();
    refused.serviceWorker.register.mockRejectedValueOnce(new Error('blocked'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(ensureCrossOriginIsolation(refused.env)).resolves.toBe(true);
    expect(refused.env.reload).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('workerUrlOf', () => {
  const globals = globalThis as unknown as { document?: unknown; location?: unknown };
  const saved = { document: globals.document, location: globals.location };
  afterEach(() => {
    globals.document = saved.document;
    globals.location = saved.location;
  });

  it('is next to the app bundle, whatever address the page was opened at', () => {
    globals.document = {
      scripts: [
        { src: 'https://host.test/other.js' },
        { src: 'https://host.test/Keres/client/_expo/static/js/web/index-abc.js' },
      ],
    };
    // Opened without the trailing slash: a path relative to the page would land on /Keres/.
    globals.location = { href: 'https://host.test/Keres/client' };

    expect(workerUrlOf()).toBe('https://host.test/Keres/client/coi-sw.js');
  });

  it('falls back to the page directory when no bundle tag is found', () => {
    globals.document = { scripts: [] };
    globals.location = { href: 'https://host.test/Keres/client/' };

    expect(workerUrlOf()).toBe('https://host.test/Keres/client/coi-sw.js');
  });
});

import { ensureCrossOriginIsolation } from '../../src/utils/crossOriginIsolation';

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
    expect(serviceWorker.register).toHaveBeenCalledWith('coi-sw.js');
    expect(env.reload).toHaveBeenCalledTimes(1);
    expect(store.get('keres-coi-reload')).toBe('1');
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

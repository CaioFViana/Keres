import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertStorage: vi.fn(),
  cleanup: vi.fn(),
  createApp: vi.fn(),
  listen: vi.fn(),
  loggerInfo: vi.fn(),
  normalizeTags: vi.fn(),
  reconcile: vi.fn(),
  runMigrations: vi.fn(),
  setLogSink: vi.fn(),
  createShutdown: vi.fn((_dependencies: unknown) => ({ run: vi.fn(), onSignal: vi.fn() })),
  installShutdownHandlers: vi.fn(),
}));

vi.mock('@/config/env', () => ({ env: { PORT: '3000', MEDIA_MAX_BYTES: 50 * 1024 * 1024 } }));
vi.mock('@/db/migrate', () => ({ runMigrations: mocks.runMigrations }));
vi.mock('@/index', () => ({ createApp: mocks.createApp }));
vi.mock('@/services/hostedClientDelivery', () => ({ warmHostedClientDelivery: vi.fn() }));
vi.mock('@/services/RootAdminService', () => ({ reconcileRootAdmin: mocks.reconcile }));
vi.mock('@/services/UserTagMaintenance', () => ({
  normalizeStoredUserTags: mocks.normalizeTags,
}));
vi.mock('@/services/MediaStorageConfigurationService', () => ({
  assertMediaStorageConfiguration: mocks.assertStorage,
}));
vi.mock('@/services/MediaStorageService', () => ({
  mediaStorageService: { cleanupTemporaryFiles: mocks.cleanup },
}));
vi.mock('@/services/ApiLogService', () => ({ persistApiLog: vi.fn() }));
vi.mock('@/shutdown', () => ({
  createShutdown: mocks.createShutdown,
  installShutdownHandlers: mocks.installShutdownHandlers,
}));
vi.mock('@/utils/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: vi.fn() },
  setLogSink: mocks.setLogSink,
}));

beforeAll(async () => {
  mocks.runMigrations.mockResolvedValue(undefined);
  mocks.assertStorage.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(2);
  mocks.normalizeTags.mockResolvedValue(0);
  mocks.reconcile.mockResolvedValue(undefined);
  mocks.createApp.mockResolvedValue({
    listen: mocks.listen.mockImplementation(
      (
        _options: { port: string; maxRequestBodySize: number },
        callback: (address: { hostname: string; port: number }) => void,
      ) => callback({ hostname: '127.0.0.1', port: 3000 }),
    ),
  });
  await import('@/server');
});

describe('production server bootstrap', () => {
  it('prepares persistence and media before listening for requests', () => {
    expect(mocks.runMigrations).toHaveBeenCalledOnce();
    expect(mocks.setLogSink).toHaveBeenCalledOnce();
    expect(mocks.assertStorage).toHaveBeenCalledOnce();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.normalizeTags).toHaveBeenCalledOnce();
    expect(mocks.reconcile).toHaveBeenCalledOnce();
    // Tags are brought to their shape before the root admin is reconciled: its own may need it.
    expect(mocks.normalizeTags.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reconcile.mock.invocationCallOrder[0],
    );
    expect(mocks.listen).toHaveBeenCalledWith(
      { port: '3000', maxRequestBodySize: 50 * 1024 * 1024 + 8 * 1024 * 1024 },
      expect.any(Function),
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith('Removed 2 abandoned temporary media upload(s).');
    expect(mocks.loggerInfo).toHaveBeenCalledWith('Elysia is running at http://127.0.0.1:3000');
  });

  it('installs the orderly shutdown, over the server it started', () => {
    expect(mocks.installShutdownHandlers).toHaveBeenCalledOnce();
    expect(mocks.createShutdown).toHaveBeenCalledOnce();
    const dependencies = mocks.createShutdown.mock.calls[0][0] as {
      getServer: () => unknown;
      exit: unknown;
      closeDatabase: unknown;
      drainBackground: unknown;
    };
    expect(typeof dependencies.exit).toBe('function');
    expect(typeof dependencies.closeDatabase).toBe('function');
    expect(typeof dependencies.drainBackground).toBe('function');
    // The mocked app has no server (it never listened for real): the shutdown copes with that.
    expect(dependencies.getServer()).toBeUndefined();
  });
});

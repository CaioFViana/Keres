import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertStorage: vi.fn(),
  cleanup: vi.fn(),
  createApp: vi.fn(),
  listen: vi.fn(),
  loggerInfo: vi.fn(),
  reconcile: vi.fn(),
  runMigrations: vi.fn(),
  setLogSink: vi.fn(),
}));

vi.mock('../src/config/env', () => ({ env: { PORT: '3000', MEDIA_MAX_BYTES: 50 * 1024 * 1024 } }));
vi.mock('../src/db/migrate', () => ({ runMigrations: mocks.runMigrations }));
vi.mock('../src/index', () => ({ createApp: mocks.createApp }));
vi.mock('../src/services/RootAdminService', () => ({ reconcileRootAdmin: mocks.reconcile }));
vi.mock('../src/services/MediaStorageConfigurationService', () => ({
  assertMediaStorageConfiguration: mocks.assertStorage,
}));
vi.mock('../src/services/MediaStorageService', () => ({
  mediaStorageService: { cleanupTemporaryFiles: mocks.cleanup },
}));
vi.mock('../src/services/ApiLogService', () => ({ persistApiLog: vi.fn() }));
vi.mock('../src/utils/logger', () => ({
  logger: { info: mocks.loggerInfo },
  setLogSink: mocks.setLogSink,
}));

beforeAll(async () => {
  mocks.runMigrations.mockResolvedValue(undefined);
  mocks.assertStorage.mockResolvedValue(undefined);
  mocks.cleanup.mockResolvedValue(2);
  mocks.reconcile.mockResolvedValue(undefined);
  mocks.createApp.mockResolvedValue({
    listen: mocks.listen.mockImplementation(
      (
        _options: { port: string; maxRequestBodySize: number },
        callback: (address: { hostname: string; port: number }) => void,
      ) => callback({ hostname: '127.0.0.1', port: 3000 }),
    ),
  });
  await import('../src/server');
});

describe('production server bootstrap', () => {
  it('prepares persistence and media before listening for requests', () => {
    expect(mocks.runMigrations).toHaveBeenCalledOnce();
    expect(mocks.setLogSink).toHaveBeenCalledOnce();
    expect(mocks.assertStorage).toHaveBeenCalledOnce();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
    expect(mocks.reconcile).toHaveBeenCalledOnce();
    expect(mocks.listen).toHaveBeenCalledWith(
      { port: '3000', maxRequestBodySize: 50 * 1024 * 1024 + 8 * 1024 * 1024 },
      expect.any(Function),
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith('Removed 2 abandoned temporary media upload(s).');
    expect(mocks.loggerInfo).toHaveBeenCalledWith('Elysia is running at http://127.0.0.1:3000');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertStorage: vi.fn(),
  cleanup: vi.fn(),
  createApp: vi.fn(),
  listen: vi.fn(),
  loggerError: vi.fn(),
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
  logger: { info: mocks.loggerInfo, error: mocks.loggerError },
  setLogSink: mocks.setLogSink,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createApp.mockResolvedValue({ listen: mocks.listen });
});

describe('production server bootstrap - fatal startup error', () => {
  it('logs and exits instead of letting a boot failure surface as an unhandled rejection', async () => {
    const bootError = new Error('ECONNREFUSED: could not reach Postgres');
    mocks.runMigrations.mockRejectedValue(bootError);

    // The real process.exit(1) never returns - a plain no-op mock would let module-level
    // execution fall through past it and keep going (which is exactly what a first version of
    // this test caught: `listen` still got called). Throwing mimics that "never returns"
    // behavior well enough for this test's purposes.
    const processExitSentinel = new Error('process.exit(1) called');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw processExitSentinel;
    });

    vi.resetModules();
    await expect(import('../src/server')).rejects.toBe(processExitSentinel);

    expect(mocks.loggerError).toHaveBeenCalledWith('Fatal error during startup', bootError);
    expect(exitSpy).toHaveBeenCalledWith(1);
    // The app never got far enough to actually accept traffic.
    expect(mocks.listen).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});

import { defineConfig } from 'vitest/config';
import coverageThresholds from '../../scripts/coverage-thresholds.json';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.test.ts'],
    setupFiles: ['test/setup.ts'],
    // Migrations applied exactly once, before any file runs.
    globalSetup: ['test/helpers/globalSetup.ts'],
    // A single disposable database is shared by the whole suite and each file truncates the tables
    // between tests - running files in parallel would make one wipe the other's state.
    fileParallelism: false,
    // `fileParallelism` serializes files in a worker, but a pool with several workers can still
    // overlap their database connections while a file's hooks are truncating. The integration
    // database is intentionally one shared fixture, so use exactly one worker as the hard guard
    // against deadlocks and cross-file state leaks.
    minWorkers: 1,
    maxWorkers: 1,
    // bcryptjs on registration and the first `createApp()` leave the first test of each file
    // bem mais lento que os seguintes.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // A directory of its own: without it the integration report would overwrite the unit suites', and
      // `test:report` would show one in place of the other.
      reportsDirectory: 'coverage-integration',
      // A floor, not a target - see the ratchet rule in TESTING_PLAN.md.
      thresholds: coverageThresholds.apiIntegration,
    },
  },
});

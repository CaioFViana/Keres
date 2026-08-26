import { configDefaults, defineConfig } from 'vitest/config';
import coverageThresholds from '../../scripts/coverage-thresholds.json';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Integration suites require a disposable Postgres up (docker-compose.test.yml) and run through
    // `vitest.integration.config.ts`; the default command has to pass on any machine, with no infrastructure.
    exclude: [...configDefaults.exclude, 'test/**/*.integration.test.ts'],
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Low by construction: this config covers only what runs without a database (utils, config, storage
      // adapters). Routes, services and handlers are measured by `vitest.integration.config.ts`, which has
      // thresholds of its own.
      thresholds: coverageThresholds.apiUnit,
    },
  },
});

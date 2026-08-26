import { defineConfig } from 'vitest/config';
import { keresLogo } from './vite.keresIcon';
import coverageThresholds from '../../scripts/coverage-thresholds.json';

export default defineConfig({
  // The wordmark is a virtual module generated at build time. Without the plugin, any test that
  // renders the layout fails to resolve `virtual:keres-logo`.
  plugins: [keresLogo()],
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/main.tsx'],
      thresholds: coverageThresholds.site,
    },
  },
});

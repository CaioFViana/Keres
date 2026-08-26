import { defineConfig } from 'vitest/config';
import { keresAvatarIcons, keresLogo } from './vite.keresIcon';
import coverageThresholds from '../../scripts/coverage-thresholds.json';

export default defineConfig({
  // The site's wordmark is a virtual module generated at build time (vite.keresIcon.ts). Without
  // the plugin here, any test that renders the site's layout fails to resolve the import.
  plugins: [keresLogo(), keresAvatarIcons()],
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Low because the 5 React pages were left out of scope; what is covered is the API layer. A
      // floor, not a target - see the ratchet rule in TESTING_PLAN.md.
      thresholds: coverageThresholds.admin,
    },
  },
});

import { defineConfig } from 'vitest/config';
import coverageThresholds from '../../scripts/coverage-thresholds.json';

export default defineConfig({
  test: {
    environment: 'node',
    // The package is flat (no `src/`), so coverage explicitly excludes what is not production code
    // instead of pointing at a single directory.
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['entities/**', 'metadata/**', 'schemas/**', 'utils/**', 'index.ts'],
      // A floor, not a target: pinned slightly below the measured value to absorb fluctuation, and to rise
      // along with coverage. See the ratchet rule in TESTING_PLAN.md.
      thresholds: coverageThresholds.shared,
    },
  },
});

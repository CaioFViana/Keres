import { defineConfig } from 'vitest/config';
import coverageThresholds from '../../scripts/coverage-thresholds.json';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Piso, não meta - ver a regra do ratchet em TESTING_PLAN.md.
      thresholds: coverageThresholds.desktop,
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Piso, não meta - ver a regra do ratchet em TESTING_PLAN.md.
      thresholds: { lines: 94, functions: 92, branches: 80 },
    },
  },
});

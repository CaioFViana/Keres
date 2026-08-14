import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Baixo porque as 5 páginas React ficaram fora de escopo; o que está coberto é a
      // camada de API. Piso, não meta - ver a regra do ratchet em TESTING_PLAN.md.
      thresholds: { lines: 71, functions: 53, branches: 47 },
    },
  },
});

import { defineConfig } from 'vitest/config';
import { keresLogo } from './vite.keresIcon';

export default defineConfig({
  // A marca é um módulo virtual gerado no build. Sem o plugin, qualquer teste que
  // renderize o layout falha ao resolver `virtual:keres-logo`.
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
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
});

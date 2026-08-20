import { defineConfig } from 'vitest/config';
import { keresAvatarIcons, keresLogo } from './vite.keresIcon';

export default defineConfig({
  // A marca do site é um módulo virtual gerado no build (vite.keresIcon.ts). Sem o plugin
  // aqui, qualquer teste que renderize o layout do site falha ao resolver o import.
  plugins: [keresLogo(), keresAvatarIcons()],
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Baixo porque as 5 páginas React ficaram fora de escopo; o que está coberto é a
      // camada de API. Piso, não meta - ver a regra do ratchet em TESTING_PLAN.md.
      thresholds: { lines: 70, functions: 53, branches: 47 },
    },
  },
});

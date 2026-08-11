import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.test.ts'],
    setupFiles: ['test/setup.ts'],
    // Um único banco descartável é compartilhado por toda a suíte e cada arquivo trunca as
    // tabelas entre os testes - rodar arquivos em paralelo faria um limpar o estado do outro.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.test.ts'],
    setupFiles: ['test/setup.ts'],
    // Migrações aplicadas uma vez só, antes de qualquer arquivo rodar.
    globalSetup: ['test/helpers/globalSetup.ts'],
    // Um único banco descartável é compartilhado por toda a suíte e cada arquivo trunca as
    // tabelas entre os testes - rodar arquivos em paralelo faria um limpar o estado do outro.
    fileParallelism: false,
    // bcrypt no registro e o primeiro `createApp()` deixam o primeiro teste de cada arquivo
    // bem mais lento que os seguintes.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Diretório próprio: sem isto o relatório da integração sobrescreveria o das suítes
      // unitárias, e `test:report` mostraria um dos dois no lugar do outro.
      reportsDirectory: 'coverage-integration',
      // Piso, não meta - ver a regra do ratchet em TESTING_PLAN.md.
      thresholds: { lines: 69, functions: 70, branches: 54 },
    },
  },
});

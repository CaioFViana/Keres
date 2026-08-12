import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Suítes de integração exigem um Postgres descartável de pé (docker-compose.test.yml) e
    // rodam por `vitest.integration.config.ts`; o comando padrão precisa passar em qualquer
    // máquina, sem infra.
    exclude: [...configDefaults.exclude, 'test/**/*.integration.test.ts'],
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      // Baixo por construção: esta config cobre só o que roda sem banco (utils, config,
      // adaptadores de armazenamento). Rotas, serviços e handlers são medidos por
      // `vitest.integration.config.ts`, que tem os seus próprios limiares.
      thresholds: { lines: 12, functions: 18, branches: 3 },
    },
  },
});

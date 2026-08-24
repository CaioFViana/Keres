import { defineConfig } from 'vitest/config';
import coverageThresholds from '../../scripts/coverage-thresholds.json';

export default defineConfig({
  test: {
    environment: 'node',
    // O pacote é flat (sem `src/`), então a cobertura exclui explicitamente o que não é código
    // de produção em vez de apontar para um único diretório.
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['entities/**', 'metadata/**', 'schemas/**', 'utils/**', 'index.ts'],
      // Piso, não meta: fixado um pouco abaixo do medido para absorver flutuação, e para
      // subir junto quando a cobertura subir. Ver a regra do ratchet em TESTING_PLAN.md.
      thresholds: coverageThresholds.shared,
    },
  },
});

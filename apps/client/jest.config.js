module.exports = {
  preset: 'jest-expo',
  // `src` entra aqui só para a *cobertura* enxergar os arquivos que nenhum teste importa.
  // Com apenas `test/` na lista, o Jest não varre `src/` e o `collectCoverageFrom` abaixo não
  // tem efeito: o relatório mede só o que os testes já tocam, o que faz a cobertura parecer
  // muito maior do que é (eram 136 dos 377 arquivos, 42% em vez de 15%).
  roots: ['<rootDir>/test', '<rootDir>/src'],
  // Ancorado em `test/` de propósito: `roots` agora inclui `src`, e um glob solto passaria a
  // procurar testes lá dentro também.
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
    '<rootDir>/src/help/__tests__/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    // Gerados por scripts/generate-*.js; cobri-los só distorce o número.
    '!src/db/migrations/**',
    '!src/exampleStories/**',
  ],
  coverageReporters: ['text', 'lcov'],
  // Piso, não meta: fixado um pouco abaixo do medido para absorver flutuação, e para subir
  // junto quando a cobertura subir. Ver a regra do ratchet em TESTING_PLAN.md.
  coverageThreshold: {
    global: { lines: 16, functions: 16, branches: 12 },
  },
};

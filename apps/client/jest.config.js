module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
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
    global: { lines: 40, functions: 50, branches: 29 },
  },
};

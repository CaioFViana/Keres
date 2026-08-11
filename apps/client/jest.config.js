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
};

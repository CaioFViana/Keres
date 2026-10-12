import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The service runs under Bun and stores with `bun:sqlite`; vitest runs under Node, which has no `bun:sqlite`.
      // Node's built-in `node:sqlite` has the same prepared-statement surface, and the store uses only that surface
      // (positional parameters, `prepare`, `exec`), so the tests exercise the same SQL. The shim is test-only.
      'bun:sqlite': fileURLToPath(new URL('./test/shims/bunSqlite.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
    },
  },
});

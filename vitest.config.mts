import path from 'node:path'

import { defineConfig } from 'vitest/config'
// import tsconfigPaths from 'vite-tsconfig-paths'; // This line will be removed

export default defineConfig({
  optimizeDeps: {
    include: ['@keres/db'],
  },
  plugins: [
    // tsconfigPaths({ root: './apps/api' }), // These lines will be removed
    // tsconfigPaths({ root: './packages/db' }),
    // tsconfigPaths({ root: './packages/shared' }),
  ],
  test: {
    include: ['apps/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, './vitest.setup.mts')],
  },
  resolve: {
    alias: {
      // Manually add aliases from apps/api/tsconfig.json
      '@domain': path.resolve(__dirname, './apps/api/src/domain'),
      '@application': path.resolve(__dirname, './apps/api/src/application'),
      '@infrastructure': path.resolve(__dirname, './apps/api/src/infrastructure'),
      '@presentation': path.resolve(__dirname, './apps/api/src/presentation'),
      '@shared': path.resolve(__dirname, './apps/api/src/shared'),
      // Keep this alias as packages/db/tsconfig.json doesn't define it
      '@keres/db': path.resolve(__dirname, './packages/db'),
      '@keres/db/schema': path.resolve(__dirname, './packages/db/src/schema.ts'),
    },
  },
})

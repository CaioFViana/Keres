import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/**/*.test.ts'],
    setupFiles: [path.resolve(__dirname, './vitest.setup.mts')],
  },
  resolve: {
    alias: [
      {
        find: '@domain',
        replacement: path.resolve(__dirname, './apps/api/src/domain'),
      },
      {
        find: '@application',
        replacement: path.resolve(__dirname, './apps/api/src/application'),
      },
      {
        find: '@infrastructure',
        replacement: path.resolve(__dirname, './apps/api/src/infrastructure'),
      },
      {
        find: '@presentation',
        replacement: path.resolve(__dirname, './apps/api/src/presentation'),
      },
      {
        find: '@shared',
        replacement: path.resolve(__dirname, './apps/api/src/shared'),
      },
    ],
  },
})

import { fileURLToPath } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The `@/` and `@test/` aliases of tsconfig.json, for Vite, Vitest and the Showcase build (the compiler
 * reads the tsconfig itself; Vite does not). Imports reach across folders by alias and use `./` only for
 * the same folder or below: see test/architecture/importStyle.test.ts.
 */
export const adminAliases = [
  { find: /^@\//, replacement: here('./src/') },
  { find: /^@test\//, replacement: here('./test/') },
  // The build configuration beside `src` (the favicon generator its test exercises).
  { find: /^@root\//, replacement: here('./') },
];

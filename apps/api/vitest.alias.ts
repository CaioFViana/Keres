import { fileURLToPath } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The `@/` and `@test/` aliases of tsconfig.json, for Vitest (Bun and the compiler read the tsconfig
 * themselves; Vite does not). Imports reach across folders by alias and use `./` only for the same
 * folder or below: see test/architecture/importStyle.test.ts.
 */
export const apiAliases = [
  { find: /^@\//, replacement: here('./src/') },
  { find: /^@test\//, replacement: here('./test/') },
  { find: /^@scripts\//, replacement: here('./scripts/') },
];

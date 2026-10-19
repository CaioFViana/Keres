/**
 * Test-only stand-in for `bun:sqlite` (vitest runs under Node, which has no `bun:sqlite`). The store uses only
 * `new Database(file)`, `exec` and `prepare(...).run/get/all` with positional parameters, which Node's built-in
 * `node:sqlite` provides with the same meaning. See `vitest.config.ts`.
 */
export { DatabaseSync as Database } from 'node:sqlite';

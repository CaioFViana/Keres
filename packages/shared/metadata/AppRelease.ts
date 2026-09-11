/**
 * Identity of the released version of Keres.
 *
 * Update it with `bun run version:set <version> <name>` at the repository root. This module is
 * consumed by both the client and the API, so there is no separate server version.
 */
export const APP_RELEASE = {
  name: 'Aion',
  version: '1.8.0',
} as const;

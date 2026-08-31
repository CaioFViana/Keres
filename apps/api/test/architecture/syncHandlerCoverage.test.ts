import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const HANDLERS_ROOT = resolve(__dirname, '../../src/services/entity-sync-handlers');
const TEST_ROOT = resolve(__dirname, '..');

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/**
 * Sync handlers are the server's last line of defense for local operation logs. A handler can be
 * registered correctly and still be untested, which means its validation and tombstone behavior
 * only runs in production. Requiring its class name in a test keeps every new entity paired with
 * an explicit test suite (directly or through its integration family).
 */
describe('sync handler test coverage', () => {
  it('requires every concrete handler to be exercised by an API test', () => {
    const testSource = filesUnder(TEST_ROOT)
      .filter((path) => path.endsWith('.test.ts'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    const handlerNames = filesUnder(HANDLERS_ROOT)
      .filter((path) => path.endsWith('SyncHandler.ts') && !path.endsWith('BaseSyncEntityHandler.ts'))
      .flatMap((path) => Array.from(readFileSync(path, 'utf8').matchAll(/export class (\w+SyncHandler)/g), (match) => match[1]));
    const untested = handlerNames.filter((name) => !testSource.includes(name));

    expect(untested).toEqual([]);
  });
});

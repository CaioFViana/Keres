/**
 * @jest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * A story-management service that writes to the database without recording an operation is a silent
 * sync bug: the row exists on this device, the server never hears of it, and nothing fails. Every
 * `*Service.ts` under `storymanagement/` that inserts, updates or deletes must therefore mention
 * `recordLocalOperation` (or `recordLocalOperationSync`), the call that puts the change in the log.
 *
 * It is a file-level check: it proves a service did not forget the log altogether, not that every
 * single write inside it is logged (the sync convergence fuzz and each service's own tests do that).
 * Services that legitimately write without logging are named below, with the reason; the list can
 * only shrink or be justified, because `toEqual` refuses both an unlisted offender and a stale name.
 */

const SERVICES_ROOT = resolve(__dirname, '../../src/services/storymanagement');

const WRITE = /\.(insert|update|delete)\(/;
const RECORDS_OPERATION = /recordLocalOperation/;

function listServices(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listServices(path);
    return /Service\.ts$/.test(entry) ? [path] : [];
  });
}

const relativeOf = (path: string) => relative(SERVICES_ROOT, path).replace(/\\/g, '/');

/** Writes that are not synchronized story data, and why. */
const WRITES_WITHOUT_OPERATIONS: Record<string, string> = {
  'story-lifecycle/StoryIndexService.ts':
    'Repairs derived numbering (chapter and scene order) from ranks; the ranks are what syncs, not the derived numbers.',
  'packs/PackService.ts':
    'Packs travel by their own REST routes (create/replace, share, delete); they have no operation log and no OCC.',
};

describe('story-management services that write', () => {
  const services = listServices(SERVICES_ROOT);

  it('finds the services (the scan is not silently empty)', () => {
    expect(services.length).toBeGreaterThan(40);
  });

  it('records an operation in every service that writes, except the ones named with a reason', () => {
    const offenders = services
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return WRITE.test(source) && !RECORDS_OPERATION.test(source);
      })
      .map(relativeOf)
      .sort();

    expect(offenders).toEqual(Object.keys(WRITES_WITHOUT_OPERATIONS).sort());
  });
});

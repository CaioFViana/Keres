import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The API's layers, verified rather than agreed upon.
 *
 * The route reads the request, calls a service and returns the response. The service is what talks to
 * the database. When the route builds its own query, the rule starts living inside an HTTP handler:
 * it cannot be reused by another route, nor tested without starting a server - and that is how two
 * routes end up filtering "not deleted" in two different ways.
 */

const MODULES_ROOT = resolve(__dirname, '../../src/modules');

function listFiles(directory: string, suffix: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listFiles(path, suffix);
    return entry.endsWith(suffix) ? [path] : [];
  });
}

const IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const routeFiles = listFiles(MODULES_ROOT, '.route.ts');
const relativeOf = (path: string) => relative(MODULES_ROOT, path).split('\\').join('/');

/**
 * Routes that still build their own query. Known debt, not a licence: the list can only shrink, and
 * `toEqual` refuses both a new route here and a name left behind after its query moved down into a
 * service.
 */
const ROUTES_THAT_STILL_QUERY = ['auth/auth.route.ts', 'media/media.route.ts'];

describe('API layers', () => {
  it('finds the modules routes', () => {
    expect(routeFiles.length).toBeGreaterThan(10);
  });

  it('keeps database queries inside the services', () => {
    const offenders = routeFiles
      .filter((path) =>
        // The signal is the query builder. Importing the schema alone is a different thing and remains
        // acceptable: `story.route.ts` takes the enum's values from it to validate the request body, without
        // touching the database.
        Array.from(readFileSync(path, 'utf8').matchAll(IMPORT), (match) => match[1]).some(
          (specifier) => /^drizzle-orm(\/|$)/.test(specifier),
        ),
      )
      .map(relativeOf)
      .sort();

    expect(offenders).toEqual([...ROUTES_THAT_STILL_QUERY].sort());
  });
});

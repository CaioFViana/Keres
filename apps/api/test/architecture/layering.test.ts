import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
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
const SOURCE_ROOT = resolve(__dirname, '../../src');
const STORY_PACKAGE_ROOT = resolve(SOURCE_ROOT, 'services/story-packages');

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
const sourceRelativeOf = (path: string) => relative(SOURCE_ROOT, path).split('\\').join('/');

/**
 * Routes that still build their own query. Known debt, not a licence: the list can only shrink, and
 * `toEqual` refuses both a new route here and a name left behind after its query moved down into a
 * service.
 */
const ROUTES_THAT_STILL_QUERY: string[] = [];

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

const LINE_LIMIT = 600;
const FILES_OVER_THE_LIMIT: Array<string> = [];

describe('API file size', () => {
  it('does not allow new source files above the line ceiling', () => {
    const oversized = listFiles(SOURCE_ROOT, '.ts')
      .filter((path) => readFileSync(path, 'utf8').split('\n').length > LINE_LIMIT)
      .map(sourceRelativeOf)
      .sort();

    expect(oversized).toEqual([...FILES_OVER_THE_LIMIT].sort());
  });
});

describe('story package persistence boundary', () => {
  it('keeps generic collection SQL out of import phases', () => {
    const importPhaseFiles = listFiles(STORY_PACKAGE_ROOT, '.ts').filter((path) =>
      /DatabaseStoryPackage.+Import\.ts$/.test(path),
    );
    const directWriters = importPhaseFiles
      .filter((path) => readFileSync(path, 'utf8').includes('.insert('))
      .map(sourceRelativeOf)
      .sort();

    expect(directWriters).toEqual([]);
  });
});

describe('recovery entity labels', () => {
  it('keeps relationship-specific labels in shared entity handlers', () => {
    const recoveryDisplayNames = readFileSync(
      resolve(SOURCE_ROOT, 'services/AdminRecoveryDisplayNames.ts'),
      'utf8',
    );

    expect(recoveryDisplayNames).not.toMatch(/\bswitch\s*\(/);
  });
});

describe('sync protocol type boundaries', () => {
  it('keeps the shared handler contract free of explicit any', () => {
    const source = readFileSync(
      resolve(SOURCE_ROOT, 'services/entity-sync-handlers/BaseSyncEntityHandler.ts'),
      'utf8',
    );
    const start = source.indexOf('export type SyncEntity =');
    const end = source.indexOf('export abstract class BaseSyncEntityHandler');
    const contract = source.slice(start, end);

    expect(contract).not.toMatch(/:\s*any\b|\bas\s+any\b|Record<string,\s*any>/);
  });

  it('does not allow explicit any in protocol coordinators', () => {
    const coordinators = [
      'services/sync/SyncOperationLogService.ts',
      'services/sync/SyncPullService.ts',
      'services/sync/SyncPushService.ts',
    ];
    const explicitAny = /:\s*any\b|\bas\s+any\b|Record<string,\s*any>/;

    const offenders = coordinators.filter((file) =>
      explicitAny.test(readFileSync(resolve(SOURCE_ROOT, file), 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});

describe('API explicit any boundary', () => {
  it('does not allow explicit any in application source', () => {
    const offenders = listFiles(SOURCE_ROOT, '.ts')
      .filter((file) => {
        const source = ts.createSourceFile(
          file,
          readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        );
        let found = false;
        const visit = (node: ts.Node): void => {
          if (node.kind === ts.SyntaxKind.AnyKeyword) found = true;
          if (!found) ts.forEachChild(node, visit);
        };
        visit(source);
        return found;
      })
      .map(sourceRelativeOf)
      .sort();

    expect(offenders).toEqual([]);
  });
});

describe('database portability boundary', () => {
  it('exports only the database operations covered by the shared contract', () => {
    const databaseModule = readFileSync(resolve(SOURCE_ROOT, 'db/index.ts'), 'utf8');

    expect(databaseModule).toContain('export interface CompatibleDb extends CommonDatabaseOperations');
    expect(databaseModule).toContain(
      "'query' | 'select' | 'selectDistinct' | 'insert' | 'update' | 'delete' | 'execute'",
    );
    expect(databaseModule).not.toMatch(/export type CompatibleDb\s*=\s*NodePgDatabase/);
    expect(databaseModule.match(/as unknown as CompatibleDb/g)).toHaveLength(1);
  });

  it('keeps native driver access inside database infrastructure', () => {
    const offenders = listFiles(SOURCE_ROOT, '.ts')
      .filter((file) => !sourceRelativeOf(file).startsWith('db/'))
      .filter((file) => /drizzle-orm\/(?:node-postgres|libsql)/.test(readFileSync(file, 'utf8')))
      .map(sourceRelativeOf)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('reserves the native migration target for the migration adapter', () => {
    const offenders = listFiles(SOURCE_ROOT, '.ts')
      .filter((file) => !['db/index.ts', 'db/migrate.ts'].includes(sourceRelativeOf(file)))
      .filter((file) => readFileSync(file, 'utf8').includes('databaseMigrationTarget'))
      .map(sourceRelativeOf)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('makes the active transaction available to withTransaction callbacks', () => {
    const databaseModule = readFileSync(resolve(SOURCE_ROOT, 'db/index.ts'), 'utf8');

    expect(databaseModule).toContain(
      'withTransaction<T>(fn: (tx: CompatibleDb) => Promise<T>)',
    );
    expect(databaseModule).toContain('return fn(activeTransaction)');
  });
});

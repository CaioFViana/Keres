import * as path from 'path';
import { migrate as migrateLibsql } from 'drizzle-orm/libsql/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';
import { usingSqlite } from './dialect';
import { logger } from '../utils/logger';

/**
 * Applies any pending SQL migrations before the app accepts traffic - without this, a brand
 * new database has no tables at all, and the very first query on boot (`reconcileRootAdmin`,
 * right after this call) fails outright instead of the server ever coming up. Uses drizzle-orm's
 * own migrator (not the `drizzle-kit` CLI) deliberately: drizzle-kit is a devDependency, kept out
 * of the production image to keep it small, and this runtime migrator is a lighter-weight,
 * already-a-dependency alternative that does the exact same "apply what's not applied yet" job.
 *
 * Resolved from `import.meta.dir`, not `process.cwd()` - same reasoning as `adminDistPath` in
 * `index.ts`: needs to find `apps/api/drizzle` regardless of where the process was started from.
 */
export async function runMigrations(): Promise<void> {
  // Cada motor tem o seu conjunto: o SQL gerado difere de dialeto para dialeto (tipos de
  // coluna, ENUM que só o Postgres tem), então são duas pastas, não uma compartilhada.
  const migrationsFolder = path.join(
    import.meta.dir,
    '..',
    '..',
    usingSqlite ? 'drizzle-sqlite' : 'drizzle',
  );
  logger.info(`Applying database migrations from ${migrationsFolder}...`);
  if (usingSqlite) {
    await migrateLibsql(db as never, { migrationsFolder });
  } else {
    await migratePostgres(db, { migrationsFolder });
  }
  logger.info('Database migrations up to date.');
}

import { migrate as migrateLibsql } from 'drizzle-orm/libsql/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import { migrationsFolder } from '../config/resourceRoot';
import { logger } from '../utils/logger';
import { databaseMigrationTarget } from './index';

/**
 * Applies any pending SQL migrations before the app accepts traffic - without this, a brand
 * new database has no tables at all, and the very first query on boot (`reconcileRootAdmin`,
 * right after this call) fails outright instead of the server ever coming up. Uses drizzle-orm's
 * own migrator (not the `drizzle-kit` CLI) deliberately: drizzle-kit is a devDependency, kept out
 * of the production image to keep it small, and this runtime migrator is a lighter-weight,
 * already-a-dependency alternative that does the exact same "apply what's not applied yet" job.
 *
 * Resolved via `resourceRoot` (not `process.cwd()`): the compiled/zip layout keeps the SQL
 * next to the executable, while `bun run` still finds `apps/api/drizzle`.
 */
export async function runMigrations(): Promise<void> {
  // Each engine has its own set: the generated SQL differs from dialect to dialect (column types, ENUMs
  // that only Postgres has), so there are two folders, not one shared.
  const folder = migrationsFolder(databaseMigrationTarget.dialect === 'sqlite');
  logger.info(`Applying database migrations from ${folder}...`);
  if (databaseMigrationTarget.dialect === 'sqlite') {
    await migrateLibsql(databaseMigrationTarget.connection, { migrationsFolder: folder });
  } else {
    await migratePostgres(databaseMigrationTarget.connection, { migrationsFolder: folder });
  }
  logger.info('Database migrations up to date.');
}

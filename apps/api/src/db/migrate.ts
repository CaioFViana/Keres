import * as path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';
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
  const migrationsFolder = path.join(import.meta.dir, '..', '..', 'drizzle');
  logger.info(`Applying database migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  logger.info('Database migrations up to date.');
}

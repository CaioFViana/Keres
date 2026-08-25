import * as dotenv from 'dotenv';
import type { Config } from 'drizzle-kit';

dotenv.config({ path: './.env' });

/**
 * Generation of the SQLite migrations.
 *
 * `DATABASE_DRIVER` is set here before anything else: `src/db/schema/columns.ts` reads that
 * variable at import time to decide whether to build `pgTable` or `sqliteTable` tables. Without
 * this, drizzle-kit would read the schema in the Postgres dialect and try to generate SQLite SQL
 * from it.
 *
 * The Postgres migrations still come from `drizzle.config.ts`, into `drizzle/`, untouched.
 */
process.env.DATABASE_DRIVER = 'sqlite';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle-sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    // Only used by commands that talk to the database (`push`, `studio`); `generate` compares the
    // schema with what is already in `drizzle-sqlite/` and opens no connection at all.
    url: process.env.DATABASE_URL?.startsWith('file:')
      ? process.env.DATABASE_URL
      : 'file:./keres.db',
  },
  verbose: true,
  strict: true,
} satisfies Config;

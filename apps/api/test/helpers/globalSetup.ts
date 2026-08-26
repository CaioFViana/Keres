import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { migrate as migrateLibsql } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { rm } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import '../setup';

/**
 * Applies the migrations exactly once, before any test file runs.
 *
 * It deliberately does not reuse `runMigrations()` from `src/db/migrate.ts`: that function resolves
 * the folder through `import.meta.dir`, which is a Bun API and comes back `undefined` in Vitest's
 * workers. The path here comes from `import.meta.url`, which works in both runtimes.
 *
 * It also uses a connection of its own, closed at the end, instead of `src/db`'s singleton: the
 * global setup runs outside the tests' context and a connection left open here would keep Vitest's
 * process alive.
 *
 * The suite runs against both engines: `DATABASE_DRIVER=sqlite` runs it over a disposable file, with
 * no Postgres up at all.
 */
const API_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function setupPostgres(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(API_ROOT, 'drizzle') });
  } catch (error) {
    throw new Error(
      `Não foi possível preparar o banco de teste em ${process.env.DATABASE_URL}. ` +
        'Suba-o com `docker compose -f apps/api/docker-compose.test.yml up -d`.\n' +
        `Causa: ${(error as Error).message}`,
    );
  } finally {
    await pool.end();
  }
}

async function setupSqlite(): Promise<void> {
  // A fresh file on every run: the migrations are applied from scratch, and no residue from a previous
  // run leaks into a new one.
  const file = process.env.DATABASE_URL!.replace(/^file:/, '');
  await rm(file, { force: true });
  await rm(`${file}-wal`, { force: true });
  await rm(`${file}-shm`, { force: true });

  const client = createClient({ url: process.env.DATABASE_URL! });
  try {
    await migrateLibsql(drizzleLibsql(client), {
      migrationsFolder: path.join(API_ROOT, 'drizzle-sqlite'),
    });
  } finally {
    client.close();
  }
}

export default async function setup(): Promise<void> {
  if (process.env.DATABASE_DRIVER === 'sqlite') {
    await setupSqlite();
    return;
  }
  await setupPostgres();
}

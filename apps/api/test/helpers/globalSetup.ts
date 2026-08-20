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
 * Aplica as migrações uma única vez, antes de qualquer arquivo de teste rodar.
 *
 * Não reusa `runMigrations()` de `src/db/migrate.ts` de propósito: aquela função resolve a
 * pasta por `import.meta.dir`, que é API do Bun e vem `undefined` nos workers do Vitest. O
 * caminho aqui sai de `import.meta.url`, que funciona nos dois runtimes.
 *
 * Também usa uma conexão própria, encerrada no fim, em vez do singleton de `src/db`: o global
 * setup roda fora do contexto dos testes e uma conexão deixada aberta aqui seguraria o
 * processo do Vitest no ar.
 *
 * A suíte roda contra os dois motores: `DATABASE_DRIVER=sqlite` a executa sobre um arquivo
 * descartável, sem precisar de Postgres nenhum no ar.
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
  // Arquivo novo a cada execução: as migrações são aplicadas do zero, e nenhum resíduo de uma
  // rodada anterior entra numa nova.
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

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
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
 * Também usa um Pool próprio, encerrado no fim, em vez do singleton de `src/db`: o global
 * setup roda fora do contexto dos testes e uma conexão deixada aberta aqui seguraria o
 * processo do Vitest no ar.
 */
const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'drizzle',
);

export default async function setup(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
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

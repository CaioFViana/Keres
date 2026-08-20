import { createClient } from '@libsql/client';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { usingSqlite } from '../../src/db/dialect';
import * as schema from '../../src/db/schema';

/**
 * As migrações do SQLite descrevem o mesmo schema que o código define.
 *
 * O motivo de existir: são duas pastas de migração, uma por motor, e é preciso lembrar de
 * gerar as duas (`db:generate` e `db:generate:sqlite`). Esquecer a segunda não quebra nada em
 * desenvolvimento com Postgres - quebra só na instalação de alguém que escolheu SQLite, no
 * primeiro boot, longe de quem fez a mudança. Este teste aplica as migrações do SQLite num
 * arquivo novo e compara tabela por tabela, coluna por coluna, com o que o schema declara.
 *
 * Só roda no modo SQLite: com o Postgres ativo, `schema` constrói tabelas do outro dialeto e
 * a comparação não faria sentido.
 */

const describeForSqlite = usingSqlite ? describe : describe.skip;

/** As tabelas como o código as declara. */
function declaredTables(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  for (const value of Object.values(schema)) {
    // O barrel exporta também relations, enums e constantes; `is` é o verificador do próprio
    // drizzle, e é o único jeito confiável de separar uma tabela do resto.
    if (!is(value, SQLiteTable)) {
      continue;
    }
    const config = getTableConfig(value);
    tables.set(config.name, new Set(config.columns.map((column) => column.name)));
  }
  return tables;
}

describeForSqlite('the SQLite migrations match the schema', () => {
  it('creates every table and column the code declares, and nothing extra', async () => {
    const file = path.join(os.tmpdir(), `keres-parity-${Date.now()}.db`);
    await rm(file, { force: true });

    const client = createClient({ url: `file:${file}` });
    try {
      const { drizzle } = await import('drizzle-orm/libsql');
      const { migrate } = await import('drizzle-orm/libsql/migrator');
      await migrate(drizzle(client), {
        migrationsFolder: path.join(
          path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
          '..',
          '..',
          'drizzle-sqlite',
        ),
      });

      const applied = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
      );
      const appliedNames = (applied.rows as unknown as Array<{ name: string }>)
        .map((row) => row.name)
        .sort();

      const declared = declaredTables();
      expect(appliedNames).toEqual([...declared.keys()].sort());

      for (const [tableName, declaredColumns] of declared) {
        const info = await client.execute(`PRAGMA table_info("${tableName}")`);
        const appliedColumns = (info.rows as unknown as Array<{ name: string }>)
          .map((row) => row.name)
          .sort();
        expect({ [tableName]: appliedColumns }).toEqual({
          [tableName]: [...declaredColumns].sort(),
        });
      }
    } finally {
      client.close();
      // No Windows o arquivo continua travado por um instante depois do `close`; é um
      // temporário, então falhar em apagá-lo não pode reprovar o teste.
      await rm(file, { force: true }).catch(() => undefined);
    }
  });

  // A tabela de controle do drizzle mora no banco principal (no Postgres é um schema à parte),
  // e é ela que a limpeza entre testes precisa poupar - ver `truncateAll`.
  it('keeps its bookkeeping in __drizzle_migrations', async () => {
    const { db } = await import('../../src/db');
    const sqliteDb = db as unknown as { all: (query: unknown) => Promise<unknown> };
    const { sql } = await import('drizzle-orm');

    const rows = (await sqliteDb.all(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`,
    )) as Array<{ name: string }>;

    expect(rows).toHaveLength(1);
  });
});

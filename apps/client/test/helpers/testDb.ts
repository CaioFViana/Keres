import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { AppDrizzleClient } from '../../src/db';
import migrations from '../../src/db/migrations';
import * as schema from '../../src/db/schema';

/**
 * Banco de teste em memória para os serviços que falam com o SQLite.
 *
 * `expo-sqlite` não roda em Node, mas as tabelas são declaradas com `drizzle-orm/sqlite-core` -
 * as mesmas definições servem para o driver `better-sqlite3`, então os serviços rodam contra o
 * schema de verdade em vez de um mock de banco.
 *
 * As migrações também são as de produção, sem cópia: cada arquivo em `src/db/migrations` é uma
 * função que recebe algo com `execAsync(sql)`, então basta entregar um objeto com esse método
 * apoiado no `exec` do better-sqlite3. Se uma migração nova quebrar o schema, esta suíte
 * quebra junto, que é exatamente o que se quer.
 */
export interface TestDatabase {
  /**
   * Tipado como o cliente de produção (`AppDrizzleClient`, sobre expo-sqlite) para os serviços
   * poderem ser chamados sem cast em cada teste.
   *
   * A conversão é segura e fica contida neste ponto: as duas instâncias são o mesmo
   * `SQLiteDatabase` do drizzle sobre o mesmo schema, e divergem só no tipo do `RunResult` que
   * cada driver devolve (`lastInsertRowId`/`changes` do expo-sqlite contra o do
   * better-sqlite3) - um valor que nenhum serviço deste app lê.
   */
  db: AppDrizzleClient;
  raw: Database.Database;
  close: () => void;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');

  const expoLikeDatabase = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
  };

  for (const migration of migrations) {
    await migration.run(expoLikeDatabase as never);
  }

  return {
    db: drizzle(raw, { schema }) as unknown as AppDrizzleClient,
    raw,
    close: () => raw.close(),
  };
}

/** Tabelas presentes no banco, para checar que as migrações realmente rodaram. */
export function listTables(raw: Database.Database): string[] {
  return raw
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((row) => row.name)
    .sort();
}

import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { usingSqlite } from '../../src/db/dialect';
import { users } from '../../src/db/schema';

/**
 * Promove um usuário a admin escrevendo direto na tabela.
 *
 * Não há rota para isso de propósito - em produção o admin raiz vem de
 * `ROOT_ADMIN_USERNAME`/`ROOT_ADMIN_PASSWORD`, reconciliados no boot, que é justamente o
 * caminho que `createApp()` não executa. Mexer na coluna é o equivalente mais fiel.
 */
export async function promoteToAdmin(userId: string): Promise<void> {
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
}

/** Marca o usuário como excluído, para exercitar a porta do `requireAdmin`. */
export async function softDeleteUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Esvazia todas as tabelas entre os testes.
 *
 * Lê a lista do próprio catálogo em vez de enumerar o schema do drizzle: uma tabela nova
 * passa a ser limpa sozinha, sem ninguém precisar lembrar de atualizar esta lista. O
 * `__drizzle_migrations` fica de fora nos dois motores - as migrações continuam aplicadas.
 */
export async function truncateAll(): Promise<void> {
  if (usingSqlite) {
    await truncateAllSqlite();
    return;
  }

  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );

  const tables = result.rows.map((row) => `"public"."${row.tablename}"`);
  if (tables.length === 0) {
    return;
  }

  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`));
}

/**
 * O SQLite não tem `TRUNCATE` nem `CASCADE`, então é `DELETE` tabela a tabela - com as chaves
 * estrangeiras desligadas durante a limpeza, já que sem `CASCADE` a ordem passaria a importar.
 */
async function truncateAllSqlite(): Promise<void> {
  // `db` é tipado como a conexão do Postgres (ver src/db/index.ts); `all`/`run` são os métodos
  // que só o driver do SQLite expõe, e este bloco só roda quando é ele que está ativo.
  const sqliteDb = db as unknown as {
    all: (query: unknown) => Promise<unknown>;
    run: (query: unknown) => Promise<unknown>;
  };

  const rows = (await sqliteDb.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
  )) as Array<{ name: string }>;

  await sqliteDb.run(sql`PRAGMA foreign_keys = OFF`);
  try {
    for (const { name } of rows) {
      await sqliteDb.run(sql.raw(`DELETE FROM "${name}"`));
    }
  } finally {
    await sqliteDb.run(sql`PRAGMA foreign_keys = ON`);
  }
}

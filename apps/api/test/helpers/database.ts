import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
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
  await db.update(users).set({ isDeleted: true, deletedAt: new Date() }).where(eq(users.id, userId));
}

/**
 * Esvazia todas as tabelas entre os testes.
 *
 * Lê a lista do próprio catálogo em vez de enumerar o schema do drizzle: uma tabela nova
 * passa a ser limpa sozinha, sem ninguém precisar lembrar de atualizar esta lista. O
 * `__drizzle_migrations` vive no schema `drizzle`, não em `public`, então nunca entra aqui -
 * as migrações continuam aplicadas.
 */
export async function truncateAll(): Promise<void> {
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );

  const tables = result.rows.map((row) => `"public"."${row.tablename}"`);
  if (tables.length === 0) {
    return;
  }

  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`));
}

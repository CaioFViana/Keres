import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '../config/env';
import { db } from '../db';
import { users } from '../db/schema';
import { logger } from '../utils/logger';

/**
 * Garante que a conta admin "root" configurada via env sempre exista e sempre seja admin,
 * rodando a cada boot da API - em vez de um script de bootstrap de execução única, que
 * deixaria uma janela sem nenhum admin até alguém lembrar de rodá-lo, e nada impediria o
 * último admin de ser removido depois.
 *
 * É uma linha de verdade em `users` (não uma identidade virtual que contorna o banco), então
 * passa pelos mesmos caminhos de sempre: login normal, a mesma checagem de `requireAdmin` no
 * banco que qualquer outro admin, e um `userId` válido para o log de operações quando essa
 * conta restaura algo pelo painel.
 *
 * Pulado inteiramente se as env vars não estiverem definidas.
 */
export async function reconcileRootAdmin(): Promise<void> {
  if (!env.ROOT_ADMIN_USERNAME || !env.ROOT_ADMIN_PASSWORD) {
    return;
  }

  const hashedPassword = await bcrypt.hash(env.ROOT_ADMIN_PASSWORD, 10);
  const existing = await db.query.users.findFirst({
    where: eq(users.username, env.ROOT_ADMIN_USERNAME),
  });

  if (existing) {
    await db
      .update(users)
      .set({ password: hashedPassword, isAdmin: true, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    logger.info(
      `Root admin '${env.ROOT_ADMIN_USERNAME}' reconciled (isAdmin enforced, password refreshed from env).`,
    );
    return;
  }

  const id = ulid();
  await db.insert(users).values({
    id,
    username: env.ROOT_ADMIN_USERNAME,
    tag: env.ROOT_ADMIN_USERNAME,
    password: hashedPassword,
    isAdmin: true,
  });
  logger.info(`Root admin '${env.ROOT_ADMIN_USERNAME}' created.`);
}

import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { hashPassword } from '../config/bcrypt';
import { env } from '../config/env';
import { db } from '../db';
import { users } from '../db/schema';
import { logger } from '../utils/logger';

/**
 * Guarantees that the "root" admin account configured through the env always exists and is always
 * an admin, running at every boot of the API - rather than a run-once bootstrap script, which would
 * leave a window with no admin at all until somebody remembered to run it, and nothing would stop
 * the last admin from being removed afterwards.
 *
 * It is a real row in `users` (not a virtual identity bypassing the database), so it goes through the
 * usual paths: ordinary login, the same `requireAdmin` check against the database as any other
 * admin, and a valid `userId` for the operation log when that account restores something through the
 * panel.
 *
 * Skipped entirely if the env vars are not set.
 */
export async function reconcileRootAdmin(): Promise<void> {
  if (!env.ROOT_ADMIN_USERNAME || !env.ROOT_ADMIN_PASSWORD) {
    return;
  }

  const hashedPassword = await hashPassword(env.ROOT_ADMIN_PASSWORD);
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

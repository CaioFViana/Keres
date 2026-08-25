import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import type { JWTPayload } from '../index';
import { AppError } from './errors';

/**
 * A centralised guard for the /api/admin/* routes, instead of each module repeating the check (as
 * `requirePermission` in media.route.ts did per module).
 *
 * `isAdmin` is checked against the database on every request, never trusted from the JWT: the token
 * lives for 1h and this API has no revocation list, so an `isAdmin` claim embedded in the token would
 * stay valid for up to an hour after an admin was demoted or deleted.
 *
 * A plain function instead of an Elysia plugin with `.derive()`: composing that derive through `.use()`
 * across modules did not propagate the `requireAdmin` type reliably into the routes - a function called
 * explicitly with the context's `user` is simpler and avoids that type-system trap.
 */
export async function requireAdmin(user: JWTPayload | null): Promise<string> {
  if (!user?.userId) {
    throw new AppError(401, 'Unauthorized');
  }
  const row = await db.query.users.findFirst({
    where: eq(users.id, user.userId),
    columns: { id: true, isAdmin: true, isDeleted: true },
  });
  if (!row || row.isDeleted || !row.isAdmin) {
    throw new AppError(403, 'Admin access required.');
  }
  return row.id;
}

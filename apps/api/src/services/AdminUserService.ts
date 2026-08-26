import type { AdminCreateUser, AdminUpdateUser, AdminUserListQuery } from '@keres/shared';
import { and, asc, count, eq, or } from 'drizzle-orm';
import { insensitiveLike } from '../db/sqlOperators';
import { ulid } from 'ulid';
import { hashPassword } from '../config/bcrypt';
import { env } from '../config/env';
import { db } from '../db';
import { users } from '../db/schema';
import { isUniqueViolation, postgresErrorConstraint } from '../utils/errors';
import { recoveryCodeService } from './RecoveryCodeService';

export class UsernameAlreadyTakenError extends Error {
  constructor() {
    super('Username is already taken.');
    this.name = 'UsernameAlreadyTakenError';
  }
}

export class AdminUserNotFoundError extends Error {
  constructor() {
    super('User not found.');
    this.name = 'AdminUserNotFoundError';
  }
}

/**
 * Refuses to demote/delete the root account reconciled through the env (see RootAdminService) - it
 * can only be removed by changing/removing the env vars and restarting the API, never through the UI.
 *
 * Only those two actions are blocked in `update`/`softDelete` below - the root account's tag, avatar,
 * bio and tierId go through normal editing, so the message must not say "modified" without
 * qualification, which would leave the impression that the account is immutable altogether.
 */
export class RootAdminProtectedError extends Error {
  constructor() {
    super(
      'The root admin account cannot be demoted or deleted through the admin panel. Change ROOT_ADMIN_USERNAME/ROOT_ADMIN_PASSWORD and restart the API instead.',
    );
    this.name = 'RootAdminProtectedError';
  }
}

// Shape differs between Drizzle's two query builders, same split as UserService.ts:
// the relational API (`db.query.users.findFirst`) takes `{ column: true }`, the core
// API's `.returning()` takes `{ alias: table.column }`.
const ADMIN_USER_COLUMNS = {
  id: true,
  username: true,
  tag: true,
  avatarColor: true,
  avatarIcon: true,
  bio: true,
  isAdmin: true,
  tierId: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  deletedAt: true,
} as const;

const ADMIN_USER_RETURNING = {
  id: users.id,
  username: users.username,
  tag: users.tag,
  avatarColor: users.avatarColor,
  avatarIcon: users.avatarIcon,
  bio: users.bio,
  isAdmin: users.isAdmin,
  tierId: users.tierId,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  isDeleted: users.isDeleted,
  deletedAt: users.deletedAt,
};

export class AdminUserService {
  private isRootUsername(username: string): boolean {
    return !!env.ROOT_ADMIN_USERNAME && username === env.ROOT_ADMIN_USERNAME;
  }

  async list(query: AdminUserListQuery) {
    const conditions = [];
    if (query.search) {
      conditions.push(
        or(
          insensitiveLike(users.username, `%${query.search}%`),
          insensitiveLike(users.tag, `%${query.search}%`),
        ),
      );
    }
    if (query.isAdmin !== undefined) {
      conditions.push(eq(users.isAdmin, query.isAdmin));
    }
    if (query.isDeleted !== undefined) {
      conditions.push(eq(users.isDeleted, query.isDeleted));
    }
    if (query.tierId) {
      conditions.push(eq(users.tierId, query.tierId));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      db.query.users.findMany({
        columns: ADMIN_USER_COLUMNS,
        where,
        orderBy: [asc(users.username)],
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      }),
      db.select({ total: count() }).from(users).where(where),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getById(id: string) {
    return db.query.users.findFirst({ columns: ADMIN_USER_COLUMNS, where: eq(users.id, id) });
  }

  async create(input: AdminCreateUser) {
    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, input.username),
    });
    if (existingUsername) {
      throw new UsernameAlreadyTakenError();
    }

    const hashedPassword = await hashPassword(input.password);
    const id = ulid();
    const desiredTag = input.tag ?? input.username;

    // The same suffix fallback as self-registration (auth.route.ts): the tag may already be taken even
    // when the username is not, since the two columns do not share uniqueness.
    let created;
    try {
      [created] = await db
        .insert(users)
        .values({
          id,
          username: input.username,
          tag: desiredTag,
          password: hashedPassword,
          isAdmin: input.isAdmin,
          tierId: input.tierId ?? null,
        })
        .returning(ADMIN_USER_RETURNING);
    } catch (error) {
      if (isUniqueViolation(error) && postgresErrorConstraint(error) === 'users_tag_lower_idx') {
        try {
          [created] = await db
            .insert(users)
            .values({
              id,
              username: input.username,
              tag: `${desiredTag}${id.slice(-4)}`,
              password: hashedPassword,
              isAdmin: input.isAdmin,
              tierId: input.tierId ?? null,
            })
            .returning(ADMIN_USER_RETURNING);
        } catch (retryError) {
          // Same case as `auth.route.ts`: the tag was only the first constraint complained about, and the
          // username is taken too. Which one the database reports first varies by engine.
          if (isUniqueViolation(retryError)) {
            throw new UsernameAlreadyTakenError();
          }
          throw retryError;
        }
      } else if (isUniqueViolation(error)) {
        // Not the tag constraint - a concurrent request created this exact username between
        // the pre-check above and this insert. Retrying with a suffixed tag (the tag-collision
        // path) would just fail again on the *username* constraint, unhandled this time.
        throw new UsernameAlreadyTakenError();
      } else {
        throw error;
      }
    }

    // The admin is creating the account on somebody else's behalf - shown here so they can pass them
    // along, since there is no email to send them later (see auth.route.ts /register, the same logic on
    // the self-service side).
    const recoveryCodes = await recoveryCodeService.generateCodes(created!.id);
    return { ...created!, recoveryCodes };
  }

  /** No confirmation of the current password - the admin acts on somebody else's behalf, this is not */
  async regenerateRecoveryCodes(id: string): Promise<string[]> {
    const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!existing) {
      throw new AdminUserNotFoundError();
    }
    return recoveryCodeService.generateCodes(id);
  }

  async update(id: string, patch: AdminUpdateUser) {
    const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!existing) {
      throw new AdminUserNotFoundError();
    }
    if (this.isRootUsername(existing.username) && patch.isAdmin === false) {
      throw new RootAdminProtectedError();
    }

    const [updated] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(ADMIN_USER_RETURNING);
    return updated;
  }

  async softDelete(id: string) {
    const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!existing) {
      throw new AdminUserNotFoundError();
    }
    if (this.isRootUsername(existing.username)) {
      throw new RootAdminProtectedError();
    }

    const [updated] = await db
      .update(users)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(ADMIN_USER_RETURNING);
    return updated;
  }

  async restore(id: string) {
    const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!existing) {
      throw new AdminUserNotFoundError();
    }

    const [updated] = await db
      .update(users)
      .set({ isDeleted: false, deletedAt: null, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning(ADMIN_USER_RETURNING);
    return updated;
  }
}

export const adminUserService = new AdminUserService();

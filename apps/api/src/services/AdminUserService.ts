import { AdminCreateUser, AdminUpdateUser, AdminUserListQuery } from '@keres/shared';
import * as bcrypt from 'bcrypt';
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '../config/env';
import { db } from '../db';
import { users } from '../db/schema';
import { isUniqueViolation } from '../utils/errors';
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
 * Recusa demover/excluir a conta root reconciliada via env (ver RootAdminService) - ela só
 * pode ser removida mudando/removendo as env vars e reiniciando a API, nunca pela UI.
 */
export class RootAdminProtectedError extends Error {
  constructor() {
    super(
      'The root admin account cannot be modified or deleted through the admin panel. Change ROOT_ADMIN_USERNAME/ROOT_ADMIN_PASSWORD and restart the API instead.',
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
        or(ilike(users.username, `%${query.search}%`), ilike(users.tag, `%${query.search}%`)),
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

    const hashedPassword = await bcrypt.hash(input.password, 10);
    const id = ulid();
    const desiredTag = input.tag ?? input.username;

    // Mesmo fallback de sufixo do auto-cadastro (auth.route.ts): a tag pode já estar em
    // uso mesmo que o username não esteja, já que as duas colunas não compartilham unicidade.
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
      if (isUniqueViolation(error)) {
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
      } else {
        throw error;
      }
    }

    // O admin está criando a conta em nome de outra pessoa - mostrados aqui pra ele
    // repassar, já que não há e-mail para enviá-los depois (ver auth.route.ts /register,
    // mesma lógica do lado do autosserviço).
    const recoveryCodes = await recoveryCodeService.generateCodes(created!.id);
    return { ...created!, recoveryCodes };
  }

  /** Sem confirmação da senha atual - o admin age em nome de outra pessoa, não é autosserviço. */
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

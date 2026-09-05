import type { UpdateUserProfileType, UserPublicInfo } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import { comparePassword, hashPassword } from '../config/bcrypt';
import { db } from '../db'; // Assuming 'db' is exported from '../db/index.ts'
import { users } from '../db/schema/tables/users'; // Import the users schema
import { isUniqueViolation, postgresErrorConstraint } from '../utils/errors';
import { recoveryCodeService } from './RecoveryCodeService';

export class TagAlreadyTakenError extends Error {
  constructor() {
    super('Tag is already taken.');
    this.name = 'TagAlreadyTakenError';
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super('Current password is incorrect.');
    this.name = 'InvalidCurrentPasswordError';
  }
}

// Shape differs between Drizzle's two query builders: the relational API (`db.query.users.
// findFirst`) takes `{ column: true }`, the core API's `.returning()` takes `{ alias: table.column }`.
const PUBLIC_INFO_COLUMNS = {
  id: true,
  username: true,
  tag: true,
  avatarColor: true,
  avatarIcon: true,
  bio: true,
} as const;

const PUBLIC_INFO_RETURNING = {
  id: users.id,
  username: users.username,
  tag: users.tag,
  avatarColor: users.avatarColor,
  avatarIcon: users.avatarIcon,
  bio: users.bio,
};

export class UserService {
  /** Live account used at login: a soft-deleted row must fail like a missing one. */
  async findLiveByUsername(username: string) {
    return db.query.users.findFirst({
      where: and(eq(users.username, username), eq(users.isDeleted, false)),
    });
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    const existing = await db.query.users.findFirst({
      where: eq(users.username, username),
      columns: { id: true },
    });
    return !!existing;
  }

  async isLiveUser(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.isDeleted, false)),
      columns: { id: true },
    });
    return !!user;
  }

  /**
   * Inserts a new account. On a tag collision, retries with a unique suffix. Returns `taken`
   * when the username is already claimed, including a race between the pre-check and the insert.
   */
  async createAccount(input: {
    id: string;
    username: string;
    hashedPassword: string;
    defaultTierId: string | null;
  }): Promise<{ id: string; username: string; tag: string } | 'taken'> {
    const values = {
      id: input.id,
      username: input.username,
      password: input.hashedPassword,
      tierId: input.defaultTierId,
    };
    try {
      const [created] = await db
        .insert(users)
        .values({ ...values, tag: input.username })
        .returning({ id: users.id, username: users.username, tag: users.tag });
      if (!created) throw new Error('Failed to create user');
      return created;
    } catch (error) {
      if (isUniqueViolation(error) && postgresErrorConstraint(error) === 'users_tag_lower_idx') {
        try {
          const [created] = await db
            .insert(users)
            .values({ ...values, tag: `${input.username}${input.id.slice(-4)}` })
            .returning({ id: users.id, username: users.username, tag: users.tag });
          if (!created) throw new Error('Failed to create user');
          return created;
        } catch (retryError) {
          if (isUniqueViolation(retryError)) return 'taken';
          throw retryError;
        }
      }
      if (isUniqueViolation(error)) return 'taken';
      throw error;
    }
  }

  async getUserById(userId: string): Promise<UserPublicInfo | undefined> {
    const user = await db.query.users.findFirst({
      columns: PUBLIC_INFO_COLUMNS,
      where: eq(users.id, userId),
    });
    return user;
  }

  // Case-insensitive lookup, matching the case-insensitive uniqueness the tag column
  // enforces (see users_tag_lower_idx) - "@Caio" and "@caio" must resolve to the same user.
  async getUserByTag(tag: string): Promise<UserPublicInfo | undefined> {
    const user = await db.query.users.findFirst({
      columns: PUBLIC_INFO_COLUMNS,
      where: sql`lower(${users.tag}) = lower(${tag})`,
    });
    return user;
  }

  async updateUserTag(userId: string, newTag: string): Promise<UserPublicInfo> {
    const existing = await this.getUserByTag(newTag);
    if (existing && existing.id !== userId) {
      throw new TagAlreadyTakenError();
    }

    const [updated] = await db
      .update(users)
      .set({ tag: newTag, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning(PUBLIC_INFO_RETURNING);

    if (!updated) {
      throw new Error('User not found.');
    }
    return updated;
  }

  async updateUserProfile(userId: string, profile: UpdateUserProfileType): Promise<UserPublicInfo> {
    const [updated] = await db
      .update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning(PUBLIC_INFO_RETURNING);

    if (!updated) {
      throw new Error('User not found.');
    }
    return updated;
  }

  /** Self-service: it requires the current password, unlike the admin panel's reset, which ignores it. */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { password: true },
    });
    if (!user) {
      throw new Error('User not found.');
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new InvalidCurrentPasswordError();
    }

    const hashedPassword = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /** Self-service: it requires the current password, same justification as changeOwnPassword. */
  async regenerateRecoveryCodes(userId: string, currentPassword: string): Promise<string[]> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { password: true },
    });
    if (!user) {
      throw new Error('User not found.');
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new InvalidCurrentPasswordError();
    }

    return recoveryCodeService.generateCodes(userId);
  }
}

export const userService = new UserService();

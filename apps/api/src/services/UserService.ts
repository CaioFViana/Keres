import { UpdateUserProfileType, UserPublicInfo } from '@keres/shared';
import { eq, sql } from 'drizzle-orm';
import { comparePassword, hashPassword } from '../config/bcrypt';
import { db } from '../db'; // Assuming 'db' is exported from '../db/index.ts'
import { users } from '../db/schema/tables/users'; // Import the users schema
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

  /** Auto-serviço: exige a senha atual, diferente do reset do painel admin que a ignora. */
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

  /** Auto-serviço: exige a senha atual, mesma justificativa de changeOwnPassword. */
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

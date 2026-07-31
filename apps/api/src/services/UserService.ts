import { UserPublicInfo } from '@keres/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db'; // Assuming 'db' is exported from '../db/index.ts'
import { users } from '../db/schema/tables/users'; // Import the users schema

export class TagAlreadyTakenError extends Error {
  constructor() {
    super('Tag is already taken.');
    this.name = 'TagAlreadyTakenError';
  }
}

export class UserService {
  async getUserById(userId: string): Promise<UserPublicInfo | undefined> {
    const user = await db.query.users.findFirst({
      columns: {
        id: true,
        username: true,
        tag: true,
      },
      where: eq(users.id, userId),
    });
    return user;
  }

  // Case-insensitive lookup, matching the case-insensitive uniqueness the tag column
  // enforces (see users_tag_lower_idx) - "@Caio" and "@caio" must resolve to the same user.
  async getUserByTag(tag: string): Promise<UserPublicInfo | undefined> {
    const user = await db.query.users.findFirst({
      columns: {
        id: true,
        username: true,
        tag: true,
      },
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
      .returning({ id: users.id, username: users.username, tag: users.tag });

    if (!updated) {
      throw new Error('User not found.');
    }
    return updated;
  }
}

export const userService = new UserService();

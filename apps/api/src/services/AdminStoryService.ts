import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { stories, storyInvitations, storyPermissions, users } from '../db/schema';
import { insensitiveLike } from '../db/sqlOperators';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { storyNsfwService } from './StoryNsfwService';

export interface AdminStoryListQuery {
  search?: string;
  nsfw?: boolean;
  page: number;
  pageSize: number;
}

/**
 * Story-level moderation for the administrators: finding NSFW stories, toggling the flag, and
 * removing a collaborator. Removing never requires the friendship the owner's own revocation
 * does - the administrator acts outside that relationship.
 */
export class AdminStoryService {
  async list(query: AdminStoryListQuery) {
    const conditions = [];
    if (query.nsfw !== undefined) {
      conditions.push(eq(stories.isNsfw, query.nsfw));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(insensitiveLike(stories.title, pattern));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: stories.id,
          title: stories.title,
          isNsfw: stories.isNsfw,
          isDeleted: stories.isDeleted,
          updatedAt: stories.updatedAt,
          ownerUserId: stories.userId,
          ownerUsername: users.username,
          ownerTag: users.tag,
          ownerDeleted: users.isDeleted,
        })
        .from(stories)
        .innerJoin(users, eq(users.id, stories.userId))
        .where(where)
        .orderBy(desc(stories.updatedAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(stories).where(where),
    ]);
    return { items: rows, total, page: query.page, pageSize: query.pageSize };
  }

  /** Toggles the adults-only flag. Turning it on expels whoever is not age-verified, at once. */
  async setNsfw(storyId: string, isNsfw: boolean) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    const [updated] = await db
      .update(stories)
      .set({ isNsfw, updatedAt: new Date(), version: story.version + 1 })
      .where(eq(stories.id, storyId))
      .returning({ id: stories.id, title: stories.title, isNsfw: stories.isNsfw });
    if (isNsfw) {
      await storyNsfwService.revokeUnverifiedCollaborators(storyId);
    }
    return updated;
  }

  /** Who collaborates on a story right now (owner excluded - they cannot be removed). */
  async collaborators(storyId: string) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    return db
      .select({
        permissionId: storyPermissions.id,
        userId: users.id,
        username: users.username,
        tag: users.tag,
        permissionType: storyPermissions.permissionType,
      })
      .from(storyPermissions)
      .innerJoin(users, eq(users.id, storyPermissions.userId))
      .where(
        and(
          eq(storyPermissions.storyId, storyId),
          eq(storyPermissions.isDeleted, false),
          eq(users.isDeleted, false),
        ),
      );
  }

  /**
   * Removes one collaborator (and their open invitations) from a story. The owner cannot be
   * removed - the story is theirs. Unlike the owner's revocation, no friendship is required.
   */
  async removeCollaborator(storyId: string, targetUserId: string) {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    if (story.userId === targetUserId) {
      throw new AppError(400, 'The owner cannot be removed from their own story.');
    }
    const permission = await db.query.storyPermissions.findFirst({
      where: and(
        eq(storyPermissions.storyId, storyId),
        eq(storyPermissions.userId, targetUserId),
        eq(storyPermissions.isDeleted, false),
      ),
    });
    if (!permission) {
      throw new AppError(404, 'This user does not collaborate on the story.');
    }
    await db
      .update(storyPermissions)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: permission.version + 1,
      })
      .where(eq(storyPermissions.id, permission.id));
    await db
      .delete(storyInvitations)
      .where(
        and(eq(storyInvitations.storyId, storyId), eq(storyInvitations.inviteeId, targetUserId)),
      );
    emitUserEvent(targetUserId, {
      type: 'story.access-revoked',
      storyId,
      storyTitle: story.title,
      reason: 'removed-by-admin',
    });
    emitUserEvent(targetUserId, { type: 'stories.catalog-changed' });
    emitUserEvent(story.userId, { type: 'story.collaborators-changed', storyId });
    return { message: 'Collaborator removed.' };
  }
}

export const adminStoryService = new AdminStoryService();

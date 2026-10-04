import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { stories, storyInvitations, storyPermissions, users } from '../db/schema';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';

export type NsfwRevocationReason =
  | 'nsfw-story'
  | 'verification-revoked'
  | 'account-deactivated'
  | 'removed-by-admin';

/**
 * Adults-only gating for stories. The flag lives on the story (`stories.is_nsfw`, owner-only via
 * `STORY_OWNER_ONLY_FIELDS`) and the verification on the user (`users.is_adult_verified`, set by
 * an administrator). Both are read from the database per check, never trusted from the client.
 *
 * The owner is never gated out of their own story: only collaborators (permissions and open
 * invitations) are blocked and expelled.
 */
export class StoryNsfwService {
  async isAdultVerified(userId: string): Promise<boolean> {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { isAdultVerified: true },
    });
    return row?.isAdultVerified === true;
  }

  /**
   * Refuses to give a non-verified user access to an NSFW story. The owner keeps full access to
   * their own story regardless of verification.
   */
  async assertNsfwAccessAllowed(storyId: string, targetUserId: string): Promise<void> {
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { userId: true, isNsfw: true, isDeleted: true },
    });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    if (!story.isNsfw || story.userId === targetUserId) {
      return;
    }
    if (!(await this.isAdultVerified(targetUserId))) {
      throw new AppError(403, 'Only age-verified (+18) users can join NSFW stories.');
    }
  }

  /**
   * Expels every non-verified collaborator (and drops their open invitations) from one NSFW story.
   * Runs when the story is flagged NSFW. Returns the expelled user ids.
   */
  async revokeUnverifiedCollaborators(storyId: string): Promise<string[]> {
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { id: true, title: true, userId: true, isNsfw: true, isDeleted: true },
    });
    if (!story || story.isDeleted || !story.isNsfw) {
      return [];
    }
    const live = await db
      .select({
        permissionId: storyPermissions.id,
        userId: storyPermissions.userId,
        version: storyPermissions.version,
      })
      .from(storyPermissions)
      .innerJoin(users, eq(users.id, storyPermissions.userId))
      .where(
        and(
          eq(storyPermissions.storyId, storyId),
          eq(storyPermissions.isDeleted, false),
          eq(users.isAdultVerified, false),
        ),
      );
    return this.expel(story.id, story.title, story.userId, live, 'nsfw-story');
  }

  /**
   * Removes one user from every NSFW story they collaborate on (permissions and open invitations).
   * Runs when their +18 verification is revoked or their account is deactivated. Returns the
   * stories they were removed from.
   */
  async removeUserFromNsfwStories(
    userId: string,
    reason: Extract<NsfwRevocationReason, 'verification-revoked' | 'account-deactivated'>,
  ): Promise<{ storyId: string; title: string }[]> {
    const rows = await db
      .select({
        storyId: stories.id,
        title: stories.title,
        ownerUserId: stories.userId,
        permissionId: storyPermissions.id,
        version: storyPermissions.version,
      })
      .from(storyPermissions)
      .innerJoin(stories, eq(stories.id, storyPermissions.storyId))
      .where(
        and(
          eq(storyPermissions.userId, userId),
          eq(storyPermissions.isDeleted, false),
          eq(stories.isNsfw, true),
          eq(stories.isDeleted, false),
        ),
      );
    const removed: { storyId: string; title: string }[] = [];
    for (const row of rows) {
      await db
        .update(storyPermissions)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: row.version + 1,
        })
        .where(eq(storyPermissions.id, row.permissionId));
      await db
        .delete(storyInvitations)
        .where(
          and(eq(storyInvitations.storyId, row.storyId), eq(storyInvitations.inviteeId, userId)),
        );
      emitUserEvent(userId, {
        type: 'story.access-revoked',
        storyId: row.storyId,
        storyTitle: row.title,
        reason,
      });
      emitUserEvent(userId, { type: 'stories.catalog-changed' });
      emitUserEvent(row.ownerUserId, { type: 'story.collaborators-changed', storyId: row.storyId });
      removed.push({ storyId: row.storyId, title: row.title });
    }
    return removed;
  }

  private async expel(
    storyId: string,
    title: string,
    ownerUserId: string,
    live: { permissionId: string; userId: string; version: number }[],
    reason: NsfwRevocationReason,
  ): Promise<string[]> {
    if (live.length === 0) {
      return [];
    }
    const userIds = [...new Set(live.map((row) => row.userId))];
    // One row at a time so each tombstone carries its own version bump, like the owner's
    // revocation does - a shared version would break the sync conflict screen's base.
    for (const row of live) {
      await db
        .update(storyPermissions)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: row.version + 1,
        })
        .where(eq(storyPermissions.id, row.permissionId));
    }
    await db
      .delete(storyInvitations)
      .where(
        and(eq(storyInvitations.storyId, storyId), inArray(storyInvitations.inviteeId, userIds)),
      );
    for (const userId of userIds) {
      emitUserEvent(userId, {
        type: 'story.access-revoked',
        storyId,
        storyTitle: title,
        reason,
      });
      emitUserEvent(userId, { type: 'stories.catalog-changed' });
    }
    emitUserEvent(ownerUserId, { type: 'story.collaborators-changed', storyId });
    return userIds;
  }
}

export const storyNsfwService = new StoryNsfwService();

import { and, eq, or, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, type CompatibleDb } from '../db';
import { stories, storyInvitations, storyPermissions } from '../db/schema';
import { FriendStatus } from '@keres/shared';
import { friendships } from '../db/schema/tables/friendships';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { storyNsfwService } from './StoryNsfwService';

export class StoryPermissionService {
  /** The owner's devices re-read who collaborates on the story. */
  private notifyOwner(ownerUserId: string, storyId: string): void {
    emitUserEvent(ownerUserId, { type: 'story.collaborators-changed', storyId });
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await db.query.friendships.findFirst({
      where: and(
        or(
          and(eq(friendships.senderId, userId1), eq(friendships.receiverId, userId2)),
          and(eq(friendships.senderId, userId2), eq(friendships.receiverId, userId1)),
        ),
        eq(friendships.status, FriendStatus.FRIEND),
      ),
    });
    return !!friendship;
  }

  /**
   * Everything one of these users holds on the other's stories: permissions and open invitations,
   * both directions. Runs when a friendship ends (decline, unfriend, blacklist) - access and offers of
   * access only ever exist between friends.
   */
  async deleteAccessBetweenUsers(userA: string, userB: string): Promise<void> {
    await db
      .delete(storyInvitations)
      .where(
        or(
          and(eq(storyInvitations.inviterId, userA), eq(storyInvitations.inviteeId, userB)),
          and(eq(storyInvitations.inviterId, userB), eq(storyInvitations.inviteeId, userA)),
        ),
      );
    await this.deletePermissionsBetweenUsers(userA, userB);
  }

  private async deletePermissionsBetweenUsers(userA: string, userB: string): Promise<void> {
    // 1. Select the IDs of permissions to delete where userB is target and userA is story owner
    const permissionsToDelete1 = await db
      .select({ id: storyPermissions.id, storyId: storyPermissions.storyId })
      .from(storyPermissions)
      .innerJoin(stories, eq(storyPermissions.storyId, stories.id))
      .where(
        and(
          eq(storyPermissions.userId, userB), // targetUser
          eq(stories.userId, userA), // owner of the story
        ),
      )
      .execute();

    const idsToDelete1 = permissionsToDelete1.map((p) => p.id);

    if (idsToDelete1.length > 0) {
      await db.delete(storyPermissions).where(inArray(storyPermissions.id, idsToDelete1)).execute();
      // userB lost access to userA's stories: their copies must go, and userA's list changed.
      emitUserEvent(userB, { type: 'stories.catalog-changed' });
      for (const { storyId } of permissionsToDelete1) this.notifyOwner(userA, storyId);
    }

    // 2. Select the IDs of permissions to delete where userA is target and userB is story owner
    const permissionsToDelete2 = await db
      .select({ id: storyPermissions.id, storyId: storyPermissions.storyId })
      .from(storyPermissions)
      .innerJoin(stories, eq(storyPermissions.storyId, stories.id))
      .where(
        and(
          eq(storyPermissions.userId, userA), // targetUser
          eq(stories.userId, userB), // owner of the story
        ),
      )
      .execute();

    const idsToDelete2 = permissionsToDelete2.map((p) => p.id);

    if (idsToDelete2.length > 0) {
      await db.delete(storyPermissions).where(inArray(storyPermissions.id, idsToDelete2)).execute();
      emitUserEvent(userA, { type: 'stories.catalog-changed' });
      for (const { storyId } of permissionsToDelete2) this.notifyOwner(userB, storyId);
    }
  }

  /**
   * Changes the role of somebody who already collaborates on the story. Access is never created here:
   * a new collaborator is invited (`StoryInvitationService`) and only their acceptance grants it.
   */
  async updateStoryPermission(
    ownerUserId: string,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer',
  ) {
    // `AppError` and not `Error`: these are deliberate refusals, with a message the user needs to read. A
    // plain `Error` here does not match the "Unauthorized" prefix `withOwnershipCheck` translates, falls
    // into `onError`'s fallback and reaches the client as "Internal server error." - indistinguishable from
    // a real failure.
    if (ownerUserId === targetUserId) {
      throw new AppError(
        400,
        'The story owner already has full permissions and cannot be assigned additional permissions.',
      );
    }
    if (!(await this.areFriends(ownerUserId, targetUserId))) {
      throw new AppError(403, 'Permission can only be granted to friends.');
    }
    if (!(await this.isStoryOwner(ownerUserId, storyId))) {
      throw new Error('Unauthorized: Story not found or not owned by user.');
    }

    const existingPermission = await this.getUserPermissionForStory(targetUserId, storyId);
    if (!existingPermission) {
      throw new AppError(
        409,
        'This user does not collaborate on the story yet: invite them, and access starts when they accept.',
      );
    }
    // A role change must not smuggle a non-verified user into an NSFW story.
    await storyNsfwService.assertNsfwAccessAllowed(storyId, targetUserId);
    const [updatedPermission] = await db
      .update(storyPermissions)
      .set({
        permissionType,
        updatedAt: new Date(),
        version: existingPermission.version + 1,
      })
      .where(eq(storyPermissions.id, existingPermission.id))
      .returning();
    emitUserEvent(targetUserId, { type: 'stories.catalog-changed' });
    this.notifyOwner(ownerUserId, storyId);
    return updatedPermission;
  }

  /**
   * Grants access - the one place that creates it, reached only by an accepted invitation. Revives a
   * revoked row instead of adding a second one for the same person and story.
   */
  async grantAccess(
    storyId: string,
    userId: string,
    permissionType: 'reader' | 'writer',
    database: CompatibleDb = db,
  ) {
    const existing = await database.query.storyPermissions.findFirst({
      where: and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.userId, userId)),
    });
    const now = new Date();
    if (existing) {
      const [revived] = await database
        .update(storyPermissions)
        .set({
          permissionType,
          updatedAt: now,
          version: existing.version + 1,
          isDeleted: false,
          deletedAt: null,
        })
        .where(eq(storyPermissions.id, existing.id))
        .returning();
      return revived;
    }
    const [created] = await database
      .insert(storyPermissions)
      .values({
        id: ulid(),
        storyId,
        userId,
        permissionType,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      })
      .returning();
    return created;
  }

  async deleteStoryPermission(ownerUserId: string, storyId: string, targetUserId: string) {
    // New: Check if ownerUserId and targetUserId are friends
    if (!(await this.areFriends(ownerUserId, targetUserId))) {
      throw new AppError(403, 'Permission can only be revoked from friends.');
    }

    // 1. Verify ownerUserId owns the story
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, ownerUserId)),
    });

    if (!story) {
      throw new Error('Unauthorized: Story not found or not owned by user.');
    }

    // 2. Find the permission to delete
    const permission = await db.query.storyPermissions.findFirst({
      where: and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.userId, targetUserId)),
    });

    if (!permission) {
      // Same reasoning as the `targetUser` check in `upsertStoryPermission` above: `AppError`
      // so this reaches the client as 404, not the generic 500 a plain `Error` would fall
      // back to (its message doesn't start with "Unauthorized").
      throw new AppError(404, 'Story permission not found for this user on this story.');
    }

    // 3. Mark permission as deleted (soft delete)
    await db
      .update(storyPermissions)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
        version: permission.version + 1,
      })
      .where(eq(storyPermissions.id, permission.id));

    emitUserEvent(targetUserId, { type: 'stories.catalog-changed' });
    // The owner's other devices, which still show the collaborator.
    this.notifyOwner(ownerUserId, storyId);

    return { message: 'Story permission deleted successfully.' };
  }

  /**
   * A collaborator leaves the story on their own: the same soft delete the owner's revocation does (the
   * row stays so sync can carry the tombstone), started from the other side. No friendship check: what
   * is being given up is one's own access.
   * The owner cannot leave: the story is theirs, and ending it is deleting it.
   */
  async leaveStory(userId: string, storyId: string) {
    if (await this.isStoryOwner(userId, storyId)) {
      throw new AppError(400, 'The owner cannot leave their own story: delete it instead.');
    }
    const permission = await this.getUserPermissionForStory(userId, storyId);
    if (!permission) {
      throw new AppError(404, 'You do not collaborate on this story.');
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

    // Their own open sockets rebuild the story subscriptions from the permissions they hold now...
    emitUserEvent(userId, { type: 'stories.catalog-changed' });
    // ...and the owner, on every device, is told the collaborator list changed.
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { userId: true },
    });
    if (story) this.notifyOwner(story.userId, storyId);

    return { message: 'You left the story.' };
  }

  async getStoryPermissionsForStory(ownerUserId: string, storyId: string) {
    // 1. Verify ownerUserId owns the story
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, ownerUserId)),
    });

    if (!story) {
      throw new Error('Unauthorized: Story not found or not owned by user.');
    }

    // 2. Fetch permissions for the story
    const permissions = await db.query.storyPermissions.findMany({
      // Revoked rows stay (soft delete) but are no collaborators: listed, they came back after every
      // reload and kept blocking "unlink from server".
      where: and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.isDeleted, false)),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
          },
        },
      },
    });

    return permissions;
  }

  /**
   * The `isDeleted` in the filter is what makes a revocation stick.
   *
   * `deleteStoryPermission` is a soft delete (the row has to survive so the client receives the tombstone
   * through sync). Without excluding it here, every caller - `hasPermission` (story export, media routes,
   * WebSocket) and the two points in `SyncService` that derive the user's role - kept seeing the removed
   * collaborator as if they still had access. `getReadableStoryIds` already filtered, and that alone was
   * why the story disappeared from the `pullpreviews` list while remaining accessible by id.
   */
  async getUserPermissionForStory(userId: string, storyId: string) {
    const permission = await db.query.storyPermissions.findFirst({
      where: and(
        eq(storyPermissions.storyId, storyId),
        eq(storyPermissions.userId, userId),
        eq(storyPermissions.isDeleted, false),
      ),
    });
    return permission;
  }

  async isStoryOwner(userId: string, storyId: string): Promise<boolean> {
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, userId)),
    });
    return !!story;
  }

  async hasPermission(
    userId: string,
    storyId: string,
    minimumPermissionType: 'reader' | 'writer',
  ): Promise<boolean> {
    // Check if the user is the owner of the story
    const owner = await this.isStoryOwner(userId, storyId);
    if (owner) {
      return true;
    }

    // Check if the user has explicit read/write permission
    const permission = await this.getUserPermissionForStory(userId, storyId);
    if (!permission) {
      return false; // No permission record exists
    }

    // Compare permission level
    if (minimumPermissionType === 'reader') {
      // 'reader' or 'writer' satisfies 'reader' requirement
      return permission.permissionType === 'reader' || permission.permissionType === 'writer';
    } else if (minimumPermissionType === 'writer') {
      // Only 'writer' satisfies 'writer' requirement
      return permission.permissionType === 'writer';
    }
    return false; // Should not reach here
  }

  async getReadableStoryIds(userId: string): Promise<string[]> {
    const owned = await db
      .select({ id: stories.id })
      .from(stories)
      .where(and(eq(stories.userId, userId), eq(stories.isDeleted, false)));
    const shared = await db
      .select({ storyId: storyPermissions.storyId })
      .from(storyPermissions)
      .where(and(eq(storyPermissions.userId, userId), eq(storyPermissions.isDeleted, false)));
    return [
      ...new Set([
        ...owned.map((story) => story.id),
        ...shared.map((permission) => permission.storyId),
      ]),
    ];
  }
}

export const storyPermissionService = new StoryPermissionService();

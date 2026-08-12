import { and, eq, or, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { stories, storyPermissions, users } from '../db/schema';
import { FriendStatus } from '@keres/shared';
import { friendships } from '../db/schema/tables/friendships';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';

export class StoryPermissionService {
  // Helper method to check if two users are friends
  private async _areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await db.query.friendships.findFirst({
      where: and(
        or(
          and(eq(friendships.senderId, userId1), eq(friendships.receiverId, userId2)),
          and(eq(friendships.senderId, userId2), eq(friendships.receiverId, userId1))
        ),
        eq(friendships.status, FriendStatus.FRIEND)
      ),
    });
    return !!friendship;
  }

  async deletePermissionsBetweenUsers(userA: string, userB: string): Promise<void> {
    // 1. Select the IDs of permissions to delete where userB is target and userA is story owner
    const permissionsToDelete1 = await db.select({ id: storyPermissions.id })
      .from(storyPermissions)
      .innerJoin(stories, eq(storyPermissions.storyId, stories.id))
      .where(
        and(
          eq(storyPermissions.userId, userB), // targetUser
          eq(stories.userId, userA) // owner of the story
        )
      )
      .execute();

    const idsToDelete1 = permissionsToDelete1.map(p => p.id);

    if (idsToDelete1.length > 0) {
      await db.delete(storyPermissions).where(inArray(storyPermissions.id, idsToDelete1)).execute();
    }

    // 2. Select the IDs of permissions to delete where userA is target and userB is story owner
    const permissionsToDelete2 = await db.select({ id: storyPermissions.id })
      .from(storyPermissions)
      .innerJoin(stories, eq(storyPermissions.storyId, stories.id))
      .where(
        and(
          eq(storyPermissions.userId, userA), // targetUser
          eq(stories.userId, userB) // owner of the story
        )
      )
      .execute();

    const idsToDelete2 = permissionsToDelete2.map(p => p.id);

    if (idsToDelete2.length > 0) {
      await db.delete(storyPermissions).where(inArray(storyPermissions.id, idsToDelete2)).execute();
    }
  }

  async upsertStoryPermission(
    ownerUserId: string,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer'
  ) {
    // `AppError` e não `Error`: são recusas deliberadas, com mensagem que o usuário precisa
    // ler. Um `Error` simples aqui não bate com o prefixo "Unauthorized" que
    // `withOwnershipCheck` traduz, cai no fallback do `onError` e chega ao cliente como
    // "Internal server error." - indistinguível de uma falha de verdade.
    if (ownerUserId === targetUserId) {
      throw new AppError(400, 'The story owner already has full permissions and cannot be assigned additional permissions.');
    }

    // New: Check if ownerUserId and targetUserId are friends
    const areFriends = await this._areFriends(ownerUserId, targetUserId);
    if (!areFriends) {
      throw new AppError(403, 'Permission can only be granted to friends.');
    }

    // 1. Verify ownerUserId owns the story
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, ownerUserId)),
    });

    if (!story) {
      throw new Error('Unauthorized: Story not found or not owned by user.');
    }

    // 2. Ensure targetUserId exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });

    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    // 3. Check if permission already exists
    const existingPermission = await db.query.storyPermissions.findFirst({
      where: and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.userId, targetUserId)),
    });

    if (existingPermission) {
      // Update existing permission
      const updatedPermission = await db
        .update(storyPermissions)
        .set({
          permissionType,
          updatedAt: new Date(),
          version: existingPermission.version + 1,
          isDeleted: false, // Ensure it's not marked as deleted if it was before
          deletedAt: null,
        })
        .where(eq(storyPermissions.id, existingPermission.id))
        .returning();
      emitUserEvent(targetUserId, { type: 'stories.catalog-changed' });
      return updatedPermission[0];
    } else {
      // Create new permission
      const newPermission = {
        id: ulid(),
        storyId,
        userId: targetUserId,
        permissionType,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      await db.insert(storyPermissions).values(newPermission);
      emitUserEvent(targetUserId, { type: 'stories.catalog-changed' });
      return newPermission;
    }
  }

  async deleteStoryPermission(ownerUserId: string, storyId: string, targetUserId: string) {
    // New: Check if ownerUserId and targetUserId are friends
    const areFriends = await this._areFriends(ownerUserId, targetUserId);
    if (!areFriends) {
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
      throw new Error('Story permission not found for this user on this story.');
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

    return { message: 'Story permission deleted successfully.' };
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
      where: eq(storyPermissions.storyId, storyId),
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
   * O `isDeleted` no filtro é o que faz uma revogação valer.
   *
   * `deleteStoryPermission` é soft delete (a linha precisa sobreviver para o cliente receber
   * o tombstone pelo sync). Sem excluí-la aqui, todo chamador - `hasPermission` (export de
   * história, rotas de mídia, WebSocket) e os dois pontos de `SyncService` que derivam o
   * papel do usuário - continuava enxergando o colaborador removido como se ele ainda
   * tivesse acesso. `getReadableStoryIds` já filtrava, e era só por isso que a história
   * sumia da lista do `pullpreviews` enquanto continuava acessível por id.
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

  async hasPermission(userId: string, storyId: string, minimumPermissionType: 'reader' | 'writer'): Promise<boolean> {
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
    const owned = await db.select({ id: stories.id }).from(stories)
      .where(and(eq(stories.userId, userId), eq(stories.isDeleted, false)));
    const shared = await db.select({ storyId: storyPermissions.storyId }).from(storyPermissions)
      .where(and(eq(storyPermissions.userId, userId), eq(storyPermissions.isDeleted, false)));
    return [...new Set([...owned.map((story) => story.id), ...shared.map((permission) => permission.storyId)])];
  }
}

export const storyPermissionService = new StoryPermissionService();

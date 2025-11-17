import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { stories, storyPermissions, users } from '../db/schema';

export class StoryPermissionService {
  async upsertStoryPermission(
    ownerUserId: string,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer'
  ) {
    if (ownerUserId === targetUserId) {
      throw new Error('The story owner already has full permissions and cannot be assigned additional permissions.');
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
      return newPermission;
    }
  }

  async deleteStoryPermission(ownerUserId: string, storyId: string, targetUserId: string) {
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

  async getUserPermissionForStory(userId: string, storyId: string) {
    const permission = await db.query.storyPermissions.findFirst({
      where: and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.userId, userId)),
    });
    return permission;
  }

  async isStoryOwner(userId: string, storyId: string): Promise<boolean> {
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.userId, userId)),
    });
    return !!story;
  }

  async hasPermission(userId: string, storyId: string): Promise<boolean> {
    // Check if the user is the owner of the story
    const owner = await this.isStoryOwner(userId, storyId);
    if (owner) {
      return true;
    }

    // Check if the user has explicit read/write permission
    const permission = await this.getUserPermissionForStory(userId, storyId);
    return !!permission; // If a permission record exists, they have some access
  }
}

export const storyPermissionService = new StoryPermissionService();

import {
  CreateStoryPermissionSchema,
  StoryAndTargetUserParams, // Import the new schema
  StoryIdParam,
} from '@keres/shared';
import { Elysia } from 'elysia';
import { JWTPayload } from '../../index'; // Import JWTPayload
import { storyPermissionService } from '../../services/StoryPermissionService';
import { AppError } from '../../utils/errors';

/**
 * `StoryPermissionService` throws plain `Error`s for its ownership checks (message starting
 * with "Unauthorized") - without translating those to a real status here, they'd fall through
 * to Elysia's generic 500 fallback, indistinguishable from an actual server fault. Clients
 * (e.g. the "unlink from server" ownership/collaborator gate) need a reliable 403 to tell
 * "you're not the owner" apart from "something broke".
 */
async function withOwnershipCheck<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      throw new AppError(403, error.message);
    }
    throw error;
  }
}

export const storyPermissionRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null) // Decorate 'user' property
  .post(
    '/',
    async ({ body, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return withOwnershipCheck(() =>
        storyPermissionService.upsertStoryPermission(
          user.userId,
          body.storyId,
          body.targetUserId,
          body.permissionType,
        ),
      );
    },
    {
      body: CreateStoryPermissionSchema, // This schema now serves for upsert
      detail: {
        summary: 'Create or update a story permission',
        description:
          'Allows the story owner to grant or update read/write permissions for another user on a specific story. If a permission already exists for the user and story, it will be updated; otherwise, a new one will be created.',
        tags: ['Story Permissions'],
      },
    },
  )
  .delete(
    '/story/:storyId/user/:targetUserId', // New path for delete
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return withOwnershipCheck(() =>
        storyPermissionService.deleteStoryPermission(
          user.userId,
          params.storyId,
          params.targetUserId,
        ),
      );
    },
    {
      params: StoryAndTargetUserParams, // Use the new params schema
      detail: {
        summary: 'Delete a story permission',
        description:
          'Allows the story owner to revoke an existing story permission for a specific user on a specific story.',
        tags: ['Story Permissions'],
      },
    },
  )
  .get(
    '/story/:storyId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return withOwnershipCheck(() =>
        storyPermissionService.getStoryPermissionsForStory(user.userId, params.storyId),
      );
    },
    {
      params: StoryIdParam,
      detail: {
        summary: 'Get all story permissions for a specific story',
        description:
          'Allows the story owner to retrieve a list of all permissions granted for a specific story.',
        tags: ['Story Permissions'],
      },
    },
  );

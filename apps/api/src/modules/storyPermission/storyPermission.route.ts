import {
  CreateStoryPermissionSchema,
  StoryAndTargetUserParams, // Import the new schema
  StoryIdParam,
} from '@keres/shared';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index'; // Import JWTPayload
import { storyPermissionService } from '../../services/StoryPermissionService';
import { AppError } from '../../utils/errors';

/** Shape of a `story_permissions` row as returned by upsertStoryPermission - both its
 *  create and update branches now return every one of these fields (see the comment on
 *  the create branch's object literal in StoryPermissionService.ts). */
const StoryPermissionResponseSchema = t.Object({
  id: t.String(),
  storyId: t.String(),
  userId: t.String(),
  permissionType: t.String(),
  version: t.Number(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  isDeleted: t.Boolean(),
  deletedAt: t.Nullable(t.Date()),
});

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
      response: StoryPermissionResponseSchema,
      detail: {
        summary: 'Create or update a story permission',
        description:
          'Allows the story owner to grant or update read/write permissions for another user on a specific story. If a permission already exists for the user and story, it will be updated; otherwise, a new one will be created. The target user must already be a friend of the owner (403 otherwise) - see StoryPermissionService.upsertStoryPermission.',
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
      response: t.Object({ message: t.String() }),
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
      response: t.Array(
        t.Composite([
          StoryPermissionResponseSchema,
          t.Object({ user: t.Object({ id: t.String(), username: t.String() }) }),
        ]),
      ),
      detail: {
        summary: 'Get all story permissions for a specific story',
        description:
          'Allows the story owner to retrieve a list of all permissions granted for a specific story.',
        tags: ['Story Permissions'],
      },
    },
  );

import {
  CreateStoryPermissionSchema,
  StoryAndTargetUserParams, // Import the new schema
  StoryIdParam,
} from '@keres/shared';
import { Elysia } from 'elysia';
import { JWTPayload } from '../../index'; // Import JWTPayload
import { storyPermissionService } from '../../services/StoryPermissionService';

export const storyPermissionRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null) // Decorate 'user' property
    .post(
      '/',
      async ({ body, user, set }) => {
        if (!user || !user.userId) {
          set.status = 401;
          throw new Error('Unauthorized: User not authenticated.');
        }
        return storyPermissionService.upsertStoryPermission(
          user.userId,
          body.storyId,
          body.targetUserId,
          body.permissionType
        );
      },
      {
        body: CreateStoryPermissionSchema, // This schema now serves for upsert
        detail: {
          summary: 'Create or update a story permission',
          description: 'Allows the story owner to grant or update read/write permissions for another user on a specific story. If a permission already exists for the user and story, it will be updated; otherwise, a new one will be created.',
          tags: ['Story Permissions'],
        },
      }
    )
    .delete(
      '/story/:storyId/user/:targetUserId', // New path for delete
      async ({ params, user, set }) => {
        if (!user || !user.userId) {
          set.status = 401;
          throw new Error('Unauthorized: User not authenticated.');
        }
        return storyPermissionService.deleteStoryPermission(
          user.userId,
          params.storyId,
          params.targetUserId
        );
      },
      {
        params: StoryAndTargetUserParams, // Use the new params schema
        detail: {
          summary: 'Delete a story permission',
          description: 'Allows the story owner to revoke an existing story permission for a specific user on a specific story.',
          tags: ['Story Permissions'],
        },
      }
    )
    .get(
      '/story/:storyId',
      async ({ params, user, set }) => {
        if (!user || !user.userId) {
          set.status = 401;
          throw new Error('Unauthorized: User not authenticated.');
        }
        return storyPermissionService.getStoryPermissionsForStory(user.userId, params.storyId);
      },
      {
        params: StoryIdParam,
        detail: {
          summary: 'Get all story permissions for a specific story',
          description: 'Allows the story owner to retrieve a list of all permissions granted for a specific story.',
          tags: ['Story Permissions'],
        },
      }
  );

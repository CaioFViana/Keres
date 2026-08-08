import { StoryUpdatesArraySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { syncService } from '../../services/SyncService';
import { logger } from '../../utils/logger';

export const syncRoute = new Elysia()
  .decorate('user', null as JWTPayload | null) // Explicitly decorate 'user' property
  .post('/:storyId', async ({ params, body, user, set }) => { // Destructure 'user' and 'set'
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    const { storyId } = params;
    const parsedUpdates = StoryUpdatesArraySchema.parse(body);

    const { lastOperationVersion, applied, conflicts } = await syncService.processAndRecordUpdates(user.userId, storyId, parsedUpdates);

    logger.info('Received sync updates', { storyId, applied: applied.length, conflicts: conflicts.length, lastOperationVersion });

    return {
      message: `Sync updates received and processed for story ${storyId}`,
      processedUpdates: parsedUpdates.length,
      serverMaxOperationVersion: lastOperationVersion,
      // Resultado por operação: sem isto o cliente não distingue quais operações passaram
      // e quais foram recusadas, e acaba marcando as recusadas como sincronizadas.
      applied,
      conflicts,
    };
  }, {
    params: t.Object({
      storyId: t.String(), // ULID for the story
    }),
    body: StoryUpdatesArraySchema, // Elysia will use this for validation and OpenAPI spec
    detail: {
      summary: 'Synchronize local story updates with the server',
      description: 'Receives an array of story updates (create, update, delete) from a client and applies them to the server database, handling conflict resolution.',
      tags: ['Sync'],
    },
  })
  .get('/:storyId/pull', async ({ params, query, user, set }) => { // Destructure 'user' and 'set'
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    const { storyId } = params;
    const { lastOperationVersion, lastPublicFavoriteVersion } = query;

    const { updates, serverMaxOperationVersion, role } = await syncService.getUpdatesForStory(
      user.userId,
      storyId,
      lastOperationVersion,
      lastPublicFavoriteVersion,
    );

    logger.info('Received pull request', { storyId, lastOperationVersion, updatesFound: updates.length, serverMaxOperationVersion });

    return {
      message: `Pull request received for story ${storyId}`,
      updates: updates,
      serverMaxOperationVersion: serverMaxOperationVersion, // Include the server's max operation version
      role,
    };
  }, {
    params: t.Object({
      storyId: t.String(), // ULID for the story
    }),
    query: t.Object({
      lastOperationVersion: t.Numeric({ minimum: 0 }), // Expecting a numeric version
      lastPublicFavoriteVersion: t.Optional(t.Numeric({ minimum: 0 })),
    }),
    detail: {
      summary: 'Pull story updates from the server',
      description: 'Allows clients to request story updates from the server for a specific story since their last known operation version.',
      tags: ['Sync'],
    },
    response: t.Object({ // Update the response schema
      message: t.String(),
      updates: t.Array(t.Any()), // updates are StoryUpdate objects, using t.Any() for simplicity, can be more specific
      serverMaxOperationVersion: t.Number(),
      role: t.Union([t.Literal('owner'), t.Literal('writer'), t.Literal('reader')]),
    }),
  })
  .get('/pullpreviews', async ({ user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    const storyPreviews = await syncService.getStoriesWithLastOperationVersionForUser(user.userId);

    return {
      message: 'Successfully fetched story previews.',
      storyPreviews: storyPreviews,
    };
  }, {
    detail: {
      summary: 'Get previews of all stories accessible by the user',
      description: 'Returns a list of story IDs and their latest operation versions for all stories the authenticated user owns or has read/write permissions for.',
      tags: ['Sync'],
    },
    response: t.Object({
      message: t.String(),
      storyPreviews: t.Array(
        t.Object({
          storyId: t.String(),
          lastOperationVersion: t.Number(),
          role: t.Union([t.Literal('owner'), t.Literal('writer'), t.Literal('reader')]),
        })
      ),
    }),
  });

import { Elysia, t } from 'elysia';
import { StoryUpdatesArraySchema } from '../../schemas/SyncSchemas';
import { syncService } from '../../services/SyncService'; // Import the syncService
import { JWTPayload } from '../../index'; // Import JWTPayload

export const syncRoute = new Elysia()
  .decorate('user', null as JWTPayload | null) // Explicitly decorate 'user' property
  .post('/:storyId', async ({ params, body, user, set }) => { // Destructure 'user' and 'set'
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    const { storyId } = params;
    const parsedUpdates = StoryUpdatesArraySchema.parse(body);

    const { lastOperationVersion } = await syncService.processAndRecordUpdates(user.userId, storyId, parsedUpdates);

    console.log(`Received sync updates for story ${storyId}. Last operation version: ${lastOperationVersion}`);

    return {
      message: `Sync updates received and processed for story ${storyId}`,
      processedUpdates: parsedUpdates.length,
      lastOperationVersion: lastOperationVersion,
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
    const { lastOperationVersion } = query;

    const updates = await syncService.getUpdatesForStory(user.userId, storyId, lastOperationVersion);

    console.log(`Received pull request for storyId: ${storyId} with lastOperationVersion: ${lastOperationVersion}. Found ${updates.length} updates.`);

    return {
      message: `Pull request received for story ${storyId}`,
      updates: updates,
    };
  }, {
    params: t.Object({
      storyId: t.String(), // ULID for the story
    }),
    query: t.Object({
      lastOperationVersion: t.Numeric({ minimum: 0 }), // Expecting a numeric version
    }),
    detail: {
      summary: 'Pull story updates from the server',
      description: 'Allows clients to request story updates from the server for a specific story since their last known operation version.',
      tags: ['Sync'],
    },
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
        })
      ),
    }),
  });

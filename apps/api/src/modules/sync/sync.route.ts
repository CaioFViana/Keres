import { StoryUpdatesArraySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { syncService } from '../../services/SyncService';
import { logger } from '../../utils/logger';

/** Mirrors SyncConflictSchema (packages/shared) - not the Zod schema itself, same reasoning
 *  as the body comment below: Elysia's OpenAPI output from a Zod schema isn't valid JSON
 *  Schema, so this is hand-written to actually render in swagger. */
const SyncConflictResponseSchema = t.Object({
  clientOperationId: t.Optional(t.String()),
  entity: t.String(),
  entityId: t.String(),
  type: t.String(),
  reason: t.String(),
  message: t.String(),
  clientVersion: t.Optional(t.Number()),
  serverVersion: t.Optional(t.Number()),
  serverEntity: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  attemptedChanges: t.Optional(t.Record(t.String(), t.Any())),
});

/** Mirrors SyncAppliedOperationSchema (packages/shared). */
const SyncAppliedOperationResponseSchema = t.Object({
  clientOperationId: t.Optional(t.String()),
  operationId: t.Optional(t.String()),
  operationVersion: t.Number(),
  entityVersion: t.Optional(t.Number()),
  entity: t.String(),
  entityId: t.String(),
});

export const syncRoute = new Elysia()
  .decorate('user', null as JWTPayload | null) // Explicitly decorate 'user' property
  .post(
    '/:storyId',
    async ({ params, body, user, set }) => {
      // Destructure 'user' and 'set'
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }

      const { storyId } = params;
      const parsedUpdates = StoryUpdatesArraySchema.parse(body);

      const { lastOperationVersion, applied, conflicts } =
        await syncService.processAndRecordUpdates(user.userId, storyId, parsedUpdates);

      logger.info('Received sync updates', {
        storyId,
        applied: applied.length,
        conflicts: conflicts.length,
        lastOperationVersion,
      });

      return {
        message: `Sync updates received and processed for story ${storyId}`,
        processedUpdates: parsedUpdates.length,
        serverMaxOperationVersion: lastOperationVersion,
        // Resultado por operação: sem isto o cliente não distingue quais operações passaram
        // e quais foram recusadas, e acaba marcando as recusadas como sincronizadas.
        applied,
        conflicts,
      };
    },
    {
      params: t.Object({
        storyId: t.String(), // ULID for the story
      }),
      // Confirmed: Elysia does run this Zod schema at request time (a malformed body 422s
      // before the handler runs, same as a TypeBox schema would). What it does NOT do well is
      // feed swagger's OpenAPI output - the generated spec for this field is Zod's own internal
      // `_def` AST, not valid JSON Schema, so it won't render meaningfully in Swagger UI or
      // work with any codegen tool that expects a real OpenAPI schema.
      body: StoryUpdatesArraySchema,
      response: {
        200: t.Object({
          message: t.String(),
          processedUpdates: t.Number(),
          serverMaxOperationVersion: t.Number(),
          applied: t.Array(SyncAppliedOperationResponseSchema),
          conflicts: t.Array(SyncConflictResponseSchema),
        }),
        401: t.Object({ message: t.String() }),
      },
      detail: {
        summary: 'Synchronize local story updates with the server',
        description:
          'Receives an array of story updates (create, update, delete, reorder) from a client ' +
          'and applies them to the server database, handling conflict resolution. The request ' +
          'body is a JSON array; every element shares this envelope: `type` ' +
          '("create"|"update"|"delete"|"reorder"), `entity` (one of ~25 registered sync entity ' +
          'names, e.g. "Character", "Scene", "TagRelation" - see SyncService.getEntityHandlers), ' +
          '`id`, `operationVersion`, `operationTime` (ISO string), `originatingUser`, and an ' +
          'optional `clientOperationId` used to correlate this operation with its result in the ' +
          "response. On top of that envelope: a `create` carries `data` (the new entity's " +
          'fields), an `update` carries `changes` (a partial patch) plus the base `version` it ' +
          'was built on, a `delete` carries just that base `version`, and a `reorder` carries ' +
          '`reorderItems` (id + newIndex pairs) instead of `data`/`changes`. The exact required ' +
          'fields of `data`/`changes` differ per entity - this is a true union of ~25 shapes, ' +
          'which is why the request body below is documented as an opaque schema rather than ' +
          'a precise one: TypeBox (what would normally render a real shape in swagger for this ' +
          "framework) can't express that union without becoming misleading busywork to keep in " +
          'sync, and Zod (the schema actually enforcing it) produces its own internal ' +
          'representation here instead of standard JSON Schema when Elysia serializes it for ' +
          'this page. The response shape below is precise and can be trusted as-is.',
        tags: ['Sync'],
      },
    },
  )
  .get(
    '/:storyId/pull',
    async ({ params, query, user, set }) => {
      // Destructure 'user' and 'set'
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }

      const { storyId } = params;
      const { lastOperationVersion, lastPublicFavoriteVersion } = query;

      const { updates, publicFavorites, serverMaxOperationVersion, role } =
        await syncService.getUpdatesForStory(
          user.userId,
          storyId,
          lastOperationVersion,
          lastPublicFavoriteVersion,
        );

      logger.info('Received pull request', {
        storyId,
        lastOperationVersion,
        updatesFound: updates.length,
        serverMaxOperationVersion,
      });

      return {
        message: `Pull request received for story ${storyId}`,
        updates: updates,
        publicFavorites,
        serverMaxOperationVersion: serverMaxOperationVersion, // Include the server's max operation version
        role,
      };
    },
    {
      params: t.Object({
        storyId: t.String(), // ULID for the story
      }),
      query: t.Object({
        lastOperationVersion: t.Numeric({ minimum: 0 }), // Expecting a numeric version
        lastPublicFavoriteVersion: t.Optional(t.Numeric({ minimum: 0 })),
      }),
      detail: {
        summary: 'Pull story updates from the server',
        description:
          'Allows clients to request story updates from the server for a specific story since their last known operation version.',
        tags: ['Sync'],
      },
      response: t.Object({
        // Update the response schema
        message: t.String(),
        updates: t.Array(t.Any()), // updates are StoryUpdate objects, using t.Any() for simplicity, can be more specific
        publicFavorites: t.Array(t.Any()),
        serverMaxOperationVersion: t.Number(),
        role: t.Union([t.Literal('owner'), t.Literal('writer'), t.Literal('reader')]),
      }),
    },
  )
  .get(
    '/pullpreviews',
    async ({ user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }

      const storyPreviews = await syncService.getStoriesWithLastOperationVersionForUser(
        user.userId,
      );

      return {
        message: 'Successfully fetched story previews.',
        storyPreviews: storyPreviews,
      };
    },
    {
      detail: {
        summary: 'Get previews of all stories accessible by the user',
        description:
          'Returns a list of story IDs and their latest operation versions for all stories the authenticated user owns or has read/write permissions for.',
        tags: ['Sync'],
      },
      response: t.Object({
        message: t.String(),
        storyPreviews: t.Array(
          t.Object({
            storyId: t.String(),
            lastOperationVersion: t.Number(),
            role: t.Union([t.Literal('owner'), t.Literal('writer'), t.Literal('reader')]),
          }),
        ),
      }),
    },
  );

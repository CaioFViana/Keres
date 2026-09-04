import { FullStoryExportSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { StoryExportImportService } from '../../services/StoryExportImportService';
import { storyPermissionService } from '../../services/StoryPermissionService';

const storyExportImportService = new StoryExportImportService();

export const storyRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null) // Explicitly decorate 'user' property
  // Route to export a full story
  .get(
    '/:storyId/export',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }

      // Validate if the user has at least 'reader' permission for the story
      const hasReadPermission = await storyPermissionService.hasPermission(
        user.userId,
        params.storyId,
        'reader',
      );
      if (!hasReadPermission) {
        set.status = 404;
        throw new Error('Story not found or not authorized for export.');
      }

      const fullStory = await storyExportImportService.exportStory(params.storyId, user.userId);
      return fullStory;
    },
    {
      params: t.Object({
        storyId: t.String(),
      }),
      // Deliberately no `response` schema: Elysia's response schema strips any field it
      // doesn't declare from the *actual* returned object (confirmed empirically), and a full
      // story export is dozens of entity arrays deep (FullStoryExportSchema, imported above,
      // is the Zod shape of it) - one missed or mistyped field here would silently truncate a
      // real backup/export instead of just documenting it wrong. Not worth that risk for a
      // swagger improvement.
      detail: {
        summary: 'Export a full story',
        description:
          'Exports a full story, including all its related entities, as a single JSON object.',
        tags: ['Story'],
      },
    },
  )
  // Route to import a full story
  .post(
    '/import',
    async ({ body, query, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }

      const newStoryId = await storyExportImportService.importStory(
        user.userId,
        body,
        query.storyId,
      );
      return { storyId: newStoryId };
    },
    {
      body: FullStoryExportSchema, // Use the schema for validation
      query: t.Object({
        // Present when a client is uploading a local (never synchronized) story for the first time, to
        // preserve the same ID on both sides - see `importStory`, which rejects it if a story with this ID
        // already exists for the user. Absent (the default): it generates a new ID, used when
        // downloading/duplicating a story that already exists on another server.
        storyId: t.Optional(t.String()),
      }),
      response: t.Object({ storyId: t.String() }),
      detail: {
        summary: 'Import a full story',
        description:
          'Imports a full story from a JSON object, creating all related entities. By default generates new IDs for all imported entities; pass `storyId` to preserve the original ID instead (fails if a story with that ID already exists for the authenticated user).',
        tags: ['Story'],
      },
    },
  );

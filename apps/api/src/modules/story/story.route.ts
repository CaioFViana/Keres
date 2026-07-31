import { FullStoryExportSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { ulid } from 'ulid';
import { db } from '../../db';
import { stories, storyTypeEnum } from '../../db/schema';
import { JWTPayload } from '../../index';
import { StoryExportImportService } from '../../services/StoryExportImportService';
import { storyPermissionService } from '../../services/StoryPermissionService';
import { AppError } from '../../utils/errors';

// Convert the enumValues array to an object for t.Enum()
const storyTypeEnumObject = storyTypeEnum.enumValues.reduce((acc, val) => {
  acc[val] = val;
  return acc;
}, {} as Record<string, (typeof storyTypeEnum.enumValues)[number]>);

const storyExportImportService = new StoryExportImportService();

export const storyRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null) // Explicitly decorate 'user' property
  // Route to create a new story
  .post('/', async ({ body, user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    const { title, type } = body;

    const [newStory] = await db
      .insert(stories)
      .values({
        id: ulid(),
        userId: user.userId,
        title,
        type,
      })
      .returning();

    if (!newStory) {
      throw new AppError(500, 'Failed to create story.');
    }

    return newStory;
  }, {
    body: t.Object({
      title: t.String(),
      type: t.Enum(storyTypeEnumObject), // Use the converted object here
    }),
    detail: {
      summary: 'Create a new story',
      description: 'Creates a new story associated with the authenticated user.',
      tags: ['Story'],
    },
  })
  // Route to export a full story
  .get('/:storyId/export', async ({ params, user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    // Validate if the user has at least 'reader' permission for the story
    const hasReadPermission = await storyPermissionService.hasPermission(user.userId, params.storyId, 'reader');
    if (!hasReadPermission) {
      set.status = 404;
      throw new Error('Story not found or not authorized for export.');
    }

    const fullStory = await storyExportImportService.exportStory(params.storyId);
    return fullStory;
  }, {
    params: t.Object({
      storyId: t.String(),
    }),
    detail: {
      summary: 'Export a full story',
      description: 'Exports a full story, including all its related entities, as a single JSON object.',
      tags: ['Story'],
    },
  })
  // Route to import a full story
  .post('/import', async ({ body, user, set }) => {
    if (!user || !user.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }

    const newStoryId = await storyExportImportService.importStory(user.userId, body);
    return { storyId: newStoryId };
  }, {
    body: FullStoryExportSchema, // Use the schema for validation
    detail: {
      summary: 'Import a full story',
      description: 'Imports a full story from a JSON object, creating all related entities. Generates new IDs for all imported entities.',
      tags: ['Story'],
    },
  });

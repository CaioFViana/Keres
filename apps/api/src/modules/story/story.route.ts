import { FullStoryExportSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { ulid } from 'ulid';
import { db } from '../../db';
import { stories, storyTypeEnum } from '../../db/schema';
import type { JWTPayload } from '../../index';
import { StoryExportImportService } from '../../services/StoryExportImportService';
import { storyPermissionService } from '../../services/StoryPermissionService';
import {
  TierLimitExceededError,
  tierEnforcementService,
} from '../../services/TierEnforcementService';
import { AppError } from '../../utils/errors';

// Convert the enumValues array to an object for t.Enum()
const storyTypeEnumObject = storyTypeEnum.enumValues.reduce(
  (acc, val) => {
    acc[val] = val;
    return acc;
  },
  {} as Record<string, (typeof storyTypeEnum.enumValues)[number]>,
);

const storyExportImportService = new StoryExportImportService();

/** Every column of a `stories` row, as `.returning()` sends it back after POST /. */
const StoryResponseSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  title: t.String(),
  type: t.String(),
  description: t.Nullable(t.String()),
  genre: t.Nullable(t.String()),
  language: t.Nullable(t.String()),
  author: t.Nullable(t.String()),
  isFavorite: t.Boolean(),
  favoriteBehavior: t.String(),
  extraNotes: t.Nullable(t.String()),
  theme: t.Nullable(t.String()),
  normalizeSceneTiming: t.Boolean(),
  allowReaderComments: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  version: t.Number(),
  isDeleted: t.Boolean(),
  deletedAt: t.Nullable(t.Date()),
  lastOperationVersion: t.Number(),
});

export const storyRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null) // Explicitly decorate 'user' property
  // Route to create a new story
  .post(
    '/',
    async ({ body, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }

      const { title, type } = body;

      try {
        await tierEnforcementService.assertCanCreateStory(user.userId);
      } catch (error) {
        if (error instanceof TierLimitExceededError) {
          throw new AppError(403, error.message);
        }
        throw error;
      }

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
    },
    {
      body: t.Object({
        title: t.String(),
        type: t.Enum(storyTypeEnumObject), // Use the converted object here
      }),
      response: StoryResponseSchema,
      detail: {
        summary: 'Create a new story',
        description: 'Creates a new story associated with the authenticated user.',
        tags: ['Story'],
      },
    },
  )
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
        // Presente quando um cliente está enviando uma história local (nunca sincronizada) pela
        // primeira vez, pra preservar o mesmo ID nos dois lados - ver `importStory`, que rejeita
        // se já existir uma história com este ID para o usuário. Ausente (padrão): gera um ID
        // novo, usado ao baixar/duplicar uma história já existente em outro servidor.
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

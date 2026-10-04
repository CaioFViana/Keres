import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { adminStoryService } from '../../services/AdminStoryService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

const security = [{ bearerAuth: [] }];

/**
 * Story-level moderation, mounted at `/api/admin/stories`: finding stories by NSFW flag,
 * toggling the flag (turning it on expels non-verified collaborators at once), and removing
 * a collaborator without the friendship the owner's own revocation requires.
 */
export const adminStoryRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user }) => {
      await requireAdmin(user);
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 25;
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
      ) {
        throw new AppError(400, 'Invalid pagination');
      }
      let nsfw: boolean | undefined;
      if (query.nsfw !== undefined) {
        if (query.nsfw !== 'true' && query.nsfw !== 'false') {
          throw new AppError(400, 'Invalid nsfw filter');
        }
        nsfw = query.nsfw === 'true';
      }
      return adminStoryService.list({ search: query.search, nsfw, page, pageSize });
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        nsfw: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'List stories for moderation (filterable by NSFW flag)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .patch(
    '/:id',
    async ({ params, body, user }) => {
      await requireAdmin(user);
      if (typeof body.isNsfw !== 'boolean') {
        throw new AppError(400, 'Invalid change');
      }
      // AdminStoryService throws AppError with the right status already.
      return adminStoryService.setNsfw(params.id, body.isNsfw);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ isNsfw: t.Optional(t.Boolean()) }),
      detail: {
        summary: 'Toggle the NSFW flag (turning it on expels non-verified collaborators)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/collaborators',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.collaborators(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'List the collaborators of a story',
        tags: ['Admin'],
        security,
      },
    },
  )

  .delete(
    '/:storyId/collaborators/:userId',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.removeCollaborator(params.storyId, params.userId);
    },
    {
      params: t.Object({ storyId: t.String(), userId: t.String() }),
      detail: {
        summary: 'Remove a collaborator from a story',
        tags: ['Admin'],
        security,
      },
    },
  );

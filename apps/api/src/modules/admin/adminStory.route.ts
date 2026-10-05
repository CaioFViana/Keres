import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import {
  ADMIN_ENTITY_DEFAULT_PAGE_SIZE,
  adminStoryService,
} from '../../services/AdminStoryService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

const security = [{ bearerAuth: [] }];

/**
 * Story-level moderation, mounted at `/api/admin/stories`: finding stories by NSFW flag,
 * toggling the flag (turning it on expels non-verified collaborators at once), removing
 * a collaborator without the friendship the owner's own revocation requires, and reading a
 * story's media, boards and location maps (plus media bytes) for moderation review.
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
    '/:id/collaborators/:userId',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.removeCollaborator(params.id, params.userId);
    },
    {
      params: t.Object({ id: t.String(), userId: t.String() }),
      detail: {
        summary: 'Remove a collaborator from a story',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/media',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.media(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'List the live media metadata of a story (bytes stay behind the blob route)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/boards',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.boards(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'List the boards of a story with a moderation summary of each drawing',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/sketches',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.sketches(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'List the sketches of a story with a moderation summary of each drawing',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/location-maps',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.locationMaps(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'List the location maps of a story with a moderation summary of each drawing',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/entities',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminStoryService.entityTypes(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'List the browsable entity types of a story with live row counts',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/entities/:entityType',
    async ({ params, query, user }) => {
      await requireAdmin(user);
      // The service rejects unknown types and out-of-range pages with a 400.
      return adminStoryService.entities(
        params.id,
        params.entityType,
        query.page ?? 1,
        query.pageSize ?? ADMIN_ENTITY_DEFAULT_PAGE_SIZE,
      );
    },
    {
      params: t.Object({ id: t.String(), entityType: t.String() }),
      query: t.Object({
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'List the raw rows of one story entity type for moderation analysis',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/:id/blobs/:hash',
    async ({ params, set, user }) => {
      await requireAdmin(user);
      // The service proves the story/hash binding; only administrators reach this route.
      const blob = await adminStoryService.blob(params.id, params.hash);
      set.headers['content-type'] = blob.mimeType;
      // A hash's content never changes, so it can be cached indefinitely.
      set.headers['cache-control'] = 'private, max-age=31536000, immutable';
      return blob.body;
    },
    {
      params: t.Object({ id: t.String(), hash: t.String() }),
      detail: {
        summary: 'Download a story media blob for moderation viewing',
        tags: ['Admin'],
        security,
      },
    },
  );

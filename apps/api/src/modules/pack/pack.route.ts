import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { packService } from '../../services/PackService';

/**
 * Sharing packs.
 *
 * Four ordinary routes over one table, deliberately not the publication flow: a story publication
 * requires the story to be fully synchronized before a snapshot means anything, and a pack has no
 * sync state at all. No OCC, no operation log, no version negotiation - a pack at a given version is
 * immutable, and re-uploading the same id is how its author shares a new one.
 *
 * `content` is `t.Unknown()` here on purpose: its real shape is `PackContentSchema`, checked by
 * `packService.upload` with zod. Restating it in Elysia's dialect would be a second definition of
 * the same contract, free to drift from the one the client validates against.
 */

const PackMetadataSchema = t.Object({
  id: t.String(),
  ownerId: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  language: t.Nullable(t.String()),
  authorName: t.Nullable(t.String()),
  version: t.Number(),
  visibility: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

// Composed from the metadata's properties rather than `t.Intersect`: an intersect of two closed
// objects rejects `content` as an unexpected property instead of merging the two shapes.
const PackWithContentSchema = t.Object({
  ...PackMetadataSchema.properties,
  content: t.Unknown(),
});

export const packRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  // Every route here needs an authenticated user, as in `friend.route.ts`: a single eager derive
  // instead of the same 401 block opening four handlers.
  .derive(({ user, set }) => {
    if (!user?.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }
    return { userId: user.userId };
  })
  .get('/', async () => packService.list(), {
    response: t.Array(PackMetadataSchema),
    detail: {
      summary: 'List shared packs',
      description: 'Metadata only - the payloads are never parsed to build this list.',
      tags: ['Packs'],
    },
  })
  .get('/:packId', async ({ params }) => packService.getById(params.packId), {
    params: t.Object({ packId: t.String() }),
    response: PackWithContentSchema,
    detail: {
      summary: 'Download one pack',
      description: 'Returns the pack whole, metadata and payload.',
      tags: ['Packs'],
    },
  })
  .post(
    '/',
    async ({ body, userId }) =>
      packService.upload(userId, {
        id: body.id,
        name: body.name,
        description: body.description ?? null,
        language: body.language ?? null,
        authorName: body.authorName ?? null,
        version: body.version ?? 1,
        // Private unless the author says otherwise: uploading reaches their own devices and
        // collaborators, which is not the same act as putting the pack on a public page.
        visibility: body.visibility ?? 'private',
        content: body.content,
      }),
    {
      body: t.Object({
        id: t.String(),
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.Nullable(t.String())),
        language: t.Optional(t.Nullable(t.String())),
        authorName: t.Optional(t.Nullable(t.String())),
        version: t.Optional(t.Number()),
        visibility: t.Optional(t.Union([t.Literal('private'), t.Literal('public')])),
        content: t.Unknown(),
      }),
      response: PackMetadataSchema,
      detail: {
        summary: 'Share a pack',
        description:
          'Uploads a pack, or replaces one the same user already shared under that id - which is how a new version is published.',
        tags: ['Packs'],
      },
    },
  )
  .delete(
    '/:packId',
    async ({ params, userId }) => {
      await packService.remove(userId, params.packId);
      return { success: true };
    },
    {
      params: t.Object({ packId: t.String() }),
      response: t.Object({ success: t.Boolean() }),
      detail: {
        summary: 'Withdraw a shared pack',
        description: 'Removes it outright; there is no tombstone to propagate.',
        tags: ['Packs'],
      },
    },
  );

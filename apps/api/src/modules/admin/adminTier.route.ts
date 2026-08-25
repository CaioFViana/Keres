import { PartialTierSchema, TierCreateInputSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import {
  TierInUseError,
  TierNameAlreadyTakenError,
  TierNotFoundError,
  tierService,
} from '../../services/TierService';
import { requireAdmin } from '../../utils/adminAuth';

export const adminTierRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user }) => {
      await requireAdmin(user);
      return tierService.list(query.includeDeleted === 'true');
    },
    {
      query: t.Object({ includeDeleted: t.Optional(t.String()) }),
      detail: { summary: 'List tiers', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .get(
    '/:id',
    async ({ params, user, set }) => {
      await requireAdmin(user);
      const found = await tierService.getById(params.id);
      if (!found) {
        set.status = 404;
        return { message: 'Tier not found' };
      }
      return found;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: 'Get a tier by ID', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .post(
    '/',
    async ({ body, user, set }) => {
      await requireAdmin(user);

      const parsed = TierCreateInputSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid tier data' };
      }

      try {
        const created = await tierService.create(parsed.data);
        set.status = 201;
        return created;
      } catch (error) {
        if (error instanceof TierNameAlreadyTakenError) {
          set.status = 409;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      // Loose on purpose - TierCreateInputSchema.safeParse above stays the real gate. Only
      // exists so swagger shows the body shape; Elysia strips undeclared body keys before the
      // handler runs, so this must include every field the Zod schema does.
      body: t.Object({
        name: t.String(),
        isDefault: t.Optional(t.Boolean()),
        maxStories: t.Optional(t.Nullable(t.Number())),
        maxEntitiesPerStory: t.Optional(t.Nullable(t.Number())),
        maxEntitiesTotal: t.Optional(t.Nullable(t.Number())),
        maxStorageBytesPerStory: t.Optional(t.Nullable(t.Number())),
        maxStorageBytesTotal: t.Optional(t.Nullable(t.Number())),
      }),
      detail: { summary: 'Create a tier', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .put(
    '/:id',
    async ({ params, body, user, set }) => {
      await requireAdmin(user);

      const parsed = PartialTierSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid tier data' };
      }

      try {
        return await tierService.update(params.id, parsed.data);
      } catch (error) {
        if (error instanceof TierNotFoundError) {
          set.status = 404;
          return { message: error.message };
        }
        if (error instanceof TierNameAlreadyTakenError) {
          set.status = 409;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      // Loose on purpose, same reasoning as POST / above - PartialTierSchema (every field of
      // TierCreateInputSchema, but optional) stays the real gate.
      body: t.Object({
        name: t.Optional(t.String()),
        isDefault: t.Optional(t.Boolean()),
        maxStories: t.Optional(t.Nullable(t.Number())),
        maxEntitiesPerStory: t.Optional(t.Nullable(t.Number())),
        maxEntitiesTotal: t.Optional(t.Nullable(t.Number())),
        maxStorageBytesPerStory: t.Optional(t.Nullable(t.Number())),
        maxStorageBytesTotal: t.Optional(t.Nullable(t.Number())),
      }),
      detail: { summary: 'Update a tier', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .delete(
    '/:id',
    async ({ params, user, set }) => {
      await requireAdmin(user);

      try {
        return await tierService.softDelete(params.id);
      } catch (error) {
        if (error instanceof TierNotFoundError) {
          set.status = 404;
          return { message: error.message };
        }
        if (error instanceof TierInUseError) {
          set.status = 409;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Soft-delete a tier (refused if still in use)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );

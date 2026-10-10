import { PartialTierSchema, TierCreateInputSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import {
  TierInUseError,
  TierNameAlreadyTakenError,
  TierNotFoundError,
  TierPlayProductAlreadyUsedError,
  tierService,
} from '../../services/TierService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

/**
 * The two conflicts a tier write can hit (409), mapped the same way by create and update.
 * Anything else is rethrown.
 */
function rethrowTierWriteError(error: unknown): never {
  if (error instanceof TierNameAlreadyTakenError) {
    throw new AppError(409, error.message);
  }
  if (error instanceof TierPlayProductAlreadyUsedError) {
    throw new AppError(409, error.message);
  }
  throw error;
}

/**
 * The tier fields of the create and update bodies. Both routes declare them loosely (see the
 * comments on each route); only the Zod schemas are the real gate.
 */
const tierBodyFields = {
  isDefault: t.Optional(t.Boolean()),
  maxStories: t.Optional(t.Nullable(t.Number())),
  maxEntitiesPerStory: t.Optional(t.Nullable(t.Number())),
  maxEntitiesTotal: t.Optional(t.Nullable(t.Number())),
  maxStorageBytesPerStory: t.Optional(t.Nullable(t.Number())),
  maxStorageBytesTotal: t.Optional(t.Nullable(t.Number())),
  maxPublicationsPerDay: t.Optional(t.Nullable(t.Number())),
  maxPublishedArcs: t.Optional(t.Nullable(t.Number())),
  maxMessagesPerDay: t.Optional(t.Nullable(t.Number())),
  priceMonthlyCents: t.Optional(t.Nullable(t.Number())),
  priceYearlyCents: t.Optional(t.Nullable(t.Number())),
  playMonthlyProductId: t.Optional(t.Nullable(t.String())),
  playYearlyProductId: t.Optional(t.Nullable(t.String())),
  webMonthlyEnabled: t.Optional(t.Boolean()),
  webYearlyEnabled: t.Optional(t.Boolean()),
  isPublicForSale: t.Optional(t.Boolean()),
  sortOrder: t.Optional(t.Number()),
};

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
    async ({ params, user }) => {
      await requireAdmin(user);
      const found = await tierService.getById(params.id);
      if (!found) {
        throw new AppError(404, 'Tier not found');
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
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid tier data');
      }

      try {
        const created = await tierService.create(parsed.data);
        set.status = 201;
        return created;
      } catch (error) {
        rethrowTierWriteError(error);
      }
    },
    {
      // Loose on purpose - TierCreateInputSchema.safeParse above stays the real gate. Only
      // exists so swagger shows the body shape; Elysia strips undeclared body keys before the
      // handler runs, so this must include every field the Zod schema does.
      body: t.Object({
        name: t.String(),
        ...tierBodyFields,
      }),
      detail: { summary: 'Create a tier', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .put(
    '/:id',
    async ({ params, body, user }) => {
      await requireAdmin(user);

      const parsed = PartialTierSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid tier data');
      }

      try {
        return await tierService.update(params.id, parsed.data);
      } catch (error) {
        if (error instanceof TierNotFoundError) {
          throw new AppError(404, error.message);
        }
        rethrowTierWriteError(error);
      }
    },
    {
      params: t.Object({ id: t.String() }),
      // Loose on purpose, same reasoning as POST / above - PartialTierSchema (every field of
      // TierCreateInputSchema, but optional) stays the real gate.
      body: t.Object({
        name: t.Optional(t.String()),
        ...tierBodyFields,
      }),
      detail: { summary: 'Update a tier', tags: ['Admin'], security: [{ bearerAuth: [] }] },
    },
  )

  .delete(
    '/:id',
    async ({ params, user }) => {
      await requireAdmin(user);

      try {
        return await tierService.softDelete(params.id);
      } catch (error) {
        if (error instanceof TierNotFoundError) {
          throw new AppError(404, error.message);
        }
        if (error instanceof TierInUseError) {
          throw new AppError(409, error.message);
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

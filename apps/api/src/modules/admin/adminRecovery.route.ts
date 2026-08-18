import { AdminDeletedItemsQuerySchema, AdminOperationLogQuerySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import {
  adminRecoveryService,
  RecoveryEntityNotFoundError,
  UnknownEntityTypeError,
} from '../../services/AdminRecoveryService';
import { requireAdmin } from '../../utils/adminAuth';

export const adminRecoveryRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/deleted',
    async ({ query, user, set }) => {
      await requireAdmin(user);

      const parsed = AdminDeletedItemsQuerySchema.safeParse(query);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid query' };
      }

      return adminRecoveryService.listDeleted(parsed.data);
    },
    {
      // Loose on purpose - AdminDeletedItemsQuerySchema.safeParse above stays the real gate.
      // Only exists so swagger shows the query shape; Elysia strips undeclared query keys
      // before the handler runs, so this must include every field the Zod schema does.
      query: t.Object({
        entityType: t.Optional(t.String()),
        storyId: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Browse soft-deleted entities/Stories',
        description:
          'Lists tombstoned rows across all sync entity types (or a single one via ?entityType=), optionally scoped to a story.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .post(
    '/:entityType/:id/restore',
    async ({ params, user, set }) => {
      const adminUserId = await requireAdmin(user);

      try {
        return await adminRecoveryService.restore(params.entityType, params.id, adminUserId);
      } catch (error) {
        if (error instanceof UnknownEntityTypeError) {
          set.status = 400;
          return { message: error.message };
        }
        if (error instanceof RecoveryEntityNotFoundError) {
          set.status = 404;
          return { message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ entityType: t.String(), id: t.String() }),
      detail: {
        summary: 'Restore a soft-deleted entity or Story',
        description:
          'Clears isDeleted/deletedAt via the same mechanism the sync pipeline uses for restore, and logs the action as an operation attributed to the admin.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  )

  .get(
    '/operation-log',
    async ({ query, user, set }) => {
      await requireAdmin(user);

      const parsed = AdminOperationLogQuerySchema.safeParse(query);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid query' };
      }

      return adminRecoveryService.browseOperationLog(parsed.data);
    },
    {
      // Loose on purpose, same reasoning as /deleted above - AdminOperationLogQuerySchema stays
      // the real gate.
      query: t.Object({
        storyId: t.Optional(t.String()),
        entityType: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        operationType: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Browse the operation log (paginated, filterable)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );

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
      detail: {
        summary: 'Browse the operation log (paginated, filterable)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );

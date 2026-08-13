import { AdminApiLogQuerySchema } from '@keres/shared';
import { Elysia } from 'elysia';
import { JWTPayload } from '../../index';
import { adminApiLogService } from '../../services/AdminApiLogService';
import { requireAdmin } from '../../utils/adminAuth';

export const adminApiLogRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get('/', async ({ query, user, set }) => {
    await requireAdmin(user);

    const parsed = AdminApiLogQuerySchema.safeParse(query);
    if (!parsed.success) {
      set.status = 400;
      return { message: parsed.error.issues[0]?.message || 'Invalid query' };
    }

    return adminApiLogService.browseApiLogs(parsed.data);
  }, {
    detail: {
      summary: 'Browse the persisted API log (paginated, filterable)',
      tags: ['Admin'],
      security: [{ bearerAuth: [] }],
    },
  });

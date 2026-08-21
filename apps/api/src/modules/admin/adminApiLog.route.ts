import { AdminApiLogQuerySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { adminApiLogService } from '../../services/AdminApiLogService';
import { requireAdmin } from '../../utils/adminAuth';

export const adminApiLogRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user, set }) => {
      await requireAdmin(user);

      const parsed = AdminApiLogQuerySchema.safeParse(query);
      if (!parsed.success) {
        set.status = 400;
        return { message: parsed.error.issues[0]?.message || 'Invalid query' };
      }

      return adminApiLogService.browseApiLogs(parsed.data);
    },
    {
      // Deliberately loose (every field optional, no enum/format constraints) - the real gate
      // is still AdminApiLogQuerySchema.safeParse above. This only exists so swagger shows the
      // query shape at all; it must never reject anything the Zod schema would otherwise
      // accept or reformat, since Elysia strips any query key not declared here before the
      // handler runs (confirmed empirically - undeclared keys silently disappear).
      query: t.Object({
        level: t.Optional(t.String()),
        storyId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        search: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'Browse the persisted API log (paginated, filterable)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
      },
    },
  );

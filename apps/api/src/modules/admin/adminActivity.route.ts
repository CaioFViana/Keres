import { AuditEventListQuerySchema, AuditSummaryQuerySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { auditService } from '../../services/AuditService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

const security = [{ bearerAuth: [] }];

// Loose on purpose, like the other admin queries: the Zod schemas are the real gate, and Elysia strips
// the keys a route does not declare.
const listQuery = t.Object({
  category: t.Optional(t.String()),
  outcome: t.Optional(t.String()),
  action: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  search: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  order: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  pageSize: t.Optional(t.Numeric()),
});

function parseList(query: unknown) {
  const parsed = AuditEventListQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid query');
  }
  return parsed.data;
}

/**
 * The activity record for the administrators, mounted at `/api/admin/activity`: the filtered list, a
 * summary of the last hours with how the server is doing, and the filtered record as a CSV file.
 */
export const adminActivityRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user }) => {
      await requireAdmin(user);
      return auditService.list(parseList(query));
    },
    {
      query: listQuery,
      detail: {
        summary: 'The activity record (filterable, paginated)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/summary',
    async ({ query, user }) => {
      await requireAdmin(user);
      const parsed = AuditSummaryQuerySchema.safeParse(query);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid query');
      }
      return auditService.summary(parsed.data.hours);
    },
    {
      query: t.Object({ hours: t.Optional(t.Numeric()) }),
      detail: {
        summary: 'What happened in the last hours, and how the server is doing',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/export',
    async ({ query, user, set }) => {
      await requireAdmin(user);
      // The whole result, not a page: an export is what the filters select.
      const csv = await auditService.exportCsv(parseList({ ...query, page: 1 }));
      set.headers['content-type'] = 'text/csv; charset=utf-8';
      set.headers['content-disposition'] =
        `attachment; filename="keres-activity-${new Date().toISOString().slice(0, 10)}.csv"`;
      return csv;
    },
    {
      query: listQuery,
      detail: {
        summary: 'The filtered activity record as a CSV file',
        tags: ['Admin'],
        security,
      },
    },
  );

import { AccessRecordListQuerySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '@/index';
import { accessRecordService } from '@/services/AccessRecordService';
import { requireAdmin } from '@/utils/adminAuth';
import { AppError } from '@/utils/errors';

const security = [{ bearerAuth: [] }];

// Loose on purpose, like the other admin queries: the Zod schema is the real gate, and Elysia strips the
// keys a route does not declare.
const listQuery = t.Object({
  userId: t.Optional(t.String()),
  username: t.Optional(t.String()),
  ip: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String()),
});

function parseList(query: unknown) {
  const parsed = AccessRecordListQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid query');
  }
  return parsed.data;
}

/**
 * The access records for the administrators, mounted at `/api/admin/access-records`: the filtered records one
 * page at a time, and the same filters as a CSV file. Reading them is itself on the activity record, by the
 * request audit (`admin.access_records_viewed` / `_exported`, with the filters but never the results).
 */
export const adminAccessRecordsRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user }) => {
      await requireAdmin(user);
      return accessRecordService.search(parseList(query));
    },
    {
      query: listQuery,
      detail: {
        summary: 'The access records (sign-ins and their addresses), filterable and paginated',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/export',
    async ({ query, user, set }) => {
      await requireAdmin(user);
      // The filters select the whole export; `truncated` says the cap cut it short, so the panel can say so.
      const { csv, truncated } = await accessRecordService.exportCsv(
        parseList({ ...query, limit: undefined, cursor: undefined }),
      );
      set.headers['content-type'] = 'text/csv; charset=utf-8';
      set.headers['content-disposition'] =
        `attachment; filename="keres-access-records-${new Date().toISOString().slice(0, 10)}.csv"`;
      set.headers['x-export-truncated'] = truncated ? 'true' : 'false';
      return csv;
    },
    {
      query: listQuery,
      detail: {
        summary: 'The filtered access records as a CSV file',
        tags: ['Admin'],
        security,
      },
    },
  );

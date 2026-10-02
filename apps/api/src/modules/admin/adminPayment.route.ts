import { AdminPaymentEventListQuerySchema, AdminSubscriptionListQuerySchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { adminPaymentService } from '../../services/payments/AdminPaymentService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

const security = [{ bearerAuth: [] }];

function parse<T>(
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message?: string }[] };
    };
  },
  query: unknown,
): T {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(400, parsed.error?.issues[0]?.message || 'Invalid query');
  }
  return parsed.data as T;
}

/**
 * What the administrators see of payments, mounted at `/api/admin/payments`: a summary (who is paid up, late
 * or leaving, what came in), the subscriptions, and the ledger of what the provider reported. Read only.
 */
export const adminPaymentRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/summary',
    async ({ user }) => {
      await requireAdmin(user);
      return adminPaymentService.summary();
    },
    { detail: { summary: 'Payments at a glance', tags: ['Admin'], security } },
  )

  .get(
    '/subscriptions',
    async ({ user, query }) => {
      await requireAdmin(user);
      return adminPaymentService.listSubscriptions(parse(AdminSubscriptionListQuerySchema, query));
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        status: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        order: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      detail: { summary: 'Subscriptions (filterable, paginated)', tags: ['Admin'], security },
    },
  )

  .get(
    '/events',
    async ({ user, query }) => {
      await requireAdmin(user);
      return adminPaymentService.listEvents(parse(AdminPaymentEventListQuerySchema, query));
    },
    {
      query: t.Object({ page: t.Optional(t.Numeric()), pageSize: t.Optional(t.Numeric()) }),
      detail: { summary: 'The ledger of what the provider reported', tags: ['Admin'], security },
    },
  );

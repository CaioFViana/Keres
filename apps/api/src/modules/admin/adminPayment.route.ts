import {
  AdminGiftCreateSchema,
  AdminPaymentEventListQuerySchema,
  AdminSubscriptionListQuerySchema,
} from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { adminPaymentService } from '../../services/payments/AdminPaymentService';
import { giftService } from '../../services/payments/GiftService';
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
 * or leaving, what came in), the subscriptions, and the ledger of what the provider reported - and the one thing an
 * administrator can do here: give a person a plan for a number of months.
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
      query: t.Object({
        search: t.Optional(t.String()),
        kind: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'The ledger of what the provider reported (filterable, paginated)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/users/:userId/subscription',
    async ({ user, params }) => {
      await requireAdmin(user);
      return adminPaymentService.subscriptionOfUser(params.userId);
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: {
        summary: "A person's subscription, for giving them a plan",
        tags: ['Admin'],
        security,
      },
    },
  )

  .post(
    '/users/:userId/gift',
    async ({ user, params, body, set }) => {
      const adminId = await requireAdmin(user);
      const input = parse(AdminGiftCreateSchema, body);
      await giftService.grant(
        { id: adminId, username: user?.username ?? '' },
        params.userId,
        input,
      );
      set.status = 201;
      return adminPaymentService.subscriptionOfUser(params.userId);
    },
    {
      params: t.Object({ userId: t.String() }),
      // Loose on purpose: the Zod schema is the real gate.
      body: t.Object({
        tierId: t.String(),
        months: t.Number(),
        cancelRenewal: t.Optional(t.Boolean()),
        consent: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Give a person a plan for a number of months (a payment of zero)',
        tags: ['Admin'],
        security,
      },
    },
  );

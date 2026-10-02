import {
  AdminMessageListQuerySchema,
  AdminMessagePatchSchema,
  MessageSendSchema,
} from '@keres/shared';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { adminMessageService } from '../../services/AdminMessageService';
import { requireAdmin } from '../../utils/adminAuth';
import { AppError } from '../../utils/errors';

const security = [{ bearerAuth: [] }];

/**
 * The administrators' inbox, mounted at `/api/admin/messages`: what the landing page form and the
 * users' messages to the administrators left, with its filters; reading state, archiving, replying
 * inside the platform to a registered user, and deleting.
 */
export const adminMessageRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)

  .get(
    '/',
    async ({ query, user }) => {
      await requireAdmin(user);
      const parsed = AdminMessageListQuerySchema.safeParse(query);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid query');
      }
      return adminMessageService.list(parsed.data);
    },
    {
      // Loose on purpose - the Zod schema above is the real gate; Elysia strips undeclared keys.
      query: t.Object({
        search: t.Optional(t.String()),
        source: t.Optional(t.String()),
        read: t.Optional(t.String()),
        archived: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        order: t.Optional(t.String()),
        page: t.Optional(t.Numeric()),
        pageSize: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: 'List messages (filterable, sortable, paginated)',
        tags: ['Admin'],
        security,
      },
    },
  )

  .get(
    '/unread-count',
    async ({ user }) => {
      await requireAdmin(user);
      return adminMessageService.unreadCount();
    },
    {
      detail: { summary: 'How many messages still need attention', tags: ['Admin'], security },
    },
  )

  .get(
    '/:id',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminMessageService.open(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Open a message (marks it read) with its conversation',
        tags: ['Admin'],
        security,
      },
    },
  )

  .patch(
    '/:id',
    async ({ params, body, user }) => {
      await requireAdmin(user);
      const parsed = AdminMessagePatchSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid change');
      }
      return adminMessageService.patch(params.id, parsed.data);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ read: t.Optional(t.Boolean()), archived: t.Optional(t.Boolean()) }),
      detail: {
        summary: 'Mark a message read or unread, archive or restore it',
        tags: ['Admin'],
        security,
      },
    },
  )

  .post(
    '/:id/reply',
    async ({ params, body, user, set }) => {
      const adminId = await requireAdmin(user);
      const parsed = MessageSendSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid message');
      }
      set.status = 201;
      return adminMessageService.reply(params.id, adminId, parsed.data.body);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ body: t.String() }),
      detail: {
        summary: 'Reply to a registered user inside the platform',
        tags: ['Admin'],
        security,
      },
    },
  )

  .delete(
    '/:id',
    async ({ params, user }) => {
      await requireAdmin(user);
      return adminMessageService.remove(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        summary: 'Delete a message from the administrators side',
        tags: ['Admin'],
        security,
      },
    },
  );

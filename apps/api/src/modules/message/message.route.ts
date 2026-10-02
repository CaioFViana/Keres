import { MessagePageQuerySchema, MessageSendSchema } from '@keres/shared';
import { UserTargetIdParam } from '@keres/shared/schemas/FriendshipRouteSchemas';
import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../../index';
import { messageQuotaService } from '../../services/MessageQuotaService';
import { messageService } from '../../services/MessageService';
import { AppError } from '../../utils/errors';

function parseBody(body: unknown) {
  const parsed = MessageSendSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid message');
  }
  return parsed.data.body;
}

function parsePage(query: unknown) {
  const parsed = MessagePageQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid query');
  }
  return parsed.data;
}

// Loose on purpose, like the other modules: the Zod schemas above are the real gate, and Elysia
// strips undeclared keys.
const sendBody = t.Object({ body: t.String() });
const pageQuery = t.Object({ before: t.Optional(t.String()), limit: t.Optional(t.Numeric()) });
const chatMessage = t.Object({
  id: t.String(),
  body: t.String(),
  createdAt: t.String(),
  mine: t.Boolean(),
});
const messagePage = t.Object({ items: t.Array(chatMessage), nextBefore: t.Nullable(t.String()) });
const done = t.Object({ ok: t.Boolean() });

/**
 * The messages of the signed-in user, mounted at `/api/messages`: the inbox, a conversation with the
 * administrators or with a friend, sending, and deleting from their own side. Reading is not tracked
 * here - whether an administrator opened a message is the administrators' business only.
 */
export const messageRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .derive(({ user }) => {
    if (!user?.userId) {
      throw new AppError(401, 'Unauthorized: User not authenticated.');
    }
    return { userId: user.userId };
  })

  .get('/conversations', ({ userId }) => messageService.listConversations(userId), {
    detail: { summary: 'The inbox: one line per conversation', tags: ['Messages'] },
  })

  .get('/limits', ({ userId }) => messageQuotaService.getLimits(userId), {
    detail: { summary: 'Messages the user may still send today', tags: ['Messages'] },
  })

  .get(
    '/admin',
    ({ userId, query }) => messageService.listMessages(userId, { kind: 'admin' }, parsePage(query)),
    {
      query: pageQuery,
      response: messagePage,
      detail: {
        summary: 'Conversation with the administrators (newest first)',
        tags: ['Messages'],
      },
    },
  )
  .post(
    '/admin',
    ({ userId, body, set }) => {
      set.status = 201;
      return messageService.sendToAdmins(userId, parseBody(body));
    },
    {
      body: sendBody,
      response: { 201: chatMessage },
      detail: { summary: 'Write to the administrators', tags: ['Messages'] },
    },
  )
  .delete(
    '/admin',
    async ({ userId }) => {
      await messageService.clearConversation(userId, { kind: 'admin' });
      return { ok: true };
    },
    {
      response: done,
      detail: {
        summary: 'Clear the conversation with the administrators (this side only)',
        tags: ['Messages'],
      },
    },
  )

  .get(
    '/user/:targetUserId',
    ({ userId, params, query }) =>
      messageService.listMessages(
        userId,
        { kind: 'direct', userId: params.targetUserId },
        parsePage(query),
      ),
    {
      params: UserTargetIdParam,
      query: pageQuery,
      response: messagePage,
      detail: { summary: 'Conversation with a friend (newest first)', tags: ['Messages'] },
    },
  )
  .post(
    '/user/:targetUserId',
    ({ userId, params, body, set }) => {
      set.status = 201;
      return messageService.sendToUser(userId, params.targetUserId, parseBody(body));
    },
    {
      params: UserTargetIdParam,
      body: sendBody,
      response: { 201: chatMessage },
      detail: { summary: 'Write to a friend', tags: ['Messages'] },
    },
  )
  .delete(
    '/user/:targetUserId',
    async ({ userId, params }) => {
      await messageService.clearConversation(userId, {
        kind: 'direct',
        userId: params.targetUserId,
      });
      return { ok: true };
    },
    {
      params: UserTargetIdParam,
      response: done,
      detail: {
        summary: 'Clear the conversation with a friend (this side only)',
        tags: ['Messages'],
      },
    },
  )

  .delete(
    '/:messageId',
    async ({ userId, params }) => {
      await messageService.deleteForMe(userId, params.messageId);
      return { ok: true };
    },
    {
      params: t.Object({ messageId: t.String() }),
      response: done,
      detail: { summary: 'Delete one message from this side only', tags: ['Messages'] },
    },
  );

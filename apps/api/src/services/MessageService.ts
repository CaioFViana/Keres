import type { ChatMessage, ConversationSummary, MessagePage } from '@keres/shared';
import { buildNsfwReportBody } from '@keres/shared';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { and, desc, eq, inArray, isNotNull, isNull, lt, max, or, sql, type SQL } from 'drizzle-orm';
import { monotonicFactory } from 'ulid';
import { db, withWriteTransaction } from '../db';
import { friendships, messages, stories, users } from '../db/schema';
import { lockUserPair } from '../db/sqlOperators';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { messageQuotaService, type MessageQuotaKind } from './MessageQuotaService';
import { TierLimitExceededError } from './TierEnforcementService';

/** Strictly increasing within the process, so the id alone orders a conversation. */
export const newMessageId = monotonicFactory();

type MessageRow = typeof messages.$inferSelect;

/** The conversation partner: the administrators, or one user. */
export type MessagePeer = { kind: 'admin' } | { kind: 'direct'; userId: string };

/**
 * A conversation as one side of it sees it: what that side has not deleted. Between two users the
 * sender's side is `senderDeletedAt`, the recipient's `recipientDeletedAt`; with the administrators
 * the user's side is the same column it would be for any other message, and the administrators'
 * side is the column of the party that is missing.
 */
export function conversationWhere(me: string, peer: MessagePeer): SQL {
  if (peer.kind === 'admin') {
    return or(
      and(
        eq(messages.channel, 'admin'),
        eq(messages.senderId, me),
        isNull(messages.recipientId),
        isNull(messages.senderDeletedAt),
      ),
      and(
        eq(messages.channel, 'admin'),
        eq(messages.recipientId, me),
        isNull(messages.senderId),
        isNull(messages.recipientDeletedAt),
      ),
    ) as SQL;
  }
  return or(
    and(
      eq(messages.channel, 'direct'),
      eq(messages.senderId, me),
      eq(messages.recipientId, peer.userId),
      isNull(messages.senderDeletedAt),
    ),
    and(
      eq(messages.channel, 'direct'),
      eq(messages.senderId, peer.userId),
      eq(messages.recipientId, me),
      isNull(messages.recipientDeletedAt),
    ),
  ) as SQL;
}

function toChatMessage(row: MessageRow, me: string): ChatMessage {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    // Between users, mine is what I sent. With the administrators, mine is what the user's side sent:
    // a reply (no sender) is theirs.
    mine: row.senderId === me,
  };
}

/** Removes the rows both sides have deleted. A row nobody can see has no reason to stay. */
export async function purgeFullyDeleted(
  runner: Pick<typeof db, 'delete'>,
  where: SQL | undefined,
): Promise<void> {
  await runner
    .delete(messages)
    .where(and(isNotNull(messages.senderDeletedAt), isNotNull(messages.recipientDeletedAt), where));
}

/**
 * Messages from a user's point of view: the inbox, a conversation, sending and deleting for oneself.
 * What the administrators do with the same table is `AdminMessageService`.
 */
export class MessageService {
  private notify(...userIds: string[]): void {
    for (const userId of new Set(userIds)) {
      emitUserEvent(userId, { type: 'messages.changed' });
    }
  }

  private async friendIdsOf(userId: string): Promise<Set<string>> {
    const rows = await db
      .select({ senderId: friendships.senderId, receiverId: friendships.receiverId })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, FriendStatus.FRIEND),
          or(eq(friendships.senderId, userId), eq(friendships.receiverId, userId)),
        ),
      );
    return new Set(rows.map((row) => (row.senderId === userId ? row.receiverId : row.senderId)));
  }

  private async assertFriend(me: string, peerId: string): Promise<void> {
    if (!(await this.friendIdsOf(me)).has(peerId)) {
      throw new AppError(403, 'Messages can only be exchanged with friends.');
    }
  }

  /**
   * One line per conversation: the administrators (when there is anything with them) and each current
   * friend with whom there is something. Whoever stopped being a friend leaves the list, and their
   * history stays out of sight until the friendship is back.
   */
  async listConversations(me: string): Promise<ConversationSummary[]> {
    const peerOf = sql<string>`case when ${messages.senderId} = ${me} then ${messages.recipientId} else ${messages.senderId} end`;
    const [friendIds, latestDirect, [latestAdmin]] = await Promise.all([
      this.friendIdsOf(me),
      db
        .select({ id: max(messages.id) })
        .from(messages)
        .where(conversationWhereAnyDirect(me))
        .groupBy(peerOf),
      db
        .select()
        .from(messages)
        .where(conversationWhere(me, { kind: 'admin' }))
        .orderBy(desc(messages.id))
        .limit(1),
    ]);

    const ids = latestDirect.map((row) => row.id).filter((id): id is string => id !== null);
    const directRows = ids.length
      ? await db.select().from(messages).where(inArray(messages.id, ids))
      : [];

    const summaries: ConversationSummary[] = [];
    for (const row of directRows) {
      const peerUserId = row.senderId === me ? row.recipientId : row.senderId;
      if (peerUserId && friendIds.has(peerUserId)) {
        summaries.push({ kind: 'direct', peerUserId, lastMessage: toChatMessage(row, me) });
      }
    }
    if (latestAdmin) {
      summaries.push({
        kind: 'admin',
        peerUserId: null,
        lastMessage: toChatMessage(latestAdmin, me),
      });
    }
    return summaries.sort((a, b) => b.lastMessage.id.localeCompare(a.lastMessage.id));
  }

  async listMessages(
    me: string,
    peer: MessagePeer,
    page: { before?: string; limit: number },
  ): Promise<MessagePage> {
    if (peer.kind === 'direct') {
      await this.assertFriend(me, peer.userId);
    }
    const where = page.before
      ? and(conversationWhere(me, peer), lt(messages.id, page.before))
      : conversationWhere(me, peer);
    const rows = await db
      .select()
      .from(messages)
      .where(where)
      .orderBy(desc(messages.id))
      .limit(page.limit + 1);
    const hasMore = rows.length > page.limit;
    const items = rows.slice(0, page.limit).map((row) => toChatMessage(row, me));
    return { items, nextBefore: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  private async assertLiveSender(userId: string): Promise<void> {
    const sender = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { isDeleted: true },
    });
    if (!sender || sender.isDeleted) {
      throw new AppError(403, 'This account cannot send messages.');
    }
  }

  private async assertQuota(userId: string, kind: MessageQuotaKind): Promise<void> {
    try {
      await messageQuotaService.assertCanSend(userId, kind);
    } catch (error) {
      if (error instanceof TierLimitExceededError) {
        throw new AppError(429, error.message);
      }
      throw error;
    }
  }

  async sendToUser(me: string, peerId: string, body: string): Promise<ChatMessage> {
    if (me === peerId) {
      throw new AppError(400, 'Cannot send a message to yourself.');
    }
    await this.assertLiveSender(me);
    const created = await withWriteTransaction(async (tx) => {
      // The friendship and the block state are read and acted on together: ending a friendship at
      // the same moment must not let one more message through.
      await lockUserPair(tx, me, peerId);
      const peer = await tx.query.users.findFirst({
        where: eq(users.id, peerId),
        columns: { isDeleted: true },
      });
      if (!peer || peer.isDeleted) {
        throw new AppError(404, 'User not found.');
      }
      const friendship = await tx.query.friendships.findFirst({
        where: and(
          or(
            and(eq(friendships.senderId, me), eq(friendships.receiverId, peerId)),
            and(eq(friendships.senderId, peerId), eq(friendships.receiverId, me)),
          ),
          eq(friendships.status, FriendStatus.FRIEND),
        ),
        columns: { id: true },
      });
      if (!friendship) {
        throw new AppError(403, 'Messages can only be exchanged with friends.');
      }
      await this.assertQuota(me, 'direct');
      const [row] = await tx
        .insert(messages)
        .values({ id: newMessageId(), channel: 'direct', senderId: me, recipientId: peerId, body })
        .returning();
      await messageQuotaService.record(tx, me, 'direct');
      return row;
    });
    this.notify(me, peerId);
    return toChatMessage(created, me);
  }

  /**
   * A story report to the administrators. The envelope carries the story id - the client only
   * sends the free-text reason, so nothing report-specific is trusted from it. Same quota and
   * channel as an ordinary message to the administrators, so reports stay inside the abuse
   * limits of that channel.
   */
  async sendStoryReport(me: string, storyId: string, reason: string): Promise<ChatMessage> {
    return this.sendToAdmins(me, buildNsfwReportBody(storyId, reason));
  }

  /** Reports a live story that is not the reporter's own; the route only carries the story id. */
  async reportStory(me: string, storyId: string, reason: string): Promise<ChatMessage> {
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { id: true, userId: true, isDeleted: true },
    });
    if (!story || story.isDeleted) {
      throw new AppError(404, 'Story not found.');
    }
    if (story.userId === me) {
      throw new AppError(403, 'You cannot report your own story.');
    }
    return this.sendStoryReport(me, story.id, reason);
  }

  async sendToAdmins(me: string, body: string): Promise<ChatMessage> {
    await this.assertLiveSender(me);
    await this.assertQuota(me, 'admin');
    const created = await withWriteTransaction(async (tx) => {
      const [row] = await tx
        .insert(messages)
        .values({ id: newMessageId(), channel: 'admin', senderId: me, recipientId: null, body })
        .returning();
      await messageQuotaService.record(tx, me, 'admin');
      return row;
    });
    this.notify(me);
    return toChatMessage(created, me);
  }

  /** Deletes one message from this user's side only; the other side keeps it. */
  async deleteForMe(me: string, messageId: string): Promise<void> {
    await withWriteTransaction(async (tx) => {
      const row = await tx.query.messages.findFirst({ where: eq(messages.id, messageId) });
      const mine = row && (row.senderId === me || row.recipientId === me);
      if (!row || !mine) {
        throw new AppError(404, 'Message not found.');
      }
      const now = new Date();
      await tx
        .update(messages)
        .set(row.senderId === me ? { senderDeletedAt: now } : { recipientDeletedAt: now })
        .where(eq(messages.id, messageId));
      await purgeFullyDeleted(tx, eq(messages.id, messageId));
    });
    this.notify(me);
  }

  /** Clears a whole conversation from this user's side. */
  async clearConversation(me: string, peer: MessagePeer): Promise<void> {
    const [sentHere, receivedHere] =
      peer.kind === 'admin'
        ? [
            and(
              eq(messages.channel, 'admin'),
              eq(messages.senderId, me),
              isNull(messages.recipientId),
            ),
            and(
              eq(messages.channel, 'admin'),
              eq(messages.recipientId, me),
              isNull(messages.senderId),
            ),
          ]
        : [
            and(
              eq(messages.channel, 'direct'),
              eq(messages.senderId, me),
              eq(messages.recipientId, peer.userId),
            ),
            and(
              eq(messages.channel, 'direct'),
              eq(messages.senderId, peer.userId),
              eq(messages.recipientId, me),
            ),
          ];
    await withWriteTransaction(async (tx) => {
      const now = new Date();
      await tx
        .update(messages)
        .set({ senderDeletedAt: now })
        .where(and(sentHere, isNull(messages.senderDeletedAt)));
      await tx
        .update(messages)
        .set({ recipientDeletedAt: now })
        .where(and(receivedHere, isNull(messages.recipientDeletedAt)));
      await purgeFullyDeleted(tx, or(sentHere, receivedHere));
    });
    this.notify(me);
  }
}

/** Every direct message this user sees, with anybody. */
function conversationWhereAnyDirect(me: string): SQL {
  return or(
    and(
      eq(messages.channel, 'direct'),
      eq(messages.senderId, me),
      isNull(messages.senderDeletedAt),
    ),
    and(
      eq(messages.channel, 'direct'),
      eq(messages.recipientId, me),
      isNull(messages.recipientDeletedAt),
    ),
  ) as SQL;
}

export const messageService = new MessageService();

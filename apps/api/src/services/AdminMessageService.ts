import type {
  AdminMessage,
  AdminMessageDetail,
  AdminMessageListQuery,
  AdminMessagePage,
  AdminMessagePatch,
} from '@keres/shared';
import { and, asc, count, desc, eq, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { NSFW_REPORT_TAG } from '@keres/shared';
import { db, withWriteTransaction } from '../db';
import { messages, users } from '../db/schema';
import { insensitiveLike } from '../db/sqlOperators';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';
import { AppError } from '../utils/errors';
import { newMessageId, purgeFullyDeleted } from './MessageService';

/** How much of a conversation the detail view shows next to the message that was opened. */
const THREAD_LIMIT = 100;

type MessageRow = typeof messages.$inferSelect;
type UserRow = Pick<typeof users.$inferSelect, 'id' | 'username' | 'tag' | 'isDeleted'>;

const USER_COLUMNS = {
  id: users.id,
  username: users.username,
  tag: users.tag,
  isDeleted: users.isDeleted,
};

/**
 * What arrived for the administrators: a message from the landing page, or a user writing to them.
 * Both have no recipient (the administrators are not a user) and are still on the administrators'
 * side of the table.
 */
const INCOMING: SQL = and(isNull(messages.recipientId), isNull(messages.recipientDeletedAt)) as SQL;

function toAdminMessage(row: MessageRow, user: UserRow | null): AdminMessage {
  const fromAdmin = row.senderId === null && row.channel === 'admin';
  return {
    id: row.id,
    channel: row.channel === 'site' ? 'site' : 'admin',
    fromAdmin,
    subject: row.subject,
    body: row.body,
    contactEmail: row.contactEmail,
    user,
    createdAt: row.createdAt.toISOString(),
    // Replies are the administrators' own: there is nothing in them to have read.
    isRead: fromAdmin || row.adminReadAt !== null,
    isArchived: row.adminArchivedAt !== null,
  };
}

function orderFor(query: AdminMessageListQuery): SQL[] {
  const direction = query.order === 'asc' ? asc : desc;
  switch (query.sort) {
    case 'sender':
      // A site message has no user: its address stands in, so the column sorts as one list.
      return [
        direction(sql`lower(coalesce(${users.username}, ${messages.contactEmail}))`),
        desc(messages.id),
      ];
    case 'subject':
      return [direction(sql`lower(coalesce(${messages.subject}, ''))`), desc(messages.id)];
    default:
      return [direction(messages.id)];
  }
}

/**
 * The administrators' side of the messages: the inbox with its filters, opening, reading state,
 * archiving, replying to a registered user, and deleting.
 */
export class AdminMessageService {
  private listWhere(query: AdminMessageListQuery): SQL {
    const conditions: SQL[] = [INCOMING];
    if (query.source === 'site') conditions.push(eq(messages.channel, 'site'));
    if (query.source === 'user') conditions.push(eq(messages.channel, 'admin'));
    if (query.source === 'report') {
      // Reports travel as `admin`-channel messages with a machine-readable envelope (see
      // `buildNsfwReportBody`): the filter matches the envelope, not free text.
      conditions.push(eq(messages.channel, 'admin'));
      conditions.push(insensitiveLike(messages.body, `${NSFW_REPORT_TAG}%`));
    }
    if (query.read === 'unread') conditions.push(isNull(messages.adminReadAt));
    if (query.read === 'read') conditions.push(isNotNull(messages.adminReadAt));
    if (query.archived === 'active') conditions.push(isNull(messages.adminArchivedAt));
    if (query.archived === 'archived') conditions.push(isNotNull(messages.adminArchivedAt));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          insensitiveLike(messages.body, pattern),
          insensitiveLike(messages.subject, pattern),
          insensitiveLike(messages.contactEmail, pattern),
          insensitiveLike(users.username, pattern),
          insensitiveLike(users.tag, pattern),
        ) as SQL,
      );
    }
    return and(...conditions) as SQL;
  }

  async list(query: AdminMessageListQuery): Promise<AdminMessagePage> {
    const where = this.listWhere(query);
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({ message: messages, user: USER_COLUMNS })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(where)
        .orderBy(...orderFor(query))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db
        .select({ total: count() })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(where),
    ]);
    return {
      items: rows.map((row) => toAdminMessage(row.message, row.user?.id ? row.user : null)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async unreadCount(): Promise<{ unread: number }> {
    const [{ total }] = await db
      .select({ total: count() })
      .from(messages)
      .where(and(INCOMING, isNull(messages.adminReadAt), isNull(messages.adminArchivedAt)));
    return { unread: total };
  }

  private async findIncoming(id: string): Promise<{ row: MessageRow; user: UserRow | null }> {
    const [found] = await db
      .select({ message: messages, user: USER_COLUMNS })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderId))
      .where(and(eq(messages.id, id), INCOMING));
    if (!found) {
      throw new AppError(404, 'Message not found.');
    }
    return { row: found.message, user: found.user?.id ? found.user : null };
  }

  /**
   * Opening a message marks it read - the list shows what still needs attention, and opening the
   * detail is the acknowledgement - and brings the rest of the conversation with that user along.
   */
  async open(id: string): Promise<AdminMessageDetail> {
    let { row, user } = await this.findIncoming(id);
    if (row.adminReadAt === null) {
      const [updated] = await db
        .update(messages)
        .set({ adminReadAt: new Date() })
        .where(eq(messages.id, id))
        .returning();
      row = updated;
    }
    const thread = user ? await this.threadWith(user) : [];
    return { message: toAdminMessage(row, user), thread };
  }

  /** The administrators' side of the conversation with one user, oldest first. */
  private async threadWith(user: UserRow): Promise<AdminMessage[]> {
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.channel, 'admin'),
          or(
            and(eq(messages.senderId, user.id), INCOMING),
            and(
              eq(messages.recipientId, user.id),
              isNull(messages.senderId),
              isNull(messages.senderDeletedAt),
            ),
          ),
        ),
      )
      .orderBy(desc(messages.id))
      .limit(THREAD_LIMIT);
    return rows.reverse().map((row) => toAdminMessage(row, user));
  }

  async patch(id: string, patch: AdminMessagePatch): Promise<AdminMessage> {
    const { user } = await this.findIncoming(id);
    const changes: Partial<MessageRow> = {};
    if (patch.read !== undefined) changes.adminReadAt = patch.read ? new Date() : null;
    if (patch.archived !== undefined) changes.adminArchivedAt = patch.archived ? new Date() : null;
    const [updated] = await db.update(messages).set(changes).where(eq(messages.id, id)).returning();
    return toAdminMessage(updated, user);
  }

  /** Answers a registered user inside the platform. A visitor from the site is answered by email. */
  async reply(id: string, adminId: string, body: string): Promise<AdminMessage> {
    const { row, user } = await this.findIncoming(id);
    if (!user || row.channel !== 'admin') {
      throw new AppError(409, 'This message came from the site: reply to the address it left.');
    }
    if (user.isDeleted) {
      throw new AppError(409, 'This user no longer has an account.');
    }
    const created = await withWriteTransaction(async (tx) => {
      const [reply] = await tx
        .insert(messages)
        .values({
          id: newMessageId(),
          channel: 'admin',
          senderId: null,
          recipientId: user.id,
          sentByAdminId: adminId,
          body,
          // The administrators' side of their own reply is never deleted by the user, and the
          // user's is theirs to delete: neither column starts set.
        })
        .returning();
      if (row.adminReadAt === null) {
        await tx.update(messages).set({ adminReadAt: new Date() }).where(eq(messages.id, id));
      }
      return reply;
    });
    emitUserEvent(user.id, { type: 'messages.changed' });
    return toAdminMessage(created, user);
  }

  /**
   * Removes a message from the administrators' side - one that arrived, or one of their own replies
   * from the conversation view. If the user's side is gone too, the row goes.
   */
  async remove(id: string): Promise<{ id: string }> {
    const row = await db.query.messages.findFirst({ where: eq(messages.id, id) });
    const arrived = row && row.recipientId === null && row.recipientDeletedAt === null;
    const reply =
      row && row.channel === 'admin' && row.senderId === null && row.senderDeletedAt === null;
    if (!row || !(arrived || reply)) {
      throw new AppError(404, 'Message not found.');
    }
    await withWriteTransaction(async (tx) => {
      const now = new Date();
      await tx
        .update(messages)
        .set(arrived ? { recipientDeletedAt: now } : { senderDeletedAt: now })
        .where(eq(messages.id, id));
      await purgeFullyDeleted(tx, eq(messages.id, id));
    });
    return { id };
  }
}

export const adminMessageService = new AdminMessageService();

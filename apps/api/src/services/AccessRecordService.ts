import {
  ACCESS_RECORD_EXPORT_MAX_ROWS,
  ACCESS_RECORD_MAX_USERNAME,
  type AccessRecord,
  type AccessRecordEvent,
  type AccessRecordListQuery,
  type AccessRecordPage,
} from '@keres/shared';
import { and, desc, eq, gte, lt, lte, or, type SQL } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '../config/env';
import { db } from '../db';
import { accessRecords, users } from '../db/schema';
import { trackBackground } from '../utils/backgroundWork';
import { csvCell } from './AuditService';

const DAY_MS = 24 * 60 * 60 * 1000;
/** What a request names when no address could be read from it: the column does not take an empty one. */
const UNKNOWN_ADDRESS = 'unknown';
/** Longest address a record keeps: an IPv6 address with its zone is well under this. */
const MAX_ADDRESS = 45;

export interface AccessRecordInput {
  event: AccessRecordEvent;
  /** The address of the request (see `clientAddress`); `null` when none could be read. */
  ip: string | null;
  /** The account, when the request already knows it (a login with the right password, a session renewed). */
  userId?: string | null;
  /**
   * The name the request typed. Without a `userId` it is looked up - a deleted account still counts as the account,
   * as it still is the same person - and only a name that matches nobody is kept as `username_tried`.
   */
  username?: string | null;
  /** When it happened; now by default. A parameter so the tests can place records in the past. */
  occurredAt?: Date;
}

/** `search` takes the list query as it is, with the limit the caller wants. */
export type AccessRecordSearch = AccessRecordListQuery;

/**
 * The access records: written by the routes that establish a session (never by ordinary calls), read by the
 * administrators, and dropped once they are older than `ACCESS_RECORD_RETENTION_DAYS` - six months by default,
 * what the Marco Civil da Internet asks of an application provider.
 */
export class AccessRecordService {
  /**
   * Records an event without making the request wait, and without ever failing it: the record is written after
   * the answer, and losing a line is better than refusing the sign-in it describes. A failure goes to the console
   * only - the technical log writes through the database too, so it must not be used from here.
   */
  record(input: AccessRecordInput): void {
    trackBackground(
      this.recordNow(input).catch((error: unknown) => {
        console.error('Failed to record an access record', error);
      }),
    );
  }

  async recordNow(input: AccessRecordInput): Promise<void> {
    let userId = input.userId ?? null;
    let usernameTried: string | null = null;
    if (!userId && input.username) {
      userId = await this.findAccountId(input.username);
      if (!userId) usernameTried = input.username.slice(0, ACCESS_RECORD_MAX_USERNAME);
    }
    await db.insert(accessRecords).values({
      id: ulid(),
      occurredAt: input.occurredAt ?? new Date(),
      userId,
      usernameTried,
      event: input.event,
      ip: input.ip ? input.ip.slice(0, MAX_ADDRESS) : UNKNOWN_ADDRESS,
    });
  }

  /** The id of the account with this name, a deleted one included; `null` when no account has it. */
  private async findAccountId(username: string): Promise<string | null> {
    const found = await db.query.users.findFirst({
      where: eq(users.username, username),
      columns: { id: true },
    });
    return found?.id ?? null;
  }

  /**
   * Drops the records older than the retention, counted back from `now`. Returns how many went. The erasure of
   * an account does not reach here: its records stay until this runs (see `UserService.pruneDeletedAccounts`).
   */
  async pruneExpired(now = new Date(), days = env.ACCESS_RECORD_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const deleted = await db
      .delete(accessRecords)
      .where(lt(accessRecords.occurredAt, cutoff))
      .returning({ id: accessRecords.id });
    return deleted.length;
  }

  /**
   * The records matching the filters, newest first, one page at a time. `nextCursor` is set when there is more:
   * the cursor is the last record's time and id, so a record that arrives between two pages moves nothing.
   */
  async search(query: AccessRecordSearch): Promise<AccessRecordPage> {
    const conditions: SQL[] = [];
    if (query.userId) conditions.push(eq(accessRecords.userId, query.userId));
    if (query.username) {
      // The name is matched both as the account it is and as a name that was tried and matched nobody.
      const accountId = await this.findAccountId(query.username);
      conditions.push(
        or(
          accountId ? eq(accessRecords.userId, accountId) : undefined,
          eq(accessRecords.usernameTried, query.username),
        ) as SQL,
      );
    }
    if (query.ip) conditions.push(eq(accessRecords.ip, query.ip));
    if (query.from) conditions.push(gte(accessRecords.occurredAt, query.from));
    if (query.to) conditions.push(lte(accessRecords.occurredAt, query.to));
    if (query.cursor) {
      const separator = query.cursor.indexOf('_');
      const before = new Date(Number(query.cursor.slice(0, separator)));
      const afterId = query.cursor.slice(separator + 1);
      conditions.push(
        or(
          lt(accessRecords.occurredAt, before),
          and(eq(accessRecords.occurredAt, before), lt(accessRecords.id, afterId)),
        ) as SQL,
      );
    }

    // One more than asked for: that extra one says whether there is a next page, without a count.
    const rows = await db
      .select({
        id: accessRecords.id,
        occurredAt: accessRecords.occurredAt,
        event: accessRecords.event,
        userId: accessRecords.userId,
        usernameTried: accessRecords.usernameTried,
        ip: accessRecords.ip,
        username: users.username,
      })
      .from(accessRecords)
      .leftJoin(users, eq(users.id, accessRecords.userId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(accessRecords.occurredAt), desc(accessRecords.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const shown = hasMore ? rows.slice(0, query.limit) : rows;
    const last = shown.at(-1);
    const items: AccessRecord[] = shown.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      event: row.event,
      userId: row.userId,
      username: row.userId ? (row.username ?? null) : null,
      usernameTried: row.usernameTried,
      ip: row.ip,
    }));
    return {
      items,
      nextCursor: hasMore && last ? `${last.occurredAt.getTime()}_${last.id}` : null,
      retentionDays: env.ACCESS_RECORD_RETENTION_DAYS,
    };
  }

  /**
   * An account's own records, newest first, for the data export (the person's right of access): the moment, what
   * it was and the address. Only the records that name the account; the names tried by others are not its own.
   */
  async listOwn(userId: string) {
    const rows = await db
      .select({
        occurredAt: accessRecords.occurredAt,
        event: accessRecords.event,
        ip: accessRecords.ip,
      })
      .from(accessRecords)
      .where(eq(accessRecords.userId, userId))
      .orderBy(desc(accessRecords.occurredAt), desc(accessRecords.id))
      .limit(ACCESS_RECORD_EXPORT_MAX_ROWS);
    return rows.map((row) => ({
      occurredAt: row.occurredAt.toISOString(),
      event: row.event,
      ip: row.ip,
    }));
  }

  /**
   * The filtered records as CSV, newest first, at most `ACCESS_RECORD_EXPORT_MAX_ROWS` lines. `truncated` says the
   * filters selected more than that, so the export is not the whole of what was asked for.
   */
  async exportCsv(query: AccessRecordSearch): Promise<{ csv: string; truncated: boolean }> {
    const page = await this.search({
      ...query,
      cursor: undefined,
      limit: ACCESS_RECORD_EXPORT_MAX_ROWS,
    });
    const header = ['time', 'event', 'account', 'account_id', 'username_tried', 'ip'];
    const lines = page.items.map((record) =>
      [
        record.occurredAt,
        record.event,
        record.username ?? '',
        record.userId ?? '',
        record.usernameTried ?? '',
        record.ip,
      ]
        .map(csvCell)
        .join(','),
    );
    return {
      csv: [header.join(','), ...lines].join('\r\n') + '\r\n',
      truncated: page.nextCursor !== null,
    };
  }
}

export const accessRecordService = new AccessRecordService();

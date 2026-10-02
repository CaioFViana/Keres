import type {
  AuditCategory,
  AuditEvent,
  AuditEventListQuery,
  AuditEventPage,
  AuditOutcome,
  AuditSummary,
  AuditUserRef,
} from '@keres/shared';
import { APP_RELEASE } from '@keres/shared';
import { AUDIT_ACTIONS, AUDIT_EXPORT_MAX_ROWS } from '@keres/shared/metadata/AuditEvents';
import { and, asc, count, desc, eq, gte, isNotNull, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import { ulid } from 'ulid';
import { env } from '../config/env';
import { db } from '../db';
import { alias } from '../db/schema/columns';
import { apiLogs, auditEvents, stories, users } from '../db/schema';
import { insensitiveLike } from '../db/sqlOperators';

const STARTED_AT = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;
/** Longest a stored user agent or free text goes: the record is not a place for what a client sends at will. */
const MAX_TEXT = 200;

export interface AuditInput {
  category: AuditCategory;
  /** `area.what`, like `auth.login`. */
  action: string;
  outcome?: AuditOutcome;
  actorUserId?: string | null;
  actorUsername?: string | null;
  subjectUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Never secrets or content: the status, the reason a refusal gave, names of what changed. */
  meta?: Record<string, unknown> | null;
}

const clip = (value: string | null | undefined): string | null =>
  value ? value.slice(0, MAX_TEXT) : null;

/**
 * The activity record: written by the request audit and by the few events that are not a request
 * (the server starting, a plan limit met in a sync), read by the admin panel.
 */
export class AuditService {
  /**
   * Records an event without making anybody wait for it, and without ever failing them: the record is an
   * observation, and losing a line is better than refusing the action it describes. A failure goes to the
   * console only - the technical log writes through the database too, so it must not be used from here.
   */
  record(input: AuditInput): void {
    void this.recordNow(input).catch((error: unknown) => {
      console.error('Failed to record an audit event', error);
    });
  }

  /**
   * Like `record`, but at most once per `key` in the window: for what repeats on its own (a client that
   * retries a refused sync every few seconds) and would otherwise bury everything else in the record.
   */
  recordThrottled(key: string, windowMs: number, input: AuditInput, now = Date.now()): void {
    const last = this.throttle.get(key);
    if (last !== undefined && now - last < windowMs) return;
    this.throttle.set(key, now);
    if (this.throttle.size > 5000) {
      for (const [oldKey, at] of this.throttle) {
        if (now - at >= windowMs) this.throttle.delete(oldKey);
      }
    }
    this.record(input);
  }

  private readonly throttle = new Map<string, number>();

  async recordNow(input: AuditInput): Promise<void> {
    await db.insert(auditEvents).values({
      id: ulid(),
      category: input.category,
      action: input.action,
      outcome: input.outcome ?? 'success',
      actorUserId: input.actorUserId ?? null,
      actorUsername: clip(input.actorUsername),
      subjectUserId: input.subjectUserId ?? null,
      targetType: clip(input.targetType),
      targetId: clip(input.targetId),
      ip: clip(input.ip),
      userAgent: clip(input.userAgent),
      meta: input.meta ?? null,
    });
  }

  /** The id of the live account with this name, if any - for a login the request itself cannot say who. */
  async findUserIdByUsername(username: string): Promise<string | null> {
    const found = await db.query.users.findFirst({
      where: eq(users.username, username),
      columns: { id: true },
    });
    return found?.id ?? null;
  }

  private where(
    query: AuditEventListQuery,
    actor: typeof users,
    subject: typeof users,
  ): SQL | undefined {
    const conditions: SQL[] = [];
    if (query.category !== 'all') conditions.push(eq(auditEvents.category, query.category));
    if (query.outcome !== 'all') conditions.push(eq(auditEvents.outcome, query.outcome));
    if (query.action) conditions.push(insensitiveLike(auditEvents.action, `%${query.action}%`));
    if (query.userId) {
      conditions.push(
        or(
          eq(auditEvents.actorUserId, query.userId),
          eq(auditEvents.subjectUserId, query.userId),
        ) as SQL,
      );
    }
    if (query.from) conditions.push(gte(auditEvents.createdAt, query.from));
    if (query.to) conditions.push(lte(auditEvents.createdAt, query.to));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          insensitiveLike(auditEvents.action, pattern),
          insensitiveLike(auditEvents.actorUsername, pattern),
          insensitiveLike(auditEvents.targetId, pattern),
          insensitiveLike(auditEvents.ip, pattern),
          insensitiveLike(actor.username, pattern),
          insensitiveLike(actor.tag, pattern),
          insensitiveLike(subject.username, pattern),
          insensitiveLike(subject.tag, pattern),
        ) as SQL,
      );
    }
    return conditions.length ? and(...conditions) : undefined;
  }

  private async select(query: AuditEventListQuery, limit: number, offset: number) {
    const actor = alias(users, 'audit_actor');
    const subject = alias(users, 'audit_subject');
    const direction = query.order === 'asc' ? asc : desc;
    const rows = await db
      .select({
        event: auditEvents,
        actor: {
          id: actor.id,
          username: actor.username,
          tag: actor.tag,
          isDeleted: actor.isDeleted,
        },
        subject: {
          id: subject.id,
          username: subject.username,
          tag: subject.tag,
          isDeleted: subject.isDeleted,
        },
      })
      .from(auditEvents)
      .leftJoin(actor, eq(actor.id, auditEvents.actorUserId))
      .leftJoin(subject, eq(subject.id, auditEvents.subjectUserId))
      .where(
        this.where(query, actor as unknown as typeof users, subject as unknown as typeof users),
      )
      .orderBy(direction(auditEvents.createdAt), direction(auditEvents.id))
      .limit(limit)
      .offset(offset);
    return { rows, actor, subject };
  }

  private toEvent(row: Awaited<ReturnType<AuditService['select']>>['rows'][number]): AuditEvent {
    const { event, actor, subject } = row;
    const actorRef: AuditUserRef | null =
      event.actorUserId || event.actorUsername
        ? {
            id: event.actorUserId,
            username: event.actorUsername ?? actor?.username ?? '',
            tag: actor?.tag ?? null,
            isDeleted: actor?.isDeleted ?? false,
          }
        : null;
    const subjectRef: AuditUserRef | null = event.subjectUserId
      ? {
          id: event.subjectUserId,
          username: subject?.username ?? '',
          tag: subject?.tag ?? null,
          isDeleted: subject?.isDeleted ?? false,
        }
      : null;
    return {
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      category: event.category,
      action: event.action,
      outcome: event.outcome,
      actor: actorRef,
      subject: subjectRef,
      targetType: event.targetType,
      targetId: event.targetId,
      ip: event.ip,
      userAgent: event.userAgent,
      meta: (event.meta as Record<string, unknown> | null) ?? null,
    };
  }

  async list(query: AuditEventListQuery): Promise<AuditEventPage> {
    const { rows, actor, subject } = await this.select(
      query,
      query.pageSize,
      (query.page - 1) * query.pageSize,
    );
    const [{ total }] = await db
      .select({ total: count() })
      .from(auditEvents)
      .leftJoin(actor, eq(actor.id, auditEvents.actorUserId))
      .leftJoin(subject, eq(subject.id, auditEvents.subjectUserId))
      .where(
        this.where(query, actor as unknown as typeof users, subject as unknown as typeof users),
      );
    return {
      items: rows.map((row) => this.toEvent(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** The filtered record as CSV, newest first, up to `AUDIT_EXPORT_MAX_ROWS` lines. */
  async exportCsv(query: AuditEventListQuery): Promise<string> {
    const { rows } = await this.select(query, AUDIT_EXPORT_MAX_ROWS, 0);
    const header = [
      'time',
      'category',
      'action',
      'outcome',
      'actor',
      'actor_id',
      'subject',
      'subject_id',
      'target_type',
      'target_id',
      'ip',
      'user_agent',
      'meta',
    ];
    const lines = rows.map((row) => {
      const event = this.toEvent(row);
      return [
        event.createdAt,
        event.category,
        event.action,
        event.outcome,
        event.actor?.username ?? '',
        event.actor?.id ?? '',
        event.subject?.username ?? '',
        event.subject?.id ?? '',
        event.targetType ?? '',
        event.targetId ?? '',
        event.ip ?? '',
        event.userAgent ?? '',
        event.meta ? JSON.stringify(event.meta) : '',
      ]
        .map(csvCell)
        .join(',');
    });
    return [header.join(','), ...lines].join('\r\n') + '\r\n';
  }

  /** What happened in the last `hours`, and how the server is doing. */
  async summary(hours: number, now = new Date()): Promise<AuditSummary> {
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const [grouped, failedIps, perDay, system] = await Promise.all([
      db
        .select({
          category: auditEvents.category,
          action: auditEvents.action,
          outcome: auditEvents.outcome,
          total: count(),
        })
        .from(auditEvents)
        .where(gte(auditEvents.createdAt, since))
        .groupBy(auditEvents.category, auditEvents.action, auditEvents.outcome),
      db
        .select({ ip: auditEvents.ip, total: count() })
        .from(auditEvents)
        .where(
          and(
            gte(auditEvents.createdAt, since),
            eq(auditEvents.action, AUDIT_ACTIONS.login),
            sql`${auditEvents.outcome} <> 'success'`,
            isNotNull(auditEvents.ip),
          ),
        )
        .groupBy(auditEvents.ip)
        .orderBy(desc(count()))
        .limit(5),
      this.perDay(now),
      this.systemInfo(since),
    ]);

    const summary: AuditSummary = {
      since: since.toISOString(),
      hours,
      total: 0,
      byCategory: {},
      failures: 0,
      denied: 0,
      failedLogins: 0,
      newAccounts: 0,
      messages: 0,
      limitHits: 0,
      adminActions: 0,
      topFailedLoginIps: failedIps
        .filter((row): row is { ip: string; total: number } => row.ip !== null)
        .map((row) => ({ ip: row.ip, count: row.total })),
      perDay,
      system,
    };
    for (const row of grouped) {
      summary.total += row.total;
      summary.byCategory[row.category] = (summary.byCategory[row.category] ?? 0) + row.total;
      if (row.outcome === 'failure') summary.failures += row.total;
      if (row.outcome === 'denied') summary.denied += row.total;
      if (row.action === AUDIT_ACTIONS.login && row.outcome !== 'success') {
        summary.failedLogins += row.total;
      }
      if (row.action === AUDIT_ACTIONS.register && row.outcome === 'success') {
        summary.newAccounts += row.total;
      }
      if (
        row.outcome === 'success' &&
        (row.action === AUDIT_ACTIONS.messageSentDirect ||
          row.action === AUDIT_ACTIONS.messageSentAdmin)
      ) {
        summary.messages += row.total;
      }
      if (row.category === 'limits') summary.limitHits += row.total;
      if (row.category === 'admin') summary.adminActions += row.total;
    }
    return summary;
  }

  /** Events per UTC day over the last fortnight, oldest first, empty days included. */
  private async perDay(now: Date): Promise<Array<{ day: string; count: number }>> {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Array.from({ length: 14 }, (_, index) => today - (13 - index) * DAY_MS);
    const counts = await Promise.all(
      days.map(async (start) => {
        const [{ total }] = await db
          .select({ total: count() })
          .from(auditEvents)
          .where(
            and(
              gte(auditEvents.createdAt, new Date(start)),
              lt(auditEvents.createdAt, new Date(start + DAY_MS)),
            ),
          );
        return { day: new Date(start).toISOString().slice(0, 10), count: total };
      }),
    );
    return counts;
  }

  private async systemInfo(since: Date): Promise<AuditSummary['system']> {
    const [[all], [active], [admins], [storyCount], [errors]] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(users).where(eq(users.isDeleted, false)),
      db
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.isAdmin, true), eq(users.isDeleted, false))),
      db.select({ total: count() }).from(stories).where(eq(stories.isDeleted, false)),
      db
        .select({ total: count() })
        .from(apiLogs)
        .where(and(eq(apiLogs.level, 'error'), gte(apiLogs.createdAt, since))),
    ]);
    const bun = (globalThis as { Bun?: { version: string } }).Bun;
    return {
      version: APP_RELEASE.version,
      startedAt: STARTED_AT.toISOString(),
      uptimeSeconds: Math.round((Date.now() - STARTED_AT.getTime()) / 1000),
      databaseDriver: env.DATABASE_DRIVER,
      runtime: bun ? `Bun ${bun.version}` : `Node ${process.version}`,
      memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      users: {
        total: all.total,
        active: active.total,
        deleted: all.total - active.total,
        admins: admins.total,
      },
      stories: storyCount.total,
      errorLogs: errors.total,
      retentionDays: env.AUDIT_RETENTION_DAYS,
    };
  }

  /** Drops what is older than the retention. Returns how many lines went. */
  async prune(now = new Date(), days = env.AUDIT_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const deleted = await db
      .delete(auditEvents)
      .where(lt(auditEvents.createdAt, cutoff))
      .returning({ id: auditEvents.id });
    return deleted.length;
  }
}

/**
 * One CSV cell. A value a spreadsheet would read as a formula (`=`, `+`, `-`, `@` first) is made text
 * with a leading quote: the record holds names and addresses people chose, and opening an export must
 * never run what one of them typed.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const auditService = new AuditService();

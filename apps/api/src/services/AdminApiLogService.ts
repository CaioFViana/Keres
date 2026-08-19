import { AdminApiLogQuery } from '@keres/shared';
import { and, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm';
import { db } from '../db';
import { apiLogs, stories, users } from '../db/schema';

export class AdminApiLogService {
  async browseApiLogs(filters: AdminApiLogQuery) {
    const conditions = [];
    if (filters.level) conditions.push(eq(apiLogs.level, filters.level));
    if (filters.storyId) conditions.push(eq(apiLogs.storyId, filters.storyId));
    if (filters.userId) conditions.push(eq(apiLogs.userId, filters.userId));
    if (filters.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(apiLogs.message, q),
          inArray(
            apiLogs.storyId,
            db.select({ id: stories.id }).from(stories).where(ilike(stories.title, q)),
          ),
          inArray(
            apiLogs.userId,
            db.select({ id: users.id }).from(users).where(ilike(users.username, q)),
          ),
        ),
      );
    }
    if (filters.from) conditions.push(gte(apiLogs.createdAt, filters.from));
    if (filters.to) conditions.push(lte(apiLogs.createdAt, filters.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      db
        .select()
        .from(apiLogs)
        .where(where)
        .orderBy(desc(apiLogs.createdAt))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
      db.select({ total: count() }).from(apiLogs).where(where),
    ]);

    const storyIds = [...new Set(items.map((row) => row.storyId).filter((id): id is string => !!id))];
    const userIds = [...new Set(items.map((row) => row.userId).filter((id): id is string => !!id))];

    const [storyRows, userRows] = await Promise.all([
      storyIds.length > 0
        ? db.select({ id: stories.id, title: stories.title }).from(stories).where(inArray(stories.id, storyIds))
        : Promise.resolve([] as Array<{ id: string; title: string }>),
      userIds.length > 0
        ? db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(inArray(users.id, userIds))
        : Promise.resolve([] as Array<{ id: string; username: string }>),
    ]);

    const storyTitles = new Map(storyRows.map((row) => [row.id, row.title]));
    const usernames = new Map(userRows.map((row) => [row.id, row.username]));

    return {
      items: items.map((row) => ({
        ...row,
        storyTitle: row.storyId ? (storyTitles.get(row.storyId) ?? null) : null,
        username: row.userId ? (usernames.get(row.userId) ?? null) : null,
      })),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }
}

export const adminApiLogService = new AdminApiLogService();

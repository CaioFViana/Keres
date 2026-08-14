import { AdminApiLogQuery } from '@keres/shared';
import { and, count, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { db } from '../db';
import { apiLogs } from '../db/schema';

export class AdminApiLogService {
  async browseApiLogs(filters: AdminApiLogQuery) {
    const conditions = [];
    if (filters.level) conditions.push(eq(apiLogs.level, filters.level));
    if (filters.storyId) conditions.push(eq(apiLogs.storyId, filters.storyId));
    if (filters.userId) conditions.push(eq(apiLogs.userId, filters.userId));
    if (filters.search) conditions.push(ilike(apiLogs.message, `%${filters.search}%`));
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

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }
}

export const adminApiLogService = new AdminApiLogService();

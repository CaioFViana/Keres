import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { apiLogs, stories, users } from '../../src/db/schema';
import { AdminApiLogService } from '../../src/services/AdminApiLogService';
import { persistApiLog } from '../../src/services/ApiLogService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
});

describe('API log services', () => {
  it('persists logger metadata and lets administrators browse filtered pages', async () => {
    await persistApiLog({
      level: 'info',
      message: 'Sincronização concluída',
      meta: { userId, storyId, operation: 'push' },
      timestamp: '2025-01-02T03:04:05.000Z',
    });
    await persistApiLog({
      level: 'warn',
      message: 'Limite de requisições',
      meta: { userId },
      timestamp: '2025-01-03T03:04:05.000Z',
    });
    await persistApiLog({
      level: 'error',
      message: 'Falha de armazenamento',
      timestamp: '2025-01-04T03:04:05.000Z',
    });

    const logs = await db.select().from(apiLogs);
    expect(logs).toHaveLength(3);
    expect(logs.find((log) => log.message === 'Sincronização concluída')).toMatchObject({
      userId,
      storyId,
      meta: { operation: 'push' },
    });

    const service = new AdminApiLogService();
    const result = await service.browseApiLogs({
      level: 'info',
      storyId,
      search: 'sincroniza',
      page: 1,
      pageSize: 10,
    });
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ message: 'Sincronização concluída', userId, storyId });
  });

  it('filters by date and applies pagination in descending chronological order', async () => {
    await db.insert(apiLogs).values([
      {
        id: newId(),
        level: 'info',
        message: 'primeiro',
        meta: null,
        userId: null,
        storyId: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      },
      {
        id: newId(),
        level: 'info',
        message: 'segundo',
        meta: null,
        userId: null,
        storyId: null,
        createdAt: new Date('2025-01-02T00:00:00.000Z'),
      },
      {
        id: newId(),
        level: 'info',
        message: 'terceiro',
        meta: null,
        userId: null,
        storyId: null,
        createdAt: new Date('2025-01-03T00:00:00.000Z'),
      },
    ]);

    const result = await new AdminApiLogService().browseApiLogs({
      page: 2,
      pageSize: 1,
      from: new Date('2025-01-02T00:00:00.000Z'),
      to: new Date('2025-01-03T00:00:00.000Z'),
    });
    expect(result).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.message).toBe('segundo');
  });
});

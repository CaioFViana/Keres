import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('ignores attributions in the meta that are not strings', async () => {
    await persistApiLog({
      level: 'info',
      message: 'Meta estranha',
      meta: { userId: 42, storyId: { id: 1 } },
      timestamp: '2025-01-06T03:04:05.000Z',
    });

    const logs = await db.select().from(apiLogs);
    expect(logs).toEqual([
      expect.objectContaining({
        userId: null,
        storyId: null,
        meta: expect.objectContaining({ userId: 42 }),
      }),
    ]);
  });

  it('never throws back at the logger when persistence fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      persistApiLog({
        level: 'fatal' as never,
        message: 'Nível inválido',
        meta: { userId },
        timestamp: '2025-01-07T03:04:05.000Z',
      }),
    ).resolves.toBeUndefined();
    await expect(
      persistApiLog({
        level: 'fatal' as never,
        message: 'Sem atribuição',
        timestamp: '2025-01-07T03:04:05.000Z',
      }),
    ).resolves.toBeUndefined();

    expect(await db.select().from(apiLogs)).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls[0][0]).toMatch(/Failed to persist API log/);
  });

  it('persists a rejected-request log even when userId/storyId do not exist here', async () => {
    // The case the packaged server hit: GET /sync/:storyId/pull with no auth, with a storyId that only
    // exists on the client. The FK in api_logs made the log's own insert fail with
    // SQLITE_CONSTRAINT_FOREIGNKEY.
    const missingStoryId = newId();
    await persistApiLog({
      level: 'warn',
      message: `Rejected request: GET /sync/${missingStoryId}/pull`,
      meta: {
        status: 401,
        message: 'Unauthorized: User not authenticated.',
        userId: null,
        storyId: missingStoryId,
      },
      timestamp: '2025-01-05T03:04:05.000Z',
    });

    const logs = await db.select().from(apiLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      level: 'warn',
      userId: null,
      storyId: missingStoryId,
    });
  });

  it('filters by user and upper date bound', async () => {
    await db.insert(apiLogs).values([
      {
        id: newId(),
        level: 'error',
        message: 'Falha ao enviar a mídia',
        meta: null,
        userId,
        storyId,
        createdAt: new Date('2025-02-01T00:00:00.000Z'),
      },
      {
        id: newId(),
        level: 'info',
        message: 'Tarefa de fundo concluída',
        meta: null,
        userId: null,
        storyId: null,
        createdAt: new Date('2025-02-02T00:00:00.000Z'),
      },
    ]);

    const service = new AdminApiLogService();
    const byUser = await service.browseApiLogs({ userId, page: 1, pageSize: 10 });
    expect(byUser.items).toEqual([expect.objectContaining({ message: 'Falha ao enviar a mídia' })]);
    const byTo = await service.browseApiLogs({
      to: new Date('2025-02-01T00:00:00.000Z'),
      page: 1,
      pageSize: 10,
    });
    expect(byTo.items).toEqual([expect.objectContaining({ message: 'Falha ao enviar a mídia' })]);
    const byTitle = await service.browseApiLogs({ search: 'queda', page: 1, pageSize: 10 });
    expect(byTitle.items).toEqual([
      expect.objectContaining({ message: 'Falha ao enviar a mídia', storyTitle: 'A Queda' }),
    ]);
    const byUsername = await service.browseApiLogs({ search: 'ana', page: 1, pageSize: 10 });
    expect(byUsername.items).toEqual([
      expect.objectContaining({ message: 'Falha ao enviar a mídia', username: 'ana' }),
    ]);
  });

  it('labels attributions pointing at missing rows as unknown', async () => {
    await db.insert(apiLogs).values({
      id: newId(),
      level: 'error',
      message: 'Órfã de chaves',
      meta: null,
      userId: newId(),
      storyId: newId(),
      createdAt: new Date('2025-03-01T00:00:00.000Z'),
    });

    const result = await new AdminApiLogService().browseApiLogs({ page: 1, pageSize: 10 });
    expect(result).toMatchObject({ total: 1 });
    expect(result.items).toEqual([
      expect.objectContaining({ message: 'Órfã de chaves', storyTitle: null, username: null }),
    ]);
  });

  it('returns an empty page when no rows exist', async () => {
    await expect(
      new AdminApiLogService().browseApiLogs({ page: 1, pageSize: 10 }),
    ).resolves.toMatchObject({ items: [], total: 0 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

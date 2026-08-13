import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { apiLogs, stories } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

let admin: TestUser;
let storyId: string;

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  const created = await request('POST', '/stories/', {
    token: admin.token,
    body: { title: 'Auditada', type: 'linear' },
  });
  storyId = created.data.id;
});

describe('admin recovery', () => {
  it('lists and restores a soft-deleted story through the audited recovery path', async () => {
    await db.update(stories).set({ isDeleted: true, deletedAt: new Date() }).where(eq(stories.id, storyId));

    const deleted = await request('GET', '/admin/api/recovery/deleted', {
      token: admin.token,
      query: { entityType: 'Story' },
    });
    expect(deleted.status).toBe(200);
    expect(deleted.data).toEqual(expect.arrayContaining([expect.objectContaining({ entityType: 'Story', id: storyId })]));

    const restored = await request('POST', `/admin/api/recovery/Story/${storyId}/restore`, { token: admin.token });
    expect(restored.status).toBe(200);
    expect(restored.data).toMatchObject({ id: storyId, isDeleted: false });

    const log = await request('GET', '/admin/api/recovery/operation-log', {
      token: admin.token,
      query: { storyId, entityType: 'Story' },
    });
    expect(log.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ entityId: storyId, userId: admin.userId })]));
  });

  it('returns clear client errors for invalid recovery requests', async () => {
    const unknown = await request('POST', `/admin/api/recovery/Unknown/${newId()}/restore`, { token: admin.token });
    const missing = await request('POST', `/admin/api/recovery/Story/${newId()}/restore`, { token: admin.token });
    const malformed = await request('GET', '/admin/api/recovery/operation-log', { token: admin.token, query: { page: 0 } });

    expect(unknown.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(400);
  });
});

describe('admin API log', () => {
  it('filters persisted API logs by level, story, user and text', async () => {
    await db.insert(apiLogs).values([
      { id: newId(), level: 'error', message: 'Media upload failed', userId: admin.userId, storyId, meta: { code: 'S3_DOWN' } },
      { id: newId(), level: 'info', message: 'Background task completed', userId: admin.userId, storyId, meta: null },
    ]);

    const response = await request('GET', '/admin/api/logs', {
      token: admin.token,
      query: { level: 'error', storyId, userId: admin.userId, search: 'upload', page: 1, pageSize: 10 },
    });

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(response.data.items).toEqual([expect.objectContaining({ level: 'error', message: 'Media upload failed', storyId })]);
  });

  it('validates API-log query parameters before querying the database', async () => {
    const response = await request('GET', '/admin/api/logs', { token: admin.token, query: { level: 'verbose' } });

    expect(response.status).toBe(400);
  });
});

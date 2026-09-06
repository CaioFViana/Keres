import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { truncateAll } from '../helpers/database';

afterEach(async () => {
  await truncateAll();
});

describe('database compatibility contract', () => {
  it('normalizes omitted optional values to NULL', async () => {
    await db.insert(users).values({
      id: 'nullable-user',
      username: 'nullable-user',
      tag: 'nullable-user',
      password: 'secret',
      avatarColor: undefined,
    });

    const user = await db.query.users.findFirst({ where: eq(users.id, 'nullable-user') });
    expect(user?.avatarColor).toBeNull();
  });

  it('enforces foreign keys', async () => {
    await expect(
      db.insert(stories).values({
        id: 'orphan-story',
        userId: 'missing-user',
        title: 'Sem autora',
        type: 'linear',
      }),
    ).rejects.toThrow();
  });
});

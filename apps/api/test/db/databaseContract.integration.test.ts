import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { truncateAll } from '../helpers/database';

afterEach(async () => {
  await truncateAll();
});

describe('database compatibility contract', () => {
  it('does not expose driver-specific helpers in the application contract', () => {
    const excludesDriverSpecificKeys: Extract<
      keyof typeof db,
      '$with' | '$count' | '$cache' | 'all' | 'run'
    > extends never
      ? true
      : false = true;

    expect(excludesDriverSpecificKeys).toBe(true);
  });

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

  it('round-trips shared scalar and JSON modes through the relational API', async () => {
    const createdAt = new Date('2026-09-06T12:34:56.789Z');
    await db.insert(users).values({
      id: 'contract-user',
      username: 'contract-user',
      tag: 'contract-user',
      password: 'secret',
      isAdmin: true,
      createdAt,
      updatedAt: createdAt,
    });
    await db.insert(stories).values({
      id: 'contract-story',
      userId: 'contract-user',
      title: 'Contrato',
      type: 'linear',
      timelineEpochDay: 42,
      normalizeSceneTiming: true,
      vocabulary: {
        version: 1,
        language: 'pt',
        terms: {
          Character: { singular: 'Pessoa', plural: 'Pessoas', grammaticalGender: 'feminine' },
        },
      },
      createdAt,
      updatedAt: createdAt,
    });

    const story = await db.query.stories.findFirst({
      where: eq(stories.id, 'contract-story'),
    });

    expect(story).toMatchObject({
      timelineEpochDay: 42,
      normalizeSceneTiming: true,
      vocabulary: {
        version: 1,
        language: 'pt',
        terms: {
          Character: { singular: 'Pessoa', plural: 'Pessoas', grammaticalGender: 'feminine' },
        },
      },
    });
    expect(story?.createdAt).toEqual(createdAt);
  });

  it('supports the common update, select and delete surface', async () => {
    await db.insert(users).values({
      id: 'mutable-user',
      username: 'mutable-user',
      tag: 'mutable-user',
      password: 'secret',
    });

    await db.update(users).set({ bio: 'updated' }).where(eq(users.id, 'mutable-user'));
    const [updated] = await db.select().from(users).where(eq(users.id, 'mutable-user'));
    expect(updated.bio).toBe('updated');

    await db.delete(users).where(eq(users.id, 'mutable-user'));
    expect(await db.query.users.findFirst({ where: eq(users.id, 'mutable-user') })).toBeUndefined();
  });
});

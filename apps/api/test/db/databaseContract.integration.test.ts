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
    // Exclusive Postgres/libSQL surface must stay off CompatibleDb. Intersection of native
    // overloads is not enough by itself; this Extract check fails compilation if any of these
    // keys ever become part of the shared contract.
    type ForbiddenCompatibleKeys =
      | '$with'
      | '$count'
      | '$cache'
      | 'all'
      | 'run'
      | 'execute'
      | 'session'
      | 'refreshMaterializedView';
    const excludesDriverSpecificKeys: Extract<
      keyof typeof db,
      ForbiddenCompatibleKeys
    > extends never
      ? true
      : false = true;

    expect(excludesDriverSpecificKeys).toBe(true);
  });

  it('exposes only the shared query surface used by application services', () => {
    type RequiredCompatibleKeys =
      | 'select'
      | 'selectDistinct'
      | 'insert'
      | 'update'
      | 'delete'
      | 'query'
      | 'transaction';
    const hasRequiredKeys: RequiredCompatibleKeys extends keyof typeof db ? true : false = true;

    expect(hasRequiredKeys).toBe(true);
    expect(typeof db.select).toBe('function');
    expect(typeof db.selectDistinct).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.update).toBe('function');
    expect(typeof db.delete).toBe('function');
    expect(typeof db.transaction).toBe('function');
    expect(db.query).toBeTruthy();
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

  it('supports distinct selections through the shared builder surface', async () => {
    await db.insert(users).values([
      {
        id: 'distinct-user-1',
        username: 'distinct-user-1',
        tag: 'distinct-user-1',
        password: 'secret',
        isAdmin: false,
      },
      {
        id: 'distinct-user-2',
        username: 'distinct-user-2',
        tag: 'distinct-user-2',
        password: 'secret',
        isAdmin: false,
      },
    ]);

    const rows = await db.selectDistinct({ isAdmin: users.isAdmin }).from(users);
    expect(rows).toContainEqual({ isAdmin: false });
    expect(rows.filter(({ isAdmin }) => isAdmin === false)).toHaveLength(1);
  });
});

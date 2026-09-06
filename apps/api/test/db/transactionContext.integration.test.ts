import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db, withTransaction } from '../../src/db';
import { users } from '../../src/db/schema';
import { truncateAll } from '../helpers/database';

afterEach(async () => {
  await truncateAll();
});

describe('withTransaction', () => {
  it('joins an active transaction so an outer rollback also reverts nested work', async () => {
    await expect(
      withTransaction(async () => {
        await db.insert(users).values({
          id: 'outer-user',
          username: 'outer-user',
          tag: 'outer-user',
          password: 'secret',
        });

        await withTransaction(async () => {
          await db.insert(users).values({
            id: 'inner-user',
            username: 'inner-user',
            tag: 'inner-user',
            password: 'secret',
          });
        });

        throw new Error('abort outer transaction');
      }),
    ).rejects.toThrow('abort outer transaction');

    expect(await db.query.users.findFirst({ where: eq(users.id, 'outer-user') })).toBeUndefined();
    expect(await db.query.users.findFirst({ where: eq(users.id, 'inner-user') })).toBeUndefined();
  });
});

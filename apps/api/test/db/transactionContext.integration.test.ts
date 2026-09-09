import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { db, withTransaction, withWriteTransaction } from '../../src/db';
import { users } from '../../src/db/schema';
import { truncateAll } from '../helpers/database';

afterEach(async () => {
  await truncateAll();
});

describe('withTransaction', () => {
  it('joins an active transaction so an outer rollback also reverts nested work', async () => {
    await expect(
      withTransaction(async (tx) => {
        await tx.insert(users).values({
          id: 'outer-user',
          username: 'outer-user',
          tag: 'outer-user',
          password: 'secret',
        });

        await withTransaction(async (nestedTx) => {
          expect(nestedTx).toBe(tx);
          await nestedTx.insert(users).values({
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

  it('keeps an explicit nested tx.transaction as a savepoint', async () => {
    await withTransaction(async (tx) => {
      await tx.insert(users).values({
        id: 'outer-user',
        username: 'outer-user',
        tag: 'outer-user',
        password: 'secret',
      });

      await expect(
        tx.transaction(async (savepoint) => {
          await savepoint.insert(users).values({
            id: 'savepoint-user',
            username: 'savepoint-user',
            tag: 'savepoint-user',
            password: 'secret',
          });
          throw new Error('abort savepoint');
        }),
      ).rejects.toThrow('abort savepoint');
    });

    expect(await db.query.users.findFirst({ where: eq(users.id, 'outer-user') })).toBeDefined();
    expect(
      await db.query.users.findFirst({ where: eq(users.id, 'savepoint-user') }),
    ).toBeUndefined();
  });

  it('rolls back a semantic write transaction on either driver', async () => {
    await expect(
      withWriteTransaction(async (tx) => {
        await tx.insert(users).values({
          id: 'write-user',
          username: 'write-user',
          tag: 'write-user',
          password: 'secret',
        });
        expect(await tx.query.users.findFirst({ where: eq(users.id, 'write-user') })).toBeDefined();
        throw new Error('abort write transaction');
      }),
    ).rejects.toThrow('abort write transaction');

    expect(await db.query.users.findFirst({ where: eq(users.id, 'write-user') })).toBeUndefined();
  });

  it('joins a semantic write transaction to an active transaction', async () => {
    await expect(
      withTransaction(async (outerTx) => {
        await withWriteTransaction(async (writeTx) => {
          expect(writeTx).toBe(outerTx);
          await writeTx.insert(users).values({
            id: 'joined-write-user',
            username: 'joined-write-user',
            tag: 'joined-write-user',
            password: 'secret',
          });
        });
        throw new Error('abort joined transaction');
      }),
    ).rejects.toThrow('abort joined transaction');

    expect(
      await db.query.users.findFirst({ where: eq(users.id, 'joined-write-user') }),
    ).toBeUndefined();
  });
});

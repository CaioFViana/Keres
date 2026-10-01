import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { users } from '../../src/db/schema/tables/users';
import { normalizeStoredUserTags } from '../../src/services/UserTagMaintenance';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

beforeEach(truncateAll);

const seed = async (rows: { username: string; tag: string; at: number }[]) => {
  const made: Record<string, string> = {};
  for (const row of rows) {
    const id = newId();
    made[row.username] = id;
    await db.insert(users).values({
      id,
      username: row.username,
      tag: row.tag,
      password: 'x',
      createdAt: new Date(row.at),
    } as never);
  }
  return made;
};
const tagOf = async (username: string) =>
  (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.username, username) }))?.tag;

describe('normalizeStoredUserTags', () => {
  it('rewrites the tags that were seeded with the username as typed', async () => {
    await seed([
      { username: 'Maria Souza', tag: 'Maria Souza', at: 1 },
      { username: 'João', tag: 'JOÃO!', at: 2 },
      { username: 'ab', tag: 'ab', at: 3 },
      { username: 'verbose', tag: 'x'.repeat(30), at: 4 },
    ]);

    const rewritten = await normalizeStoredUserTags();

    expect(rewritten).toBe(4);
    expect(await tagOf('Maria Souza')).toBe('maria_souza');
    expect(await tagOf('João')).toBe('joao');
    expect(await tagOf('ab')).toMatch(/^ab[a-z0-9]{4}$/);
    // Too long to be a tag, so made again from the username - which is free.
    expect(await tagOf('verbose')).toBe('verbose');
  });

  it('leaves alone what is already a tag, and is a no-op the second time', async () => {
    await seed([
      { username: 'ana', tag: 'ana', at: 1 },
      { username: 'bia', tag: 'bia_2', at: 2 },
    ]);

    expect(await normalizeStoredUserTags()).toBe(0);
    expect(await tagOf('ana')).toBe('ana');
    expect(await tagOf('bia')).toBe('bia_2');

    await seed([{ username: 'Carla Dias', tag: 'Carla Dias', at: 3 }]);
    expect(await normalizeStoredUserTags()).toBe(1);
    expect(await normalizeStoredUserTags()).toBe(0);
  });

  it('never moves the account that got there first when a rewrite clashes with a tag in use', async () => {
    await seed([
      { username: 'first', tag: 'ana_maria', at: 1 },
      { username: 'second', tag: 'Ana Maria', at: 2 },
    ]);

    await normalizeStoredUserTags();

    expect(await tagOf('first')).toBe('ana_maria');
    expect(await tagOf('second')).toMatch(/^ana_maria[a-z0-9]{4}$/);
    expect((await tagOf('second'))!.length).toBeLessThanOrEqual(20);
  });

  it('settles two accounts that rewrite to the same tag, the older one keeping it', async () => {
    await seed([
      { username: 'older', tag: 'Ana Maria', at: 1 },
      { username: 'newer', tag: 'ana-maria', at: 2 },
    ]);

    await normalizeStoredUserTags();

    expect(await tagOf('older')).toBe('ana_maria');
    expect(await tagOf('newer')).not.toBe('ana_maria');
    expect(await tagOf('newer')).toMatch(/^ana_maria[a-z0-9]{4}$/);
  });
});

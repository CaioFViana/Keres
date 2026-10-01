import {
  deriveUserTag,
  normalizeUserTag,
  USER_TAG_MAX_LENGTH,
  USER_TAG_MIN_LENGTH,
} from '@keres/shared';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema/tables/users';
import { logger } from '../utils/logger';

const isStoredShape = (tag: string): boolean =>
  tag === normalizeUserTag(tag) &&
  tag.length >= USER_TAG_MIN_LENGTH &&
  tag.length <= USER_TAG_MAX_LENGTH;

/**
 * Brings the tags already stored to the shape every new one has: lowercase letters, digits and
 * underscores, 3 to 20. Accounts made before that rule were seeded with their username as typed -
 * spaces, capitals, symbols, any length - and a tag with a space in it cannot be written after an "@".
 *
 * Only tags that are not in that shape are touched. One becomes its own slug when that is a valid tag
 * nobody else holds; otherwise one made from the username, with the account id's tail on the end when
 * the plain one is taken. The oldest accounts are visited first, so a clash never moves the one that
 * got there first. Safe to run at every boot: once everything is in shape it reads and changes nothing.
 *
 * @returns how many tags were rewritten.
 */
export async function normalizeStoredUserTags(): Promise<number> {
  const rows = await db
    .select({ id: users.id, username: users.username, tag: users.tag })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.id));

  const offenders = rows.filter((row) => !isStoredShape(row.tag));
  if (offenders.length === 0) return 0;

  // Every tag in use, as the unique index compares them. Offenders leave it as they are rewritten.
  const held = new Map(rows.map((row) => [row.tag.toLowerCase(), row.id]));
  const isFreeFor = (tag: string, id: string) => {
    const holder = held.get(tag);
    return holder === undefined || holder === id;
  };

  let rewritten = 0;
  for (const row of offenders) {
    held.delete(row.tag.toLowerCase());
    const own = normalizeUserTag(row.tag);
    const plain =
      own.length >= USER_TAG_MIN_LENGTH && own.length <= USER_TAG_MAX_LENGTH
        ? own
        : deriveUserTag(row.username, row.id);
    const next = isFreeFor(plain, row.id)
      ? plain
      : deriveUserTag(plain || row.username, row.id, { suffixed: true });

    await db.update(users).set({ tag: next }).where(eq(users.id, row.id));
    held.set(next, row.id);
    rewritten += 1;
    logger.info(`Tag of user ${row.id} normalized: '${row.tag}' -> '${next}'.`);
  }
  return rewritten;
}

import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { operationLog, stories, users } from '../../src/db/schema';
import { getChangedFieldsSinceVersion } from '../../src/services/sync/SyncConflictDetails';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;

const logRow = (
  entityId: string,
  operationVersion: number,
  entityVersion: number | null,
  payload: Record<string, unknown>,
) => ({
  id: newId(),
  storyId,
  userId,
  operationVersion,
  operationType: 'update' as const,
  entityType: 'Character',
  entityId,
  payload,
  entityVersion,
  createdAt: new Date(),
});

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

describe('getChangedFieldsSinceVersion', () => {
  it('returns only content fields newer than the base, skipping bookkeeping keys', async () => {
    const entityId = newId();
    await db
      .insert(operationLog)
      .values([
        logRow(entityId, 1, 1, { name: 'Antigo' }),
        logRow(entityId, 2, 2, { name: 'Novo', version: 3 }),
        logRow(entityId, 3, 3, { title: 'Deusa' }),
      ]);

    const fields = await getChangedFieldsSinceVersion(storyId, 'Character', entityId, 1);

    expect(fields?.sort()).toEqual(['name', 'title']);
  });

  it('returns an empty list when nothing changed after the base', async () => {
    const entityId = newId();
    await db.insert(operationLog).values([logRow(entityId, 1, 1, { name: 'Antigo' })]);

    await expect(getChangedFieldsSinceVersion(storyId, 'Character', entityId, 1)).resolves.toEqual(
      [],
    );
  });
});

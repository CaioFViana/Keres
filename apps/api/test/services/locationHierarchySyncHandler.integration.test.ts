import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { LocationRelationSyncHandler } from '../../src/services/entity-sync-handlers/LocationRelationSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let olympusId: string;
let palaceId: string;
let hallId: string;

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  olympusId = newId();
  palaceId = newId();
  hallId = newId();
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
  const locations = new LocationSyncHandler();
  for (const [id, name] of [
    [olympusId, 'Olimpo'],
    [palaceId, 'Palácio'],
    [hallId, 'Salão'],
  ] as const) {
    await locations.create(
      userId,
      storyId,
      create('Location', id, {
        name,
        description: null,
        climate: null,
        culture: null,
        politics: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
  }
});

describe('location hierarchy sync handler', () => {
  it('keeps contains relations directed, single-parent, and acyclic', async () => {
    const handler = new LocationRelationSyncHandler();
    const olympusContainsPalace = newId();
    const palaceContainsHall = newId();
    await handler.create(
      userId,
      storyId,
      create('LocationRelation', olympusContainsPalace, {
        locationAId: olympusId,
        locationBId: palaceId,
        relationType: 'contains',
      }),
    );
    await handler.create(
      userId,
      storyId,
      create('LocationRelation', palaceContainsHall, {
        locationAId: palaceId,
        locationBId: hallId,
        relationType: 'contains',
      }),
    );
    expect(await handler.findById(palaceContainsHall)).toMatchObject({
      locationAId: palaceId,
      locationBId: hallId,
      relationType: 'contains',
    });

    await expect(
      handler.create(
        userId,
        storyId,
        create('LocationRelation', newId(), {
          locationAId: hallId,
          locationBId: olympusId,
          relationType: 'contains',
        }),
      ),
    ).rejects.toThrow(/cycle/i);
    await expect(
      handler.create(
        userId,
        storyId,
        create('LocationRelation', newId(), {
          locationAId: olympusId,
          locationBId: hallId,
          relationType: 'contains',
        }),
      ),
    ).rejects.toThrow(/already has a parent/i);
  });

  it('normalizes connected locations during an update', async () => {
    const handler = new LocationRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      storyId,
      create('LocationRelation', id, {
        locationAId: olympusId,
        locationBId: palaceId,
        relationType: 'contains',
      }),
    );
    const current = await handler.findById(id);
    await handler.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'LocationRelation',
        id,
        changes: {
          locationAId: hallId,
          locationBId: olympusId,
          relationType: 'connected_to',
          version: 1,
        },
      } as UpdateStoryUpdate,
      current,
    );
    const updated = await handler.findById(id);
    expect(updated).toMatchObject({
      relationType: 'connected_to',
      locationAId: [hallId, olympusId].sort()[0],
      locationBId: [hallId, olympusId].sort()[1],
      version: 2,
    });
  });
});

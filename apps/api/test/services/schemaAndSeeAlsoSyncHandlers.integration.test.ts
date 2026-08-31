import { beforeEach, describe, expect, it } from 'vitest';
import {
  AttributeType,
  type CreateStoryUpdate,
  type DeleteStoryUpdate,
  type UpdateStoryUpdate,
} from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { AttributeValueSyncHandler } from '../../src/services/entity-sync-handlers/AttributeValueSyncHandler';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { SeeAlsoRelationSyncHandler } from '../../src/services/entity-sync-handlers/SeeAlsoRelationSyncHandler';
import { StorySchemaFieldSyncHandler } from '../../src/services/entity-sync-handlers/StorySchemaFieldSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let characterId: string;
let locationId: string;

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;
const remove = (entity: string, id: string, version: number) =>
  ({ type: 'delete', entity, id, version }) as DeleteStoryUpdate;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  characterId = newId();
  locationId = newId();
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
  await new CharacterSyncHandler().create(
    userId,
    storyId,
    create('Character', characterId, { name: 'Keres' }),
  );
  await new LocationSyncHandler().create(
    userId,
    storyId,
    create('Location', locationId, {
      name: 'Olímpo',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );
});

describe('schema and see-also sync entity handlers', () => {
  it('stores a custom field and its character value, preserving immutable field identity', async () => {
    const fields = new StorySchemaFieldSyncHandler();
    const values = new AttributeValueSyncHandler();
    const fieldId = newId();
    const valueId = newId();
    await fields.create(
      userId,
      storyId,
      create('StorySchemaField', fieldId, {
        entityType: 'Character',
        name: 'Origem',
        key: 'origem',
        description: null,
        type: 'text',
        isRequired: false,
        defaultValue: null,
        order: 0,
      }),
    );
    await values.create(
      userId,
      storyId,
      create('AttributeValue', valueId, {
        entityType: 'Character',
        entityId: characterId,
        fieldId,
        value: 'Submundo',
      }),
    );

    const field = await fields.findById(fieldId);
    await fields.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'StorySchemaField',
        id: fieldId,
        changes: { name: 'Origem divina', key: 'ignorado', version: 1 },
      } as UpdateStoryUpdate,
      field,
    );
    const value = await values.findById(valueId);
    await values.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'AttributeValue',
        id: valueId,
        changes: { value: 'Olimpo', version: 1 },
      } as UpdateStoryUpdate,
      value,
    );
    expect(await fields.findById(fieldId)).toMatchObject({
      name: 'Origem divina',
      key: 'origem',
      version: 2,
    });
    expect(await values.findById(valueId)).toMatchObject({ value: 'Olimpo', version: 2 });

    const updatedValue = await values.findById(valueId);
    const updatedField = await fields.findById(fieldId);
    await values.delete(userId, storyId, remove('AttributeValue', valueId, 2), updatedValue);
    await fields.delete(userId, storyId, remove('StorySchemaField', fieldId, 2), updatedField);
    expect(await values.findById(valueId)).toMatchObject({ isDeleted: true });
    expect(await fields.findById(fieldId)).toMatchObject({
      isDeleted: true,
      key: expect.stringContaining('__deleted_'),
    });
  });

  it('stores an entity field target and keeps its type and target immutable', async () => {
    const fields = new StorySchemaFieldSyncHandler();
    const fieldId = newId();
    await fields.create(
      userId,
      storyId,
      create('StorySchemaField', fieldId, {
        entityType: 'Character',
        name: 'Lar',
        key: 'lar',
        description: null,
        type: AttributeType.ENTITY,
        targetEntityType: 'Location',
        isRequired: false,
        defaultValue: null,
        order: 0,
      }),
    );

    const field = await fields.findById(fieldId);
    await fields.update(
      userId,
      storyId,
      {
        type: 'update',
        entity: 'StorySchemaField',
        id: fieldId,
        changes: {
          name: 'Lar atual',
          type: AttributeType.TEXT,
          targetEntityType: 'Character',
          version: 1,
        },
      } as UpdateStoryUpdate,
      field,
    );

    expect(await fields.findById(fieldId)).toMatchObject({
      name: 'Lar atual',
      type: AttributeType.ENTITY,
      targetEntityType: 'Location',
    });
  });

  it('normalizes and tombstones a see-also link between valid story entities', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      storyId,
      create('SeeAlsoRelation', id, {
        entityAType: 'Location',
        entityAId: locationId,
        entityBType: 'Character',
        entityBId: characterId,
      }),
    );
    const created = await handler.findById(id);

    expect(created).toMatchObject({ storyId, version: 1, isDeleted: false });
    expect([
      `${created.entityAType}:${created.entityAId}`,
      `${created.entityBType}:${created.entityBId}`,
    ]).toEqual([`Character:${characterId}`, `Location:${locationId}`].sort());
    await handler.delete(userId, storyId, remove('SeeAlsoRelation', id, 1), created);
    expect(await handler.findById(id)).toMatchObject({ isDeleted: true, version: 2 });
  });

  it('rejects self-links, duplicate links in reverse order, and attempts to retarget an existing link', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    const relationId = newId();

    await expect(
      handler.create(
        userId,
        storyId,
        create('SeeAlsoRelation', newId(), {
          entityAType: 'Character',
          entityAId: characterId,
          entityBType: 'Character',
          entityBId: characterId,
        }),
      ),
    ).rejects.toThrow(/itself/i);

    await handler.create(
      userId,
      storyId,
      create('SeeAlsoRelation', relationId, {
        entityAType: 'Character',
        entityAId: characterId,
        entityBType: 'Location',
        entityBId: locationId,
      }),
    );
    await expect(
      handler.create(
        userId,
        storyId,
        create('SeeAlsoRelation', newId(), {
          entityAType: 'Location',
          entityAId: locationId,
          entityBType: 'Character',
          entityBId: characterId,
        }),
      ),
    ).rejects.toThrow(/already exists/i);

    await expect(
      handler.update(
        userId,
        storyId,
        {
          type: 'update',
          entity: 'SeeAlsoRelation',
          id: relationId,
          changes: { entityAId: locationId, version: 1 },
        } as UpdateStoryUpdate,
        await handler.findById(relationId),
      ),
    ).rejects.toThrow(/cannot change the linked entities/i);
  });
});

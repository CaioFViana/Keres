import { beforeEach, describe, expect, it } from 'vitest';
import {
  AttributeType,
  type CreateStoryUpdate,
  type DeleteStoryUpdate,
  type UpdateStoryUpdate,
} from '@keres/shared';
import { db } from '../../src/db';
import {
  chapters,
  choices,
  itemJourneys,
  items,
  scenes,
  stories,
  users,
  worldRules,
} from '../../src/db/schema';
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

    const field = await fields.findByIdOrThrow(fieldId);
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
    const value = await values.findByIdOrThrow(valueId);
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
    expect(await fields.findByIdOrThrow(fieldId)).toMatchObject({
      name: 'Origem divina',
      key: 'origem',
      version: 2,
    });
    expect(await values.findByIdOrThrow(valueId)).toMatchObject({ value: 'Olimpo', version: 2 });

    const updatedValue = await values.findByIdOrThrow(valueId);
    const updatedField = await fields.findByIdOrThrow(fieldId);
    await values.delete(userId, storyId, remove('AttributeValue', valueId, 2), updatedValue);
    await fields.delete(userId, storyId, remove('StorySchemaField', fieldId, 2), updatedField);
    expect(await values.findByIdOrThrow(valueId)).toMatchObject({ isDeleted: true });
    // The key stays: uniqueness holds among live fields only, so the tombstone blocks nothing.
    expect(await fields.findByIdOrThrow(fieldId)).toMatchObject({ isDeleted: true, key: 'origem' });
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

    const field = await fields.findByIdOrThrow(fieldId);
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

    expect(await fields.findByIdOrThrow(fieldId)).toMatchObject({
      name: 'Lar atual',
      type: AttributeType.ENTITY,
      targetEntityType: 'Location',
    });
  });

  // NOTE: an ENTITY field without targetEntityType is rejected by the schema's own
  // superRefine at parse time (see the shared CreateStorySchemaFieldDataSchema tests), so the
  // handler-level throw below it is unreachable defense-in-depth, not a testable branch.

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
    const created = await handler.findByIdOrThrow(id);

    expect(created).toMatchObject({ storyId, version: 1, isDeleted: false });
    expect([
      `${created.entityAType}:${created.entityAId}`,
      `${created.entityBType}:${created.entityBId}`,
    ]).toEqual([`Character:${characterId}`, `Location:${locationId}`].sort());
    await handler.delete(userId, storyId, remove('SeeAlsoRelation', id, 1), created);
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true, version: 2 });
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
        await handler.findByIdOrThrow(relationId),
      ),
    ).rejects.toThrow(/cannot change the linked entities/i);
  });

  it('rejects missing endpoints and does not allow a tombstoned endpoint to be linked', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    await expect(
      handler.create(
        userId,
        storyId,
        create('SeeAlsoRelation', newId(), {
          entityAType: 'Character',
          entityAId: characterId,
          entityBType: 'Location',
          entityBId: newId(),
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });

    const locations = new LocationSyncHandler();
    const current = await locations.findByIdOrThrow(locationId);
    await locations.delete(
      userId,
      storyId,
      remove('Location', locationId, current.version),
      current,
    );
    await expect(
      handler.create(
        userId,
        storyId,
        create('SeeAlsoRelation', newId(), {
          entityAType: 'Character',
          entityAId: characterId,
          entityBType: 'Location',
          entityBId: locationId,
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('accepts every remaining supported entity kind from the same active story', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    const chapterId = newId();
    const sceneId = newId();
    const itemId = newId();
    const journeyId = newId();
    const ruleId = newId();
    const choiceId = newId();
    await db
      .insert(chapters)
      .values({ id: chapterId, storyId, name: 'Capítulo', index: 1 } as never);
    await db
      .insert(scenes)
      .values({ id: sceneId, storyId, chapterId, name: 'Cena', index: 1 } as never);
    await db.insert(items).values({ id: itemId, storyId, name: 'Chave' } as never);
    await db.insert(itemJourneys).values({
      id: journeyId,
      storyId,
      itemId,
      sceneId,
      newState: 'encontrada',
    } as never);
    await db.insert(worldRules).values({ id: ruleId, storyId, title: 'Regra' } as never);
    await db.insert(choices).values({
      id: choiceId,
      storyId,
      sceneId,
      nextSceneId: sceneId,
      text: 'Seguir',
    } as never);

    for (const [type, id] of [
      ['Chapter', chapterId],
      ['Scene', sceneId],
      ['Item', itemId],
      ['ItemJourney', journeyId],
      ['WorldRule', ruleId],
      ['Choice', choiceId],
    ] as const) {
      await handler.create(
        userId,
        storyId,
        create('SeeAlsoRelation', newId(), {
          entityAType: 'Character',
          entityAId: characterId,
          entityBType: type,
          entityBId: id,
        }),
      );
    }
  });
});

describe('story-scoped polymorphic references', () => {
  async function seedOtherStory() {
    const otherStoryId = newId();
    const now = new Date();
    await db.insert(stories).values({
      id: otherStoryId,
      userId,
      title: 'Outra',
      type: 'linear',
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    } as never);
    const otherCharacterId = newId();
    await new CharacterSyncHandler().create(
      userId,
      otherStoryId,
      create('Character', otherCharacterId, { name: 'Nyx' }),
    );
    const otherFieldId = newId();
    await new StorySchemaFieldSyncHandler().create(
      userId,
      otherStoryId,
      create('StorySchemaField', otherFieldId, {
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
    return { otherStoryId, otherCharacterId, otherFieldId };
  }

  async function seedField(entityType = 'Character') {
    const fieldId = newId();
    await new StorySchemaFieldSyncHandler().create(
      userId,
      storyId,
      create('StorySchemaField', fieldId, {
        entityType,
        name: 'Origem',
        key: `origem_${entityType.toLowerCase()}`,
        description: null,
        type: 'text',
        isRequired: false,
        defaultValue: null,
        order: 0,
      }),
    );
    return fieldId;
  }

  it("refuses a value on another story's field or entity, or a field of another entity type", async () => {
    const values = new AttributeValueSyncHandler();
    const { otherCharacterId, otherFieldId } = await seedOtherStory();
    const ownField = await seedField();
    const locationField = await seedField('Location');
    const value = (entityId: string, fieldId: string) =>
      create('AttributeValue', newId(), {
        entityType: 'Character',
        entityId,
        fieldId,
        value: 'x',
      });

    await expect(
      values.create(userId, storyId, value(characterId, otherFieldId)),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      values.create(userId, storyId, value(otherCharacterId, ownField)),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      values.create(userId, storyId, value(characterId, locationField)),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('never repoints a value to another entity or field, neither in the row nor in the log', async () => {
    const values = new AttributeValueSyncHandler();
    const fieldId = await seedField();
    const valueId = newId();
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
    const repoint = {
      type: 'update',
      entity: 'AttributeValue',
      id: valueId,
      changes: { value: 'Olimpo', entityId: locationId, fieldId: newId(), version: 1 },
    } as UpdateStoryUpdate;

    await values.update(userId, storyId, repoint, await values.findByIdOrThrow(valueId));

    expect(await values.findByIdOrThrow(valueId)).toMatchObject({
      entityId: characterId,
      fieldId,
      value: 'Olimpo',
    });
    expect(values.sanitizePayloadForLog(repoint, userId)).toEqual({ value: 'Olimpo' });
  });
});

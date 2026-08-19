/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { createAttributeValueService } from '../../src/services/storymanagement/AttributeValueService';
import { createCharacterRelationService } from '../../src/services/storymanagement/CharacterRelationService';
import { createGalleryRelationService } from '../../src/services/storymanagement/GalleryRelationService';
import { createLocationRelationService } from '../../src/services/storymanagement/LocationRelationService';
import { createNoteRelationService } from '../../src/services/storymanagement/NoteRelationService';
import { createSeeAlsoRelationService } from '../../src/services/storymanagement/SeeAlsoRelationService';
import { createStorySchemaFieldService } from '../../src/services/storymanagement/StorySchemaFieldService';
import { createSuggestionService } from '../../src/services/storymanagement/SuggestionService';
import { createTagRelationService } from '../../src/services/storymanagement/TagRelationService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = 'story-1';
const USER_ID = 'local-user';
const NOW = new Date('2026-08-14T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;

async function seedStory() {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: USER_ID,
    title: 'A Queda',
    type: 'linear',
    ...base,
  });
}

beforeEach(async () => {
  database = await createTestDatabase();
  await seedStory();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('AttributeValueService', () => {
  it('creates, updates and counts only live non-empty values', async () => {
    const service = createAttributeValueService(database.db);

    await service.saveValuesForEntity(USER_ID, STORY_ID, 'Character', 'char-1', {
      rank: '7',
      empty: '',
    });
    await service.saveValuesForEntity(USER_ID, STORY_ID, 'Character', 'char-1', { rank: '8' });
    await database.db.insert(schema.attributeValues).values({
      id: 'other-rank',
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: 'char-2',
      fieldId: 'rank',
      value: '8',
      ...base,
    });

    expect(await service.getValuesForEntity('char-1')).toEqual([
      expect.objectContaining({ fieldId: 'rank', value: '8', version: 2 }),
    ]);
    expect(await service.getValueUsageCounts('rank')).toEqual([['8', 2]]);
  });

  it('does not create a row or an operation for a wholly empty submission', async () => {
    const service = createAttributeValueService(database.db);

    await service.saveValuesForEntity(USER_ID, STORY_ID, 'Character', 'char-1', { rank: null });

    expect(await service.getValuesForEntity('char-1')).toEqual([]);
    expect(await database.db.select().from(schema.operationLogs).all()).toEqual([]);
  });
});

describe('SuggestionService', () => {
  it('merges stored and live native values, then keeps a unique normalized stored suggestion', async () => {
    const service = createSuggestionService(database.db);
    await database.db.insert(schema.characters).values({
      id: 'char-1',
      storyId: STORY_ID,
      name: 'Ada',
      gender: 'Feminino',
      ...base,
    });

    const created = await service.createSuggestion(
      USER_ID,
      'character_gender',
      '  Neutro  ',
      STORY_ID,
    );

    expect(await service.getSuggestions('character_gender', STORY_ID)).toEqual([
      ['Feminino', 1],
      ['Neutro', 0],
    ]);
    await expect(
      service.createSuggestion(USER_ID, 'character_gender', 'Neutro', STORY_ID),
    ).rejects.toThrow('already exists');

    await service.updateSuggestion(USER_ID, created.id, 'Outro');
    await service.deleteSuggestion(USER_ID, created.id);
    expect(await service.getStoredSuggestions('character_gender', STORY_ID)).toEqual([]);
  });

  it('uses attribute values as dynamic suggestions for custom fields', async () => {
    const service = createSuggestionService(database.db);
    await database.db.insert(schema.attributeValues).values([
      {
        id: 'value-1',
        storyId: STORY_ID,
        entityType: 'Character',
        entityId: 'char-1',
        fieldId: 'origin',
        value: 'Lua',
        ...base,
      },
      {
        id: 'value-2',
        storyId: STORY_ID,
        entityType: 'Character',
        entityId: 'char-2',
        fieldId: 'origin',
        value: 'Lua',
        ...base,
      },
    ]);

    expect(await service.getSuggestions('custom:origin', STORY_ID)).toEqual([['Lua', 2]]);
  });
});

describe('StorySchemaFieldService', () => {
  it('orders live fields, rejects duplicate keys, and cascades a soft delete to their values', async () => {
    const service = createStorySchemaFieldService(database.db);
    const later = await service.createField(USER_ID, {
      storyId: STORY_ID,
      entityType: 'Character',
      name: 'Rank',
      key: 'rank',
      description: null,
      type: AttributeType.NUMBER,
      targetEntityType: null,
      isRequired: false,
      defaultValue: null,
      order: 2,
    });
    const first = await service.createField(USER_ID, {
      storyId: STORY_ID,
      entityType: 'Character',
      name: 'Origin',
      key: 'origin',
      description: null,
      type: AttributeType.TEXT,
      targetEntityType: null,
      isRequired: false,
      defaultValue: null,
      order: 1,
    });
    await database.db.insert(schema.attributeValues).values({
      id: 'rank-value',
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: 'char-1',
      fieldId: later.id,
      value: '7',
      ...base,
    });

    expect(
      (await service.getFieldsByStoryAndEntityType(STORY_ID, 'Character')).map((f) => f.id),
    ).toEqual([first.id, later.id]);
    await expect(
      service.createField(USER_ID, {
        storyId: STORY_ID,
        entityType: 'Character',
        name: 'Outro rank',
        key: 'rank',
        description: null,
        type: AttributeType.TEXT,
        targetEntityType: null,
        isRequired: false,
        defaultValue: null,
        order: 3,
      }),
    ).rejects.toThrow('already exists');

    await service.deleteField(USER_ID, later.id);
    expect(await service.getById(later.id)).toBeUndefined();
    expect(
      (
        await database.db.query.attributeValues.findFirst({
          where: (values, { eq }) => eq(values.id, 'rank-value'),
        })
      )?.isDeleted,
    ).toBe(true);
  });

  it('reorders only fields of the selected entity type in one sync operation', async () => {
    const service = createStorySchemaFieldService(database.db);
    const first = await service.createField(USER_ID, {
      storyId: STORY_ID,
      entityType: 'Character',
      name: 'First',
      key: 'first',
      description: null,
      type: AttributeType.TEXT,
      targetEntityType: null,
      isRequired: false,
      defaultValue: null,
      order: 0,
    });
    const second = await service.createField(USER_ID, {
      storyId: STORY_ID,
      entityType: 'Character',
      name: 'Second',
      key: 'second',
      description: null,
      type: AttributeType.TEXT,
      targetEntityType: null,
      isRequired: false,
      defaultValue: null,
      order: 1,
    });
    const locationField = await service.createField(USER_ID, {
      storyId: STORY_ID,
      entityType: 'Location',
      name: 'Region',
      key: 'region',
      description: null,
      type: AttributeType.TEXT,
      targetEntityType: null,
      isRequired: false,
      defaultValue: null,
      order: 0,
    });

    await service.reorderFields(USER_ID, STORY_ID, 'Character', [
      { id: second.id, order: 0 },
      { id: first.id, order: 1 },
    ]);

    expect(
      (await service.getFieldsByStoryAndEntityType(STORY_ID, 'Character')).map(({ id, order }) => ({
        id,
        order,
      })),
    ).toEqual([
      { id: second.id, order: 0 },
      { id: first.id, order: 1 },
    ]);
    expect((await service.getById(locationField.id))?.order).toBe(0);

    const operations = await database.db.select().from(schema.operationLogs).all();
    const reorders = operations.filter(
      (operation) => operation.entityType === 'Story' && operation.operationType === 'reorder',
    );
    expect(reorders).toHaveLength(1);
    expect(JSON.parse(reorders[0]!.payload)).toMatchObject({
      reorderTarget: 'StorySchemaField',
      schemaEntityType: 'Character',
      reorderItems: [
        { id: second.id, newIndex: 1 },
        { id: first.id, newIndex: 2 },
      ],
    });
  });
});

describe('SeeAlsoRelationService', () => {
  it('canonicalizes duplicate links and reconciles targets by adding and removing only the delta', async () => {
    const service = createSeeAlsoRelationService(database.db);
    const ada = { entityType: 'Character' as const, entityId: 'ada' };
    const atlas = { entityType: 'Location' as const, entityId: 'atlas' };
    const sword = { entityType: 'Item' as const, entityId: 'sword' };

    const relation = await service.addSeeAlsoLink(USER_ID, STORY_ID, atlas, ada);
    const duplicate = await service.addSeeAlsoLink(USER_ID, STORY_ID, ada, atlas);
    expect(duplicate.id).toBe(relation.id);

    await service.setSeeAlsoTargets(USER_ID, STORY_ID, 'Character', 'ada', [sword]);
    expect(await service.getRelationsForEntity(STORY_ID, 'Character', 'ada')).toEqual([
      expect.objectContaining({ entityAId: 'ada', entityBId: 'sword', isDeleted: false }),
    ]);
    await expect(service.addSeeAlsoLink(USER_ID, STORY_ID, ada, ada)).rejects.toThrow('cannot be');
  });
});

describe('GalleryRelationService', () => {
  it('creates a link once, soft-deletes it, then revives the same relation on relink', async () => {
    const service = createGalleryRelationService(database.db);
    const owner = { ownerType: 'Character' as const, ownerId: 'char-1' };

    await service.linkGalleryToOwner(USER_ID, STORY_ID, 'gallery-1', owner);
    await service.linkGalleryToOwner(USER_ID, STORY_ID, 'gallery-1', owner);
    const [created] = await service.getRelationsForOwner(STORY_ID, owner.ownerId, owner.ownerType);

    expect(created).toBeDefined();
    await service.unlinkGalleryFromOwner(USER_ID, STORY_ID, 'gallery-1', owner);
    expect(await service.getRelationsForOwner(STORY_ID, owner.ownerId, owner.ownerType)).toEqual(
      [],
    );

    await service.linkGalleryToOwner(USER_ID, STORY_ID, 'gallery-1', owner);
    const [revived] = await service.getRelationsForOwner(STORY_ID, owner.ownerId, owner.ownerType);
    expect(revived).toMatchObject({ id: created.id, version: 3, isDeleted: false });
  });
});

describe('TagRelationService', () => {
  it('reconciles tags for an entity and revives a removed relation instead of duplicating it', async () => {
    const service = createTagRelationService(database.db);
    await database.db.insert(schema.tags).values([
      { id: 'tag-a', storyId: STORY_ID, name: 'A', ...base },
      { id: 'tag-b', storyId: STORY_ID, name: 'B', ...base },
    ]);

    await service.updateTagsForEntity(USER_ID, STORY_ID, 'char-1', 'Character', ['tag-a', 'tag-b']);
    await service.updateTagsForEntity(USER_ID, STORY_ID, 'char-1', 'Character', ['tag-b']);
    await service.addTagToEntity(USER_ID, STORY_ID, 'char-1', 'Character', 'tag-a');

    expect(
      (await service.getTagsForEntity(STORY_ID, 'char-1', 'Character')).map((tag) => tag.id).sort(),
    ).toEqual(['tag-a', 'tag-b']);
    expect(await database.db.select().from(schema.tagRelations).all()).toHaveLength(2);
  });
});

describe('NoteRelationService', () => {
  it('prevents duplicate pairs, tracks a meaningful update, and soft-deletes the relation', async () => {
    const service = createNoteRelationService(database.db);
    const relation = await service.saveNoteRelation(USER_ID, {
      storyId: STORY_ID,
      noteId: 'note-1',
      relationId: 'char-1',
      relationType: 'Character',
    });

    await expect(
      service.saveNoteRelation(USER_ID, {
        storyId: STORY_ID,
        noteId: 'note-1',
        relationId: 'char-1',
        relationType: 'Character',
      }),
    ).rejects.toThrow('already exists');

    const updated = await service.saveNoteRelation(USER_ID, { ...relation, relationId: 'char-2' });
    expect(updated).toMatchObject({ relationId: 'char-2', version: 2 });
    expect(await service.deleteNoteRelation(USER_ID, relation.id)).toBe(true);
    expect(await service.getRelationsForNote(STORY_ID, 'note-1')).toEqual([]);
  });
});

describe('LocationRelationService', () => {
  it('maintains the hierarchy, prevents cycles, and treats connections as undirected', async () => {
    const service = createLocationRelationService(database.db);
    await service.setParent(USER_ID, STORY_ID, 'district', 'city');
    await service.setParent(USER_ID, STORY_ID, 'street', 'district');

    expect(await service.getAncestorIds(STORY_ID, 'street')).toEqual(new Set(['district', 'city']));
    expect(await service.getDescendantIds(STORY_ID, 'city')).toEqual(
      new Set(['district', 'street']),
    );
    await expect(service.setParent(USER_ID, STORY_ID, 'city', 'street')).rejects.toThrow(
      'create a cycle',
    );

    const connection = await service.addConnection(USER_ID, STORY_ID, 'city', 'harbor');
    await expect(service.addConnection(USER_ID, STORY_ID, 'harbor', 'city')).rejects.toThrow(
      'already exists',
    );
    expect(await service.removeRelation(USER_ID, connection.id)).toBe(true);
  });
});

describe('CharacterRelationService', () => {
  it('returns a character relation regardless of which endpoint was requested', async () => {
    await database.db.insert(schema.characterRelations).values([
      {
        id: 'ada-grace',
        storyId: STORY_ID,
        character1Id: 'ada',
        character2Id: 'grace',
        relationType: 'ally',
        ...base,
      },
      {
        id: 'deleted-relation',
        storyId: STORY_ID,
        character1Id: 'ada',
        character2Id: 'lin',
        relationType: 'enemy',
        ...base,
        isDeleted: true,
      },
    ]);

    const service = createCharacterRelationService(database.db);
    expect((await service.getRelationsForCharacter(STORY_ID, 'ada')).map(({ id }) => id)).toEqual([
      'ada-grace',
    ]);
    expect((await service.getRelationsForCharacter(STORY_ID, 'grace')).map(({ id }) => id)).toEqual(
      ['ada-grace'],
    );
    expect(await service.getRelationsForCharacter('', 'ada')).toEqual([]);
  });
});

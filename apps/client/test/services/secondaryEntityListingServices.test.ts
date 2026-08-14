/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { createItemJourneyService } from '../../src/services/storymanagement/ItemJourneyService';
import { createNoteService } from '../../src/services/storymanagement/NoteService';
import { createTagService } from '../../src/services/storymanagement/TagService';
import { createWorldRuleService } from '../../src/services/storymanagement/WorldRuleService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('secondary entity listing services', () => {
  it('filters ChoiceService by scene and safely ignores unsupported advanced criteria', async () => {
    await database.db.insert(schema.choices).values([
      {
        id: 'leave',
        storyId: TEST_STORY_ID,
        sceneId: 'scene-a',
        nextSceneId: 'scene-b',
        text: 'Deixar a cidade',
        ...entityBase,
      },
      {
        id: 'stay',
        storyId: TEST_STORY_ID,
        sceneId: 'scene-c',
        nextSceneId: 'scene-d',
        text: 'Permanecer',
        ...entityBase,
      },
    ]);

    const service = createChoiceService(database.db);
    expect(
      (
        await service.getChoicesByStoryId(
          TEST_STORY_ID,
          undefined,
          undefined,
          undefined,
          undefined,
          { sceneId: 'scene-a', unsupported: 'value' },
        )
      ).map((choice) => choice.id),
    ).toEqual(['leave']);
  });

  it('selects ItemJourneyService records by both item and scene while omitting tombstones', async () => {
    await database.db.insert(schema.items).values({
      id: 'lantern',
      storyId: TEST_STORY_ID,
      name: 'Lanterna',
      ...entityBase,
    });
    await database.db.insert(schema.scenes).values([
      {
        id: 'market',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter',
        locationId: 'city',
        name: 'Mercado',
        index: 1,
        ...entityBase,
      },
      {
        id: 'tower',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter',
        locationId: 'city',
        name: 'Torre',
        index: 2,
        ...entityBase,
      },
    ]);
    await database.db.insert(schema.itemJourneys).values([
      {
        id: 'market-journey',
        storyId: TEST_STORY_ID,
        itemId: 'lantern',
        sceneId: 'market',
        newState: 'found',
        ...entityBase,
      },
      {
        id: 'tower-journey',
        storyId: TEST_STORY_ID,
        itemId: 'lantern',
        sceneId: 'tower',
        newState: 'lost',
        ...entityBase,
      },
      {
        id: 'deleted-journey',
        storyId: TEST_STORY_ID,
        itemId: 'lantern',
        sceneId: 'market',
        newState: 'hidden',
        ...entityBase,
        isDeleted: true,
      },
    ]);

    const service = createItemJourneyService(database.db);
    expect(
      (await service.getItemJourneysBySceneId(TEST_STORY_ID, 'market')).map(({ id }) => id),
    ).toEqual(['market-journey']);
    expect(
      (await service.getItemJourneysByItemId(TEST_STORY_ID, 'lantern')).map(({ id }) => id),
    ).toEqual(['market-journey', 'tower-journey']);
  });

  it('returns NoteService tags once per note and filters by favorite state', async () => {
    await database.db.insert(schema.tags).values([
      { id: 'plot', storyId: TEST_STORY_ID, name: 'Trama', ...entityBase },
      { id: 'secret', storyId: TEST_STORY_ID, name: 'Segredo', ...entityBase },
    ]);
    await database.db.insert(schema.notes).values([
      { id: 'letter', storyId: TEST_STORY_ID, title: 'Carta', isFavorite: true, ...entityBase },
      { id: 'map', storyId: TEST_STORY_ID, title: 'Mapa', isFavorite: false, ...entityBase },
    ]);
    await database.db.insert(schema.tagRelations).values([
      {
        id: 'letter-plot',
        storyId: TEST_STORY_ID,
        tagId: 'plot',
        relationId: 'letter',
        relationType: 'Note',
        ...entityBase,
      },
      {
        id: 'letter-secret',
        storyId: TEST_STORY_ID,
        tagId: 'secret',
        relationId: 'letter',
        relationType: 'Note',
        ...entityBase,
      },
    ]);

    const favorites = await createNoteService(database.db).getNotesByStoryId(
      TEST_STORY_ID,
      undefined,
      undefined,
      undefined,
      undefined,
      'favorite',
    );
    expect(favorites).toHaveLength(1);
    expect(favorites[0].tags.map(({ id }) => id).sort()).toEqual(['plot', 'secret']);
  });

  it('filters WorldRuleService by a relation tag and preserves its joined tags', async () => {
    await database.db.insert(schema.tags).values([
      { id: 'magic', storyId: TEST_STORY_ID, name: 'Magia', ...entityBase },
      { id: 'law', storyId: TEST_STORY_ID, name: 'Lei', ...entityBase },
    ]);
    await database.db.insert(schema.worldRules).values([
      { id: 'mana', storyId: TEST_STORY_ID, title: 'Mana', ...entityBase },
      { id: 'trade', storyId: TEST_STORY_ID, title: 'Comércio', ...entityBase },
    ]);
    await database.db.insert(schema.tagRelations).values([
      {
        id: 'mana-magic',
        storyId: TEST_STORY_ID,
        tagId: 'magic',
        relationId: 'mana',
        relationType: 'WorldRule',
        ...entityBase,
      },
      {
        id: 'mana-law',
        storyId: TEST_STORY_ID,
        tagId: 'law',
        relationId: 'mana',
        relationType: 'WorldRule',
        ...entityBase,
      },
    ]);

    const [rule] = await createWorldRuleService(database.db).getWorldRulesByStoryId(
      TEST_STORY_ID,
      undefined,
      ['magic'],
    );
    expect(rule.id).toBe('mana');
    expect(rule.tags.map(({ id }) => id).sort()).toEqual(['law', 'magic']);
  });

  it('combines TagService active, favorite, color, and case-insensitive name filters', async () => {
    await database.db.insert(schema.tags).values([
      {
        id: 'amber',
        storyId: TEST_STORY_ID,
        name: 'Âmbar',
        color: '#ffbf00',
        isFavorite: true,
        ...entityBase,
      },
      {
        id: 'azure',
        storyId: TEST_STORY_ID,
        name: 'Azul',
        color: '#0000ff',
        isFavorite: true,
        ...entityBase,
      },
    ]);

    const result = await createTagService(database.db).getTagsByStoryId(
      TEST_STORY_ID,
      'ÂMB',
      ['amber'],
      undefined,
      undefined,
      'favorite',
      { color: '#ffbf00' },
    );
    expect(result.map(({ id }) => id)).toEqual(['amber']);
  });

  it('creates, updates, and soft-deletes a Choice while preserving its story ownership', async () => {
    const service = createChoiceService(database.db);
    const created = await service.createChoice('local-user', {
      storyId: TEST_STORY_ID,
      sceneId: 'scene-a',
      nextSceneId: 'scene-b',
      text: 'Seguir pela ponte',
    });
    const updated = await service.updateChoice('local-user', created.id, {
      text: 'Seguir pela ponte antiga',
    });
    await service.deleteChoice('local-user', created.id);

    expect(updated).toEqual(
      expect.objectContaining({
        id: created.id,
        storyId: TEST_STORY_ID,
        text: 'Seguir pela ponte antiga',
        version: 2,
      }),
    );
    expect(await service.getById(created.id)).toBeUndefined();
  });

  it('records ItemJourneyService state changes and hides its soft-deleted journey', async () => {
    await database.db.insert(schema.items).values({
      id: 'compass',
      storyId: TEST_STORY_ID,
      name: 'Bússola',
      ...entityBase,
    });
    await database.db.insert(schema.scenes).values({
      id: 'harbor',
      storyId: TEST_STORY_ID,
      chapterId: 'chapter',
      locationId: 'city',
      name: 'Porto',
      index: 1,
      ...entityBase,
    });
    const service = createItemJourneyService(database.db);
    const created = await service.createItemJourney('local-user', {
      storyId: TEST_STORY_ID,
      itemId: 'compass',
      sceneId: 'harbor',
      newState: 'found',
      newCharacterOwnerId: null,
      extraNotes: null,
    });
    const updated = await service.updateItemJourney('local-user', created.id, {
      newState: 'lost',
    });
    await service.deleteItemJourney('local-user', created.id);

    expect(updated).toEqual(expect.objectContaining({ newState: 'lost', version: 2 }));
    expect(await service.getById(created.id)).toBeUndefined();
  });
});

/**
 * @jest-environment node
 */
import { OperationLogEntityType } from '@keres/shared';
import type { TFunction } from 'i18next';
import * as schema from '../../src/db/schema';
import { EntityService } from '../../src/services/EntityService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

/** It returns the key itself, so the test can read the label without depending on the translation file. */
const t = ((key: string) => key) as unknown as TFunction;

let database: TestDatabase;

const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

async function seedStory(overrides: Partial<typeof schema.stories.$inferInsert> = {}) {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    ...base,
    ...overrides,
  });
}

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => {
  database.close();
});

/**
 * `getEntityName` is what gives a readable name to each row of the operation log screen. Without it
 * the history becomes a list of ULIDs, so what matters is exactly the case where the entity is no
 * longer findable: it has to degrade to the translated type, never break the screen.
 */
describe('getEntityName', () => {
  it('names a story by its title', async () => {
    await seedStory();

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Story,
      STORY_ID,
      STORY_ID,
      t,
    );

    expect(name).toBe('story - A Queda');
  });

  it('names a story arc by its title', async () => {
    await seedStory();
    await database.db.insert(schema.storyArcs).values({
      id: 'arc-1',
      storyId: STORY_ID,
      title: 'Livro I',
      description: null,
      sortOrder: 0,
      isDefault: true,
      ...base,
    });

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.StoryArc,
      'arc-1',
      STORY_ID,
      t,
    );

    expect(name).toBe('arc - Livro I');
  });

  it('names a character by its name', async () => {
    await seedStory();
    await database.db
      .insert(schema.characters)
      .values({ id: 'char-1', storyId: STORY_ID, name: 'Keres', ...base });

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Character,
      'char-1',
      STORY_ID,
      t,
    );

    expect(name).toBe('character - Keres');
  });

  it('names a board by its name', async () => {
    await seedStory();
    await database.db.insert(schema.boards).values({
      id: 'board-1',
      storyId: STORY_ID,
      name: 'Mapa da cidade',
      description: null,
      content: { nodes: [], edges: [] },
      ...base,
    });

    await expect(
      EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Board,
        'board-1',
        STORY_ID,
        t,
      ),
    ).resolves.toBe('board - Mapa da cidade');
  });

  it('names a location map by its name', async () => {
    await seedStory();
    await database.db.insert(schema.locationMaps).values({
      id: 'map-1',
      storyId: STORY_ID,
      name: 'Continente',
      description: null,
      content: { images: [], nodes: [] },
      ...base,
    });

    await expect(
      EntityService.getEntityName(
        database.db,
        OperationLogEntityType.LocationMap,
        'map-1',
        STORY_ID,
        t,
      ),
    ).resolves.toBe('location_map - Continente');
  });

  it('names routes and their steps for the operation log', async () => {
    await seedStory({ type: 'branching' });
    await database.db.insert(schema.chapters).values({
      id: 'chapter-1',
      storyId: STORY_ID,
      name: 'Opening',
      index: 1,
      ...base,
    });
    await database.db.insert(schema.scenes).values({
      id: 'scene-1',
      storyId: STORY_ID,
      chapterId: 'chapter-1',
      locationId: null,
      name: 'The fork',
      index: 1,
      ...base,
    });
    await database.db.insert(schema.routes).values({
      id: 'route-1',
      storyId: STORY_ID,
      name: 'Mercy path',
      details: null,
      ...base,
    });
    await database.db.insert(schema.routeSteps).values({
      id: 'step-1',
      storyId: STORY_ID,
      routeId: 'route-1',
      position: 0,
      sceneId: 'scene-1',
      selectedChoiceId: null,
      ...base,
    });

    await expect(
      EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Route,
        'route-1',
        STORY_ID,
        t,
      ),
    ).resolves.toBe('route - Mercy path');
    await expect(
      EntityService.getEntityName(
        database.db,
        OperationLogEntityType.RouteStep,
        'step-1',
        STORY_ID,
        t,
      ),
    ).resolves.toBe('route_step - Mercy path — route_step 1: The fork');
  });

  it.each([
    ['note', OperationLogEntityType.Note, schema.notes, { title: 'Ideia' }, 'note - Ideia'],
    [
      'location',
      OperationLogEntityType.Location,
      schema.locations,
      { name: 'Ávalon' },
      'location - Ávalon',
    ],
    [
      'world rule',
      OperationLogEntityType.WorldRule,
      schema.worldRules,
      { title: 'Magia' },
      'world_piece_section_rule - Magia',
    ],
    ['tag', OperationLogEntityType.Tag, schema.tags, { name: 'Vilões' }, 'tag - Vilões'],
  ])('names a %s', async (_label, entityType, table, columns, expected) => {
    await seedStory();
    await database.db
      .insert(table as never)
      .values({ id: 'e-1', storyId: STORY_ID, ...columns, ...base } as never);

    const name = await EntityService.getEntityName(database.db, entityType, 'e-1', STORY_ID, t);

    expect(name).toBe(expected);
  });

  it('falls back to the translated type when the entity is gone', async () => {
    await seedStory();

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Character,
      'sumiu',
      STORY_ID,
      t,
    );

    expect(name).toBe('character');
  });

  /**
   * A deletion log points precisely at a row marked as deleted; the query filters `isDeleted`, so that
   * case falls back to the generic label instead of showing the name.
   */
  it('falls back to the translated type for a deleted entity', async () => {
    await seedStory();
    await database.db.insert(schema.characters).values({
      id: 'char-1',
      storyId: STORY_ID,
      name: 'Keres',
      ...base,
      isDeleted: true,
    });

    const name = await EntityService.getEntityName(
      database.db,
      OperationLogEntityType.Character,
      'char-1',
      STORY_ID,
      t,
    );

    expect(name).toBe('character');
  });

  it('names a suggestion by its value and a named list by catalog name only', async () => {
    await seedStory();
    await database.db.insert(schema.suggestions).values([
      { id: 'sug-plain', storyId: STORY_ID, type: 'character_race', value: 'Elfo', ...base },
      {
        id: 'sug-list',
        storyId: STORY_ID,
        type: 'list_catalog',
        value: '{"type":"list_01ARZ3NDEKTSV4RRFFQ69G5FAV_cores","name":"Cores"}',
        ...base,
      },
    ]);

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Suggestion,
        'sug-plain',
        STORY_ID,
        t,
      ),
    ).toBe('suggestion - Elfo');
    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Suggestion,
        'sug-list',
        STORY_ID,
        t,
      ),
    ).toBe('suggestion - Cores');
  });

  it('does not confuse two entities that share an id across tables', async () => {
    await seedStory();
    await database.db
      .insert(schema.characters)
      .values({ id: 'mesmo-id', storyId: STORY_ID, name: 'Keres', ...base });
    await database.db
      .insert(schema.tags)
      .values({ id: 'mesmo-id', storyId: STORY_ID, name: 'Vilões', ...base });

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Character,
        'mesmo-id',
        STORY_ID,
        t,
      ),
    ).toBe('character - Keres');
    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Tag,
        'mesmo-id',
        STORY_ID,
        t,
      ),
    ).toBe('tag - Vilões');
  });
});

describe('getEntityIdentifier', () => {
  it.each([
    ['Character', 'char-1'],
    ['character', 'char-1'],
    ['CHARACTER', 'char-1'],
  ])('resolves the entity type %s regardless of case', async (entityTypeString) => {
    await seedStory();
    await database.db
      .insert(schema.characters)
      .values({ id: 'char-1', storyId: STORY_ID, name: 'Keres', ...base });

    expect(
      await EntityService.getEntityIdentifier(database.db, entityTypeString, 'char-1', STORY_ID, t),
    ).toBe('Keres');
  });

  it('returns the bare name, without the type prefix', async () => {
    await seedStory();

    expect(
      await EntityService.getEntityIdentifier(database.db, 'Story', STORY_ID, STORY_ID, t),
    ).toBe('A Queda');
  });

  it('returns nothing for an entity that is not there', async () => {
    await seedStory();

    expect(
      await EntityService.getEntityIdentifier(database.db, 'Character', 'sumiu', STORY_ID, t),
    ).toBeUndefined();
  });

  it('rejects an entity type it does not know, instead of guessing', async () => {
    await expect(
      EntityService.getEntityIdentifier(database.db, 'Dragao', 'e-1', STORY_ID, t),
    ).rejects.toThrow(/Invalid entityTypeString/);
  });
});

/**
 * The stat system's entities came after the rest, and the symptom of forgetting a `case` here is the
 * operation log showing "unknown entity" - which is exactly what happened.
 */
describe('stat system entities', () => {
  async function seedStatWorld() {
    await seedStory({ statSystem: true });
    await database.db
      .insert(schema.characters)
      .values({ id: 'char-1', storyId: STORY_ID, name: 'Ilda', ...base });
    await database.db.insert(schema.stats).values({
      id: 'stat-1',
      storyId: STORY_ID,
      name: 'Coragem',
      isPrimary: true,
      order: 0,
      ...base,
    });
    await database.db.insert(schema.modes).values({
      id: 'mode-1',
      storyId: STORY_ID,
      characterId: 'char-1',
      name: 'Na tempestade',
      order: 0,
      ...base,
    });
  }

  it('names a stat by its name', async () => {
    await seedStatWorld();

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Stat,
        'stat-1',
        STORY_ID,
        t,
      ),
    ).toBe('stat - Coragem');
  });

  it('names a mode together with the character that owns it', async () => {
    await seedStatWorld();

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Mode,
        'mode-1',
        STORY_ID,
        t,
      ),
    ).toBe('mode - mode_of_character');
  });

  it('names a tier of the story default ladder', async () => {
    await seedStatWorld();
    await database.db.insert(schema.statStrengths).values({
      id: 'tier-1',
      storyId: STORY_ID,
      statId: null,
      label: 'C',
      minValue: 50,
      ...base,
    });

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.StatStrength,
        'tier-1',
        STORY_ID,
        t,
      ),
    ).toBe('stat_strength - stat_ladder_story_default - C (50)');
  });

  it('names a tier that belongs to one stat', async () => {
    await seedStatWorld();
    await database.db.insert(schema.statStrengths).values({
      id: 'tier-2',
      storyId: STORY_ID,
      statId: 'stat-1',
      label: 'A',
      minValue: 400,
      ...base,
    });

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.StatStrength,
        'tier-2',
        STORY_ID,
        t,
      ),
    ).toBe('stat_strength - stat_ladder_of_stat - A (400)');
  });

  it('names a value with its stat, its character and the number', async () => {
    await seedStatWorld();
    await database.db.insert(schema.statRelations).values({
      id: 'value-1',
      storyId: STORY_ID,
      characterId: 'char-1',
      modeId: null,
      statId: 'stat-1',
      value: 120,
      ...base,
    });

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.StatRelation,
        'value-1',
        STORY_ID,
        t,
      ),
    ).toBe('stat_relation - stat_value_of_entity: 120');
  });

  it('degrades to the translated type when the row is gone', async () => {
    await seedStatWorld();

    expect(
      await EntityService.getEntityName(
        database.db,
        OperationLogEntityType.Stat,
        'sumiu',
        STORY_ID,
        t,
      ),
    ).toBe('stat');
  });

  it('resolves a stat and a mode as a relation target too', async () => {
    await seedStatWorld();

    expect(
      await EntityService.getEntityIdentifier(database.db, 'Stat', 'stat-1', STORY_ID, t),
    ).toBe('Coragem');
    expect(
      await EntityService.getEntityIdentifier(database.db, 'Mode', 'mode-1', STORY_ID, t),
    ).toBe('mode_of_character');
  });
});

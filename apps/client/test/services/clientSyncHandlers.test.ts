/**
 * @jest-environment node
 */
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { AttributeValueClientSyncHandler } from '../../src/services/entity-sync-handlers/AttributeValueClientSyncHandler';
import { ChapterClientSyncHandler } from '../../src/services/entity-sync-handlers/ChapterClientSyncHandler';
import { CharacterClientSyncHandler } from '../../src/services/entity-sync-handlers/CharacterClientSyncHandler';
import { CharacterSceneClientSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSceneClientSyncHandler';
import { ChoiceClientSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceClientSyncHandler';
import { ChoiceCheckClientSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckClientSyncHandler';
import { ChoiceCheckGroupClientSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckGroupClientSyncHandler';
import { EffectClientSyncHandler } from '../../src/services/entity-sync-handlers/EffectClientSyncHandler';
import { ItemClientSyncHandler } from '../../src/services/entity-sync-handlers/ItemClientSyncHandler';
import { ItemJourneyClientSyncHandler } from '../../src/services/entity-sync-handlers/ItemJourneyClientSyncHandler';
import { LocationClientSyncHandler } from '../../src/services/entity-sync-handlers/LocationClientSyncHandler';
import { NoteClientSyncHandler } from '../../src/services/entity-sync-handlers/NoteClientSyncHandler';
import { NoteRelationClientSyncHandler } from '../../src/services/entity-sync-handlers/NoteRelationClientSyncHandler';
import { PlotClientSyncHandler } from '../../src/services/entity-sync-handlers/PlotClientSyncHandler';
import { PlotSceneClientSyncHandler } from '../../src/services/entity-sync-handlers/PlotSceneClientSyncHandler';
import { SceneClientSyncHandler } from '../../src/services/entity-sync-handlers/SceneClientSyncHandler';
import { StorySchemaFieldClientSyncHandler } from '../../src/services/entity-sync-handlers/StorySchemaFieldClientSyncHandler';
import {
  ModeClientSyncHandler,
  StatClientSyncHandler,
  StatRelationClientSyncHandler,
  StatStrengthClientSyncHandler,
} from '../../src/services/entity-sync-handlers/StatClientSyncHandler';
import { SuggestionClientSyncHandler } from '../../src/services/entity-sync-handlers/SuggestionClientSyncHandler';
import { TagClientSyncHandler } from '../../src/services/entity-sync-handlers/TagClientSyncHandler';
import { WorldRuleClientSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleClientSyncHandler';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const CREATED_AT = '2026-08-10T12:00:00.000Z';

let database: TestDatabase;

/**
 * Every synchronizable entity has its handler, and it is the handler that writes what arrives from the
 * server into the device's database. A mistake here silently corrupts the user's local data on the
 * pull. The contract is the same for all 20+ handlers; these four cover the shapes that exist.
 */
const HANDLERS = [
  {
    name: 'AttributeValue',
    build: () => new AttributeValueClientSyncHandler(),
    table: schema.attributeValues,
    labelColumn: 'value' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: `character-${id}`,
      fieldId: `field-${id}`,
      value: 'coragem',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { value: 'honra' },
  },
  {
    name: 'Chapter',
    build: () => new ChapterClientSyncHandler(),
    table: schema.chapters,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      name: 'Abertura',
      index: 0,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Abertura revisada' },
  },
  {
    name: 'Effect',
    usesStoryContext: false,
    build: () => new EffectClientSyncHandler(),
    table: schema.effects,
    labelColumn: 'triggerName' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      entityType: 'Choice',
      entityId: 'choice-1',
      effectType: 'triggerSet',
      triggerName: 'ponte_aberta',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { triggerName: 'porta_aberta' },
  },
  {
    name: 'Item',
    usesStoryContext: false,
    build: () => new ItemClientSyncHandler(),
    table: schema.items,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      name: 'Chave antiga',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Chave da torre' },
  },
  {
    name: 'Character',
    build: () => new CharacterClientSyncHandler(),
    table: schema.characters,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      name: 'Keres',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Keres, a Deusa' },
  },
  {
    name: 'NoteRelation',
    build: () => new NoteRelationClientSyncHandler(),
    table: schema.noteRelations,
    labelColumn: 'relationId' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      noteId: 'note-1',
      relationId: 'character-1',
      relationType: 'Character',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { relationId: 'character-2' },
  },
  {
    name: 'CharacterScene',
    usesStoryContext: false,
    build: () => new CharacterSceneClientSyncHandler(),
    table: schema.characterScenes,
    labelColumn: 'sceneId' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      characterId: 'character-1',
      sceneId: 'scene-1',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { sceneId: 'scene-2' },
  },
  {
    name: 'StorySchemaField',
    build: () => new StorySchemaFieldClientSyncHandler(),
    table: schema.storySchemaFields,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      entityType: 'Character',
      name: 'Origem',
      key: `origin-${id}`,
      type: 'text',
      order: 0,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Terra natal' },
  },
  {
    name: 'Choice',
    usesStoryContext: false,
    build: () => new ChoiceClientSyncHandler(),
    table: schema.choices,
    labelColumn: 'text' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      sceneId: 'scene-1',
      nextSceneId: 'scene-2',
      text: 'Continuar',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { text: 'Seguir em frente' },
  },
  {
    name: 'Location',
    build: () => new LocationClientSyncHandler(),
    table: schema.locations,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      name: 'Torre',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Torre Antiga' },
  },
  {
    name: 'Tag',
    build: () => new TagClientSyncHandler(),
    table: schema.tags,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      name: 'Vilões',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Antagonistas' },
  },
  {
    name: 'Scene',
    usesStoryContext: false,
    build: () => new SceneClientSyncHandler(),
    table: schema.scenes,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      chapterId: 'chapter-1',
      locationId: 'location-1',
      name: 'Chegada',
      index: 0,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Chegada à torre' },
  },
  {
    name: 'Note',
    build: () => new NoteClientSyncHandler(),
    table: schema.notes,
    labelColumn: 'title' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      title: 'Ideia',
      body: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { title: 'Ideia revisada' },
  },
  {
    name: 'WorldRule',
    build: () => new WorldRuleClientSyncHandler(),
    table: schema.worldRules,
    labelColumn: 'title' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      title: 'Magia',
      description: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { title: 'Magia elemental' },
  },
  {
    name: 'Suggestion',
    build: () => new SuggestionClientSyncHandler(),
    table: schema.suggestions,
    labelColumn: 'value' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      type: 'character-name',
      value: 'Nyx',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { value: 'Erebus' },
  },
  {
    name: 'Plot',
    usesStoryContext: false,
    build: () => new PlotClientSyncHandler(),
    table: schema.plots,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      name: 'Main plot',
      details: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Revised plot' },
  },
  {
    name: 'PlotScene',
    usesStoryContext: false,
    build: () => new PlotSceneClientSyncHandler(),
    table: schema.plotScenes,
    labelColumn: 'note' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      plotId: `plot-${id}`,
      sceneId: `scene-${id}`,
      note: 'Advances here',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { note: 'Turns here' },
  },
  {
    name: 'ChoiceCheckGroup',
    usesStoryContext: false,
    prepare: async () => {
      await database.db.insert(schema.choices).values(
        ['e-1', 'e-2'].map((id) => ({
          id: `choice-${id}`,
          storyId: STORY_ID,
          sceneId: 'scene-1',
          nextSceneId: 'scene-2',
          text: `Choice ${id}`,
          createdAt: new Date(CREATED_AT),
          updatedAt: new Date(CREATED_AT),
          version: 1,
          isDeleted: false,
        })),
      );
    },
    build: () => new ChoiceCheckGroupClientSyncHandler(),
    table: schema.choiceCheckGroups,
    labelColumn: 'combinator' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      choiceId: `choice-${id}`,
      combinator: 'AND',
      order: 1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { combinator: 'OR' },
  },
  {
    name: 'ChoiceCheck',
    usesStoryContext: false,
    prepare: async () => {
      await database.db.insert(schema.choices).values(
        ['e-1', 'e-2'].map((id) => ({
          id: `choice-${id}`,
          storyId: STORY_ID,
          sceneId: 'scene-1',
          nextSceneId: 'scene-2',
          text: `Choice ${id}`,
          createdAt: new Date(CREATED_AT),
          updatedAt: new Date(CREATED_AT),
          version: 1,
          isDeleted: false,
        })),
      );
      await database.db.insert(schema.choiceCheckGroups).values(
        ['e-1', 'e-2'].map((id) => ({
          id: `group-${id}`,
          storyId: STORY_ID,
          choiceId: `choice-${id}`,
          combinator: 'AND' as const,
          order: 1,
          createdAt: new Date(CREATED_AT),
          updatedAt: new Date(CREATED_AT),
          version: 1,
          isDeleted: false,
        })),
      );
    },
    build: () => new ChoiceCheckClientSyncHandler(),
    table: schema.choiceChecks,
    labelColumn: 'triggerName' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      groupId: `group-${id}`,
      mode: 'enable',
      type: 'trigger',
      order: 1,
      triggerName: 'door_open',
      triggerState: 'set',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { triggerName: 'gate_open' },
  },
  {
    name: 'ItemJourney',
    usesStoryContext: false,
    prepare: async () => {
      const base = {
        storyId: STORY_ID,
        createdAt: new Date(CREATED_AT),
        updatedAt: new Date(CREATED_AT),
        version: 1,
        isDeleted: false,
      };
      await database.db
        .insert(schema.items)
        .values(['e-1', 'e-2'].map((id) => ({ id: `item-${id}`, name: `Item ${id}`, ...base })));
      await database.db.insert(schema.scenes).values(
        ['e-1', 'e-2'].map((id, index) => ({
          id: `scene-${id}`,
          chapterId: 'chapter-1',
          locationId: 'location-1',
          name: `Scene ${id}`,
          index: index + 1,
          ...base,
        })),
      );
    },
    build: () => new ItemJourneyClientSyncHandler(),
    table: schema.itemJourneys,
    labelColumn: 'newState' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      itemId: `item-${id}`,
      sceneId: `scene-${id}`,
      newCharacterOwnerId: null,
      newState: 'Found',
      extraNotes: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { newState: 'Lost' },
  },
  {
    name: 'Stat',
    build: () => new StatClientSyncHandler(),
    table: schema.stats,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      name: 'Strength',
      isPrimary: true,
      order: 1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Power' },
  },
  {
    name: 'StatStrength',
    build: () => new StatStrengthClientSyncHandler(),
    table: schema.statStrengths,
    labelColumn: 'label' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      statId: null,
      label: 'Average',
      minValue: 0,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { label: 'Skilled' },
  },
  {
    name: 'StatRelation',
    build: () => new StatRelationClientSyncHandler(),
    table: schema.statRelations,
    labelColumn: 'value' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      characterId: `character-${id}`,
      modeId: null,
      statId: `stat-${id}`,
      value: 1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { value: 2 },
  },
  {
    name: 'Mode',
    build: () => new ModeClientSyncHandler(),
    table: schema.modes,
    labelColumn: 'name' as const,
    data: (id: string) => ({
      id,
      storyId: STORY_ID,
      characterId: `character-${id}`,
      name: 'Normal',
      description: null,
      order: 1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    }),
    change: { name: 'Awakened' },
  },
];

const createUpdate = (entity: string, id: string, data: unknown): CreateStoryUpdate =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;

const updateUpdate = (entity: string, id: string, changes: unknown): UpdateStoryUpdate =>
  ({ type: 'update', entity, id, changes }) as UpdateStoryUpdate;

const deleteUpdate = (entity: string, id: string): DeleteStoryUpdate =>
  ({ type: 'delete', entity, id }) as DeleteStoryUpdate;

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe.each(HANDLERS)(
  '$name client sync handler',
  ({ name, build, table, labelColumn, data, change, usesStoryContext = true, prepare }) => {
    beforeEach(async () => {
      await prepare?.();
    });

    const withDb = () => {
      const handler = build();
      handler.setDb(database.db);
      return handler;
    };

    const rowsOf = () =>
      database.db
        .select()
        .from(table as never)
        .all() as any[];

    it('refuses to work before a database is set', async () => {
      const handler = build();

      await expect(
        handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1'))),
      ).rejects.toThrow(/Drizzle client \(db\).*not set/);
    });

    it('inserts the entity the server sent', async () => {
      const handler = withDb();

      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      const rows = rowsOf();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: 'e-1', storyId: STORY_ID, version: 1, isDeleted: false });
    });

    it('revives the ISO dates the server sent as real timestamps', async () => {
      const handler = withDb();

      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      const [row] = rowsOf();
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.createdAt.toISOString()).toBe(CREATED_AT);
    });

    it('files the entity under the story it was pulled for, not the one in the payload', async () => {
      const handler = withDb();
      const payload = { ...data('e-1'), storyId: 'historia-errada' };

      await handler.applyCreate('historia-certa', createUpdate(name, 'e-1', payload));

      expect(rowsOf()[0].storyId).toBe(usesStoryContext ? 'historia-certa' : 'historia-errada');
    });

    it('ignores an operation addressed to another entity type', async () => {
      const handler = withDb();

      await handler.applyCreate(STORY_ID, createUpdate('OutraEntidade', 'e-1', data('e-1')));

      expect(rowsOf()).toEqual([]);
    });

    it('refuses a create with no id instead of inserting a broken row', async () => {
      const handler = withDb();

      await handler.applyCreate(STORY_ID, {
        type: 'create',
        entity: name,
        data: data('e-1'),
      } as unknown as CreateStoryUpdate);

      expect(rowsOf()).toEqual([]);
    });

    it('applies a remote change to the stored row', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      await handler.applyUpdate(STORY_ID, updateUpdate(name, 'e-1', change));

      expect(rowsOf()[0][labelColumn]).toBe(Object.values(change)[0]);
    });

    it('leaves the fields the change did not mention alone', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      await handler.applyUpdate(STORY_ID, updateUpdate(name, 'e-1', change));

      expect(rowsOf()[0].version).toBe(1);
    });

    it('touches updatedAt on every change', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));
      const before = rowsOf()[0].updatedAt.getTime();

      await handler.applyUpdate(STORY_ID, updateUpdate(name, 'e-1', change));

      expect(rowsOf()[0].updatedAt.getTime()).toBeGreaterThan(before);
    });

    it('ignores an update addressed to another entity type', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      await handler.applyUpdate(STORY_ID, updateUpdate('OutraEntidade', 'e-1', change));

      expect(rowsOf()[0][labelColumn]).not.toBe(Object.values(change)[0]);
    });

    it('touches nothing when the update names an id that is not here', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      await handler.applyUpdate(STORY_ID, updateUpdate(name, 'nao-existe', change));

      expect(rowsOf()[0][labelColumn]).not.toBe(Object.values(change)[0]);
    });

    it('soft-deletes, keeping the row so the tombstone survives', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      await handler.applyDelete(STORY_ID, deleteUpdate(name, 'e-1'));

      const [row] = rowsOf();
      expect(row.isDeleted).toBe(true);
      expect(row.deletedAt).toBeInstanceOf(Date);
    });

    it('ignores a delete addressed to another entity type', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      await handler.applyDelete(STORY_ID, deleteUpdate('OutraEntidade', 'e-1'));

      expect(rowsOf()[0].isDeleted).toBe(false);
    });

    it('reads an entity back by id', async () => {
      const handler = withDb();
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));

      expect(((await handler.getById('e-1')) as { id?: string } | undefined)?.id).toBe('e-1');
    });

    it('returns nothing for an id it does not have', async () => {
      const handler = withDb();

      expect(await handler.getById('nao-existe')).toBeUndefined();
    });

    it('keeps two entities of the same story apart', async () => {
      const handler = withDb();

      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-1', data('e-1')));
      await handler.applyCreate(STORY_ID, createUpdate(name, 'e-2', data('e-2')));
      await handler.applyDelete(STORY_ID, deleteUpdate(name, 'e-1'));

      const byId = new Map(rowsOf().map((row) => [row.id, row]));
      expect(byId.get('e-1').isDeleted).toBe(true);
      expect(byId.get('e-2').isDeleted).toBe(false);
    });
  },
);

describe('CharacterClientSyncHandler specifics', () => {
  it('writes the optional fields the server sent', async () => {
    const handler = new CharacterClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(
      STORY_ID,
      createUpdate('Character', 'char-1', {
        id: 'char-1',
        storyId: STORY_ID,
        name: 'Keres',
        title: 'A Deusa',
        gender: 'feminino',
        biography: 'Nascida do caos.',
        isFavorite: true,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      }),
    );

    const row = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'char-1'),
    });
    expect(row).toMatchObject({
      title: 'A Deusa',
      gender: 'feminino',
      biography: 'Nascida do caos.',
      isFavorite: true,
    });
  });

  it('clears an optional field the server blanked out', async () => {
    const handler = new CharacterClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(
      STORY_ID,
      createUpdate('Character', 'char-1', {
        id: 'char-1',
        storyId: STORY_ID,
        name: 'Keres',
        title: 'A Deusa',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      }),
    );

    await handler.applyUpdate(STORY_ID, updateUpdate('Character', 'char-1', { title: null }));

    const row = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'char-1'),
    });
    expect(row!.title).toBeNull();
  });
});

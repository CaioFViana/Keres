/**
 * @jest-environment node
 */
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { CharacterClientSyncHandler } from '../../src/services/entity-sync-handlers/CharacterClientSyncHandler';
import { NoteClientSyncHandler } from '../../src/services/entity-sync-handlers/NoteClientSyncHandler';
import { TagClientSyncHandler } from '../../src/services/entity-sync-handlers/TagClientSyncHandler';
import { WorldRuleClientSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleClientSyncHandler';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const CREATED_AT = '2026-08-10T12:00:00.000Z';

let database: TestDatabase;

/**
 * Cada entidade sincronizável tem o seu handler, e é ele que escreve no banco do aparelho o
 * que chega do servidor. Um erro aqui corrompe os dados locais do usuário no pull, em silêncio.
 * O contrato é o mesmo para os 20+ handlers; estes quatro cobrem as formas que existem.
 */
const HANDLERS = [
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
  ({ name, build, table, labelColumn, data, change }) => {
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
      ).rejects.toThrow(/Drizzle client \(db\) not set/);
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

      expect(rowsOf()[0].storyId).toBe('historia-certa');
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
      } as CreateStoryUpdate);

      expect(rowsOf()).toEqual([]);
      expect(console.error).toHaveBeenCalled();
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

      expect((await handler.getById('e-1'))?.id).toBe('e-1');
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

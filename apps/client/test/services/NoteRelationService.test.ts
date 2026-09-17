/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import {
  createNoteRelationService,
  type SaveNoteRelation,
} from '../../src/services/storymanagement/NoteRelationService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The note-relation service's entity-side read, update path and delete edge.
 *
 * The insert path and the note-side read already live in `storyManagementRelations.test.ts`. What
 * was missing is the read from the entity side (the "which notes mention this character?" panel),
 * the update branch with its own duplicate check excluding the row being edited, and the quiet
 * delete of an unknown id.
 *
 * The catch blocks and the "the write returned no row" throws are deliberately not covered: they
 * need the database to fail or the row to vanish mid-call.
 */

let database: TestDatabase;

const relationOf = (overrides: Partial<SaveNoteRelation> = {}): SaveNoteRelation => ({
  storyId: TEST_STORY_ID,
  noteId: 'note-1',
  relationId: 'ada',
  relationType: 'Character',
  ...overrides,
});

const operationsFor = async (entityId: string) =>
  (await database.db.query.operationLogs.findMany()).filter(
    (operation) => operation.entityId === entityId,
  );

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.notes).values([
    { id: 'note-1', storyId: TEST_STORY_ID, title: 'First', ...entityBase, deletedAt: null },
    { id: 'note-2', storyId: TEST_STORY_ID, title: 'Second', ...entityBase, deletedAt: null },
  ]);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('NoteRelationService reads', () => {
  it('lists the notes attached to an entity and hides deleted links', async () => {
    const service = createNoteRelationService(database.db);
    const created = await service.saveNoteRelation(TEST_USER_ID, relationOf());
    await service.saveNoteRelation(
      TEST_USER_ID,
      relationOf({ noteId: 'note-2', relationId: 'harbor', relationType: 'Location' }),
    );

    expect(
      (await service.getRelationsForEntity(TEST_STORY_ID, 'ada', 'Character')).map(
        (relation) => relation.id,
      ),
    ).toEqual([created.id]);
    expect(await service.getRelationsForEntity(TEST_STORY_ID, 'nobody', 'Character')).toEqual([]);

    await service.deleteNoteRelation(TEST_USER_ID, created.id);
    expect(await service.getRelationsForEntity(TEST_STORY_ID, 'ada', 'Character')).toEqual([]);
  });
});

describe('NoteRelationService update', () => {
  it('retargets a link to another note', async () => {
    const service = createNoteRelationService(database.db);
    const created = await service.saveNoteRelation(TEST_USER_ID, relationOf());

    const updated = await service.saveNoteRelation(
      TEST_USER_ID,
      relationOf({ id: created.id, noteId: 'note-2' }),
    );

    expect(updated.noteId).toBe('note-2');
    expect((await operationsFor(created.id)).map((operation) => operation.operationType)).toEqual([
      'create',
      'update',
    ]);
  });

  it('rejects an update that would duplicate another link', async () => {
    const service = createNoteRelationService(database.db);
    await service.saveNoteRelation(TEST_USER_ID, relationOf());
    const second = await service.saveNoteRelation(TEST_USER_ID, relationOf({ noteId: 'note-2' }));

    await expect(
      service.saveNoteRelation(TEST_USER_ID, relationOf({ id: second.id })),
    ).rejects.toThrow('already exists');
  });

  it('skips the write and the operation log when the update changes nothing', async () => {
    const service = createNoteRelationService(database.db);
    const created = await service.saveNoteRelation(TEST_USER_ID, relationOf());
    const stored = await database.db.query.noteRelations.findFirst({
      where: (table, { eq }) => eq(table.id, created.id),
    });

    const result = await service.saveNoteRelation(TEST_USER_ID, {
      id: stored!.id,
      storyId: stored!.storyId,
      noteId: stored!.noteId,
      relationId: stored!.relationId,
      relationType: stored!.relationType as 'Character',
    });

    expect(result.id).toBe(created.id);
    expect(await operationsFor(created.id)).toHaveLength(1);
  });
});

describe('NoteRelationService delete edge', () => {
  it('reports a missing link on delete instead of throwing', async () => {
    const service = createNoteRelationService(database.db);

    expect(await service.deleteNoteRelation(TEST_USER_ID, 'missing')).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(
      'NoteRelation with ID missing not found for deletion.',
    );
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});

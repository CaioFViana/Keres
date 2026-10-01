/**
 * @jest-environment node
 */
import {
  clearAllBoundEditorDrafts,
  clearAllEditorDrafts,
  clearBoundEditorDraft,
  clearEditorDraft,
  clearStoryEditorDrafts,
  readBoundEditorDraft,
  readEditorDraft,
  resetEditorDraftDbForTests,
  scheduleWriteEditorDraft,
  setEditorDraftDb,
  writeEditorDraft,
  writeEditorDraftNow,
} from '../../src/services/EditorDraftService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const draft = {
  storyId: 'story-1',
  entityType: 'Scene',
  entityId: 'scene-1',
  field: 'body',
};

async function rowCount(): Promise<number> {
  return (await database.db.query.editorDrafts.findMany({ columns: { id: true } })).length;
}

beforeEach(async () => {
  database = await createTestDatabase();
  resetEditorDraftDbForTests();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetEditorDraftDbForTests();
  database.close();
  jest.restoreAllMocks();
});

describe('explicit-database functions', () => {
  it('round-trips content addressed by story, entity and field', async () => {
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
      '# Ola',
    );

    const row = await readEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
    );

    expect(row?.content).toBe('# Ola');
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  it('returns null for a draft that was never written', async () => {
    await expect(
      readEditorDraft(database.db, draft.storyId, draft.entityType, draft.entityId, draft.field),
    ).resolves.toBeNull();
  });

  it('overwrites rather than piling up on a second write', async () => {
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
      'um',
    );
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
      'dois',
    );

    expect(await rowCount()).toBe(1);
    const row = await readEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
    );
    expect(row?.content).toBe('dois');
  });

  it('keeps one row per field of the same entity', async () => {
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      'body',
      'prosa',
    );
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      'secondary',
      '{"tags":[]}',
    );

    expect(await rowCount()).toBe(2);
  });

  it('clears only the addressed draft', async () => {
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
      'x',
    );
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      'scene-2',
      draft.field,
      'y',
    );

    await clearEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
    );

    expect(await rowCount()).toBe(1);
  });

  it('clears every draft of one story and reports how many', async () => {
    await writeEditorDraft(
      database.db,
      'story-1',
      draft.entityType,
      draft.entityId,
      draft.field,
      'x',
    );
    await writeEditorDraft(database.db, 'story-1', draft.entityType, draft.entityId, 'other', 'y');
    await writeEditorDraft(
      database.db,
      'story-2',
      draft.entityType,
      draft.entityId,
      draft.field,
      'z',
    );

    const removed = await clearStoryEditorDrafts(database.db, 'story-1');

    expect(removed).toBe(2);
    expect(await rowCount()).toBe(1);
  });

  it('clears every draft there is and reports how many', async () => {
    await writeEditorDraft(
      database.db,
      'story-1',
      draft.entityType,
      draft.entityId,
      draft.field,
      'x',
    );
    await writeEditorDraft(
      database.db,
      'story-2',
      draft.entityType,
      draft.entityId,
      draft.field,
      'y',
    );

    const removed = await clearAllEditorDrafts(database.db);

    expect(removed).toBe(2);
    expect(await rowCount()).toBe(0);
  });
});

describe('bound-database wrappers', () => {
  it('reads and writes through the bound database', async () => {
    setEditorDraftDb(database.db);

    expect(
      await writeEditorDraftNow(draft.storyId, draft.entityType, draft.entityId, draft.field, 'x'),
    ).toBe(true);
    expect(
      (await readBoundEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field))
        ?.content,
    ).toBe('x');

    await clearBoundEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field);
    expect(
      await readBoundEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field),
    ).toBeNull();
  });

  it('clears everything through the bound database', async () => {
    setEditorDraftDb(database.db);
    await writeEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
      'x',
    );

    await clearAllBoundEditorDrafts();

    expect(await rowCount()).toBe(0);
  });

  it('does nothing but warn when no database is bound', async () => {
    expect(
      await writeEditorDraftNow(draft.storyId, draft.entityType, draft.entityId, draft.field, 'x'),
    ).toBe(false);
    expect(
      await readBoundEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field),
    ).toBeNull();
    await expect(
      clearBoundEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field),
    ).resolves.toBeUndefined();
    await expect(clearAllBoundEditorDrafts()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
    expect(await rowCount()).toBe(0);
  });

  it('coalesces rapid scheduled writes into the latest content', async () => {
    jest.useFakeTimers();
    setEditorDraftDb(database.db);

    scheduleWriteEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field, 'um');
    scheduleWriteEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field, 'dois');
    expect(await rowCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(500);

    expect(await rowCount()).toBe(1);
    const row = await readEditorDraft(
      database.db,
      draft.storyId,
      draft.entityType,
      draft.entityId,
      draft.field,
    );
    expect(row?.content).toBe('dois');
    jest.useRealTimers();
  });

  it('drops a scheduled write when the draft is cleared first', async () => {
    jest.useFakeTimers();
    setEditorDraftDb(database.db);

    scheduleWriteEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field, 'um');
    await clearBoundEditorDraft(draft.storyId, draft.entityType, draft.entityId, draft.field);
    await jest.advanceTimersByTimeAsync(500);

    expect(await rowCount()).toBe(0);
    jest.useRealTimers();
  });
});

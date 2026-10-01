/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readEditorDraft,
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../src/services/EditorDraftService';
import {
  clearEntityFormSecondaryDraft,
  patchEntityFormSecondaryDraft,
  readEntityFormSecondaryDraft,
  resetEntityFormSecondaryDraftLocksForTests,
  writeEntityFormSecondaryDraft,
} from '../../src/services/storymanagement/EntityFormSecondaryDraftStore';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  resetEntityFormSecondaryDraftLocksForTests();
  await AsyncStorage.clear();
});

describe('EntityFormSecondaryDraftStore', () => {
  it('round-trips a secondary draft and clears it', async () => {
    await writeEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      selectedTagIds: ['tag-a', 'tag-b'],
      pendingNoteRelations: [
        {
          id: 'pending-1',
          storyId: 'story-1',
          noteId: 'note-1',
          relationId: 'char-1',
          relationType: 'Character',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          version: 1,
          isDeleted: false,
          deletedAt: null,
        },
      ],
      customValues: { field: 'value' },
      pendingEntityRelations: [{ id: 'rel-1', character1Id: 'char-1', character2Id: 'char-2' }],
    });

    const draft = await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    expect(draft?.selectedTagIds).toEqual(['tag-a', 'tag-b']);
    expect(draft?.pendingNoteRelations).toHaveLength(1);
    expect(draft?.customValues).toEqual({ field: 'value' });
    expect(draft?.pendingEntityRelations).toEqual([
      { id: 'rel-1', character1Id: 'char-1', character2Id: 'char-2' },
    ]);
    expect(draft?.updatedAt).toEqual(expect.any(String));

    await clearEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    expect(await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1')).toBeNull();
  });

  it('surfaces write and clear failures instead of swallowing them', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(
      writeEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
        selectedTagIds: [],
        pendingNoteRelations: [],
        customValues: {},
        pendingEntityRelations: [],
      }),
    ).rejects.toThrow('quota exceeded');

    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('remove failed'));
    await expect(clearEntityFormSecondaryDraft('story-1', 'Character', 'char-1')).rejects.toThrow(
      'remove failed',
    );
  });

  it('surfaces read failures instead of treating them as a missing draft', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(readEntityFormSecondaryDraft('story-1', 'Character', 'char-1')).rejects.toThrow(
      'disk unavailable',
    );

    await writeEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      selectedTagIds: ['tag-a'],
      pendingNoteRelations: [],
      customValues: {},
      pendingEntityRelations: [],
    });
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk unavailable'));
    await expect(
      patchEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
        selectedTagIds: ['tag-b'],
      }),
    ).rejects.toThrow('disk unavailable');
  });

  it('patches an existing draft and no-ops when nothing is stored', async () => {
    await patchEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      pendingEntityRelations: [{ id: 'rel-x' }],
    });
    expect(await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1')).toBeNull();

    await writeEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      selectedTagIds: ['tag-a'],
      pendingNoteRelations: [],
      customValues: { field: 'value' },
      pendingEntityRelations: [{ id: 'rel-1' }],
    });
    await patchEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      pendingEntityRelations: [],
      pendingNoteRelations: [
        {
          id: 'pending-kept',
          storyId: 'story-1',
          noteId: 'note-1',
          relationId: 'char-1',
          relationType: 'Character',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          version: 1,
          isDeleted: false,
          deletedAt: null,
        },
      ],
    });

    const draft = await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    expect(draft?.selectedTagIds).toEqual(['tag-a']);
    expect(draft?.customValues).toEqual({ field: 'value' });
    expect(draft?.pendingEntityRelations).toEqual([]);
    expect(draft?.pendingNoteRelations).toHaveLength(1);
  });

  it('ignores a corrupt stored draft instead of throwing into the form', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await AsyncStorage.setItem(
      'keres:entity-secondary-draft:story-1:Character:char-1',
      'not-json{{{',
    );

    expect(await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1')).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      'Corrupt entity secondary draft ignored:',
      expect.anything(),
    );
  });

  it('surfaces a patch write failure instead of swallowing it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await writeEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      selectedTagIds: ['tag-a'],
      pendingNoteRelations: [],
      customValues: {},
      pendingEntityRelations: [],
    });
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(
      patchEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
        selectedTagIds: ['tag-b'],
      }),
    ).rejects.toThrow('quota exceeded');
  });

  it('serializes concurrent patches so later writes cannot clobber earlier ones', async () => {
    await writeEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      selectedTagIds: [],
      pendingNoteRelations: [],
      customValues: {},
      pendingEntityRelations: [],
    });

    await Promise.all([
      patchEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
        selectedTagIds: ['tag-a'],
      }),
      patchEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
        pendingEntityRelations: [{ id: 'rel-b' }],
      }),
    ]);

    const draft = await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    // Without a per-key lock, both patches can read the empty draft and the last writer
    // drops the other field. Serialization applies both updates.
    expect(draft?.selectedTagIds).toEqual(['tag-a']);
    expect(draft?.pendingEntityRelations).toEqual([{ id: 'rel-b' }]);
  });
});

describe('EntityFormSecondaryDraftStore with a bound database', () => {
  let database: TestDatabase;

  const emptyQueues = {
    selectedTagIds: [] as string[],
    pendingNoteRelations: [],
    customValues: {},
    pendingEntityRelations: [],
  };

  beforeEach(async () => {
    resetEntityFormSecondaryDraftLocksForTests();
    await AsyncStorage.clear();
    database = await createTestDatabase();
    setEditorDraftDb(database.db);
  });

  afterEach(() => {
    resetEditorDraftDbForTests();
    database.close();
  });

  it('round-trips through SQLite instead of AsyncStorage', async () => {
    await writeEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      ...emptyQueues,
      selectedTagIds: ['tag-a'],
    });

    const row = await readEditorDraft(database.db, 'story-1', 'Character', 'char-1', 'secondary');
    expect(JSON.parse(row!.content)).toMatchObject({ selectedTagIds: ['tag-a'] });
    expect(
      await AsyncStorage.getItem('keres:entity-secondary-draft:story-1:Character:char-1'),
    ).toBeNull();

    const draft = await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    expect(draft?.selectedTagIds).toEqual(['tag-a']);

    await patchEntityFormSecondaryDraft('story-1', 'Character', 'char-1', {
      selectedTagIds: ['tag-b'],
    });
    expect(
      (await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1'))?.selectedTagIds,
    ).toEqual(['tag-b']);

    await clearEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    expect(await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1')).toBeNull();
  });

  it('adopts a legacy AsyncStorage draft into SQLite on read', async () => {
    await AsyncStorage.setItem(
      'keres:entity-secondary-draft:story-1:Character:char-1',
      JSON.stringify({ ...emptyQueues, selectedTagIds: ['tag-a'] }),
    );

    const draft = await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1');

    expect(draft?.selectedTagIds).toEqual(['tag-a']);
    const row = await readEditorDraft(database.db, 'story-1', 'Character', 'char-1', 'secondary');
    expect(row).not.toBeNull();
    expect(
      await AsyncStorage.getItem('keres:entity-secondary-draft:story-1:Character:char-1'),
    ).toBeNull();
  });
});

/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearEntityFormSecondaryDraft,
  patchEntityFormSecondaryDraft,
  readEntityFormSecondaryDraft,
  writeEntityFormSecondaryDraft,
} from '../../src/services/storymanagement/EntityFormSecondaryDraftStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
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
});

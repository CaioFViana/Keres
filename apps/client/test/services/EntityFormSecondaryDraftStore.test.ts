/**
 * @jest-environment node
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearEntityFormSecondaryDraft,
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
    });

    const draft = await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    expect(draft?.selectedTagIds).toEqual(['tag-a', 'tag-b']);
    expect(draft?.pendingNoteRelations).toHaveLength(1);
    expect(draft?.customValues).toEqual({ field: 'value' });
    expect(draft?.updatedAt).toEqual(expect.any(String));

    await clearEntityFormSecondaryDraft('story-1', 'Character', 'char-1');
    expect(await readEntityFormSecondaryDraft('story-1', 'Character', 'char-1')).toBeNull();
  });
});

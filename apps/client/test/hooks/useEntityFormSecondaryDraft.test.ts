/** @jest-environment node */
import { act, renderHook } from '@testing-library/react-native';
import {
  clearEntityFormSecondaryDraft,
  writeEntityFormSecondaryDraft,
} from '../../src/services/storymanagement/EntityFormSecondaryDraftStore';
import { useEntityFormSecondaryDraft } from '../../src/hooks/useEntityFormSecondaryDraft';

jest.mock('../../src/services/storymanagement/EntityFormSecondaryDraftStore', () => ({
  __esModule: true,
  writeEntityFormSecondaryDraft: jest.fn(),
  clearEntityFormSecondaryDraft: jest.fn(),
}));

const writeMock = jest.mocked(writeEntityFormSecondaryDraft);
const clearMock = jest.mocked(clearEntityFormSecondaryDraft);

beforeEach(() => {
  jest.clearAllMocks();
});

const baseOptions = {
  storyId: 'story-1',
  entityType: 'Character',
  selectedTagIds: ['tag-a'],
  pendingNoteRelations: [],
  getCustomValues: () => ({ field: 'value' }),
};

describe('useEntityFormSecondaryDraft', () => {
  it('persists the secondary draft with values pulled from the getters', async () => {
    const hook = await renderHook(() =>
      useEntityFormSecondaryDraft({
        ...baseOptions,
        getPendingEntityRelations: () => [{ id: 'rel-1' }],
      }),
    );
    await act(async () => {
      await hook.result.current.persistSecondaryDraft('char-1');
    });
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock).toHaveBeenCalledWith('story-1', 'Character', 'char-1', {
      selectedTagIds: ['tag-a'],
      pendingNoteRelations: [],
      customValues: { field: 'value' },
      pendingEntityRelations: [{ id: 'rel-1' }],
    });
  });

  it('defaults pending entity relations to an empty list without the getter', async () => {
    const hook = await renderHook(() => useEntityFormSecondaryDraft(baseOptions));
    await act(async () => {
      await hook.result.current.persistSecondaryDraft('char-1');
    });
    expect(writeMock).toHaveBeenCalledWith('story-1', 'Character', 'char-1', {
      selectedTagIds: ['tag-a'],
      pendingNoteRelations: [],
      customValues: { field: 'value' },
      pendingEntityRelations: [],
    });
  });

  it('does nothing when the story or entity id is missing', async () => {
    const noStory = await renderHook(() =>
      useEntityFormSecondaryDraft({ ...baseOptions, storyId: undefined }),
    );
    await act(async () => {
      await noStory.result.current.persistSecondaryDraft('char-1');
      await noStory.result.current.clearSecondaryDraft('char-1');
    });
    const hook = await renderHook(() => useEntityFormSecondaryDraft(baseOptions));
    await act(async () => {
      await hook.result.current.persistSecondaryDraft('');
      await hook.result.current.clearSecondaryDraft('');
    });
    expect(writeMock).not.toHaveBeenCalled();
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('clears the secondary draft for the entity', async () => {
    const hook = await renderHook(() => useEntityFormSecondaryDraft(baseOptions));
    await act(async () => {
      await hook.result.current.clearSecondaryDraft('char-1');
    });
    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(clearMock).toHaveBeenCalledWith('story-1', 'Character', 'char-1');
  });
});

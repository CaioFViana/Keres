const mockUseEntityRelations = jest.fn();
const mockGetArcsForStory = jest.fn();

jest.mock('../../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));
jest.mock('../../../../src/services/storymanagement/StoryArcService', () => ({
  createStoryArcService: () => ({ getArcsForStory: mockGetArcsForStory }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useChapterFormAssociations } from '../../../../src/screens/narrative-elements/chapters/useChapterFormAssociations';

const mockSetSelectedTagIds = jest.fn();
const relations = {
  selectedTagIds: ['tag-1'],
  setSelectedTagIds: mockSetSelectedTagIds,
  noteRelations: [{ id: 'note-relation-1' }],
  persistTagRelations: jest.fn(),
};
const fakeDb = { marker: 'db' } as never;

const renderAssociations = async (options: {
  currentChapterId?: string;
  isEditing?: boolean;
  storyId?: string;
  arcs?: object[];
}) => {
  const setArcId = jest.fn();
  if (options.arcs !== undefined) {
    mockGetArcsForStory.mockResolvedValue(options.arcs);
  }
  const view = await renderHook(() =>
    useChapterFormAssociations({
      currentChapterId: options.currentChapterId,
      isEditing: options.isEditing ?? false,
      storyId: 'storyId' in options ? options.storyId : 'story-1',
      drizzleDb: fakeDb,
      setArcId,
    }),
  );
  return { setArcId, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEntityRelations.mockReturnValue(relations);
  mockGetArcsForStory.mockResolvedValue([]);
});

it('wires chapter relations and aliases the note half for the form', async () => {
  const { view } = await renderAssociations({ currentChapterId: 'chapter-1', isEditing: true });

  await waitFor(() => expect(view.result.current.arcs).toEqual([]));

  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'Chapter',
    entityId: 'chapter-1',
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.chapterNoteRelations).toBe(relations.noteRelations);
  expect(view.result.current.selectedTagIds).toEqual(['tag-1']);
});

it('delegates tag selection changes to the relations hook', async () => {
  const { view } = await renderAssociations({});

  await act(async () => {
    view.result.current.handleTagSelectionChange(['tag-2']);
  });

  expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-2']);
});

it('defaults a new chapter to the default arc', async () => {
  const { setArcId, view } = await renderAssociations({
    arcs: [
      { id: 'arc-1', isDefault: false },
      { id: 'arc-2', isDefault: true },
    ],
  });

  await waitFor(() => expect(view.result.current.arcs).toHaveLength(2));

  expect(mockGetArcsForStory).toHaveBeenCalledWith('story-1');
  expect(setArcId).toHaveBeenCalledTimes(1);
  const applyDefault = setArcId.mock.calls[0][0];
  expect(applyDefault(null)).toBe('arc-2');
  expect(applyDefault('arc-kept')).toBe('arc-kept');
});

it('falls back to the first arc, or none when the story has no arcs', async () => {
  const first = await renderAssociations({ arcs: [{ id: 'arc-1' }] });
  await waitFor(() => expect(first.view.result.current.arcs).toHaveLength(1));
  expect(first.setArcId.mock.calls[0][0](null)).toBe('arc-1');

  jest.clearAllMocks();
  mockGetArcsForStory.mockResolvedValue([]);
  const none = await renderAssociations({ arcs: [] });
  await waitFor(() => expect(none.view.result.current.arcs).toEqual([]));
  expect(none.setArcId.mock.calls[0][0](null)).toBeNull();
});

it('leaves the arc alone when editing and skips the lookup without a story', async () => {
  const editing = await renderAssociations({
    currentChapterId: 'chapter-1',
    isEditing: true,
    arcs: [{ id: 'arc-1', isDefault: true }],
  });
  await waitFor(() => expect(editing.view.result.current.arcs).toHaveLength(1));
  expect(editing.setArcId).not.toHaveBeenCalled();

  jest.clearAllMocks();
  await renderAssociations({ storyId: undefined });
  expect(mockGetArcsForStory).not.toHaveBeenCalled();
});

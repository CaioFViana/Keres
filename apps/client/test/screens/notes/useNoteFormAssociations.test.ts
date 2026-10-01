const mockUseEntityRelations = jest.fn();

jest.mock('../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useNoteFormAssociations } from '../../../src/screens/notes/useNoteFormAssociations';

const mockSetSelectedTagIds = jest.fn();
const mockPersistTagRelations = jest.fn();
const relations = {
  availableTags: [{ id: 'tag-1' }],
  selectedTagIds: ['tag-1'],
  setSelectedTagIds: mockSetSelectedTagIds,
  persistTagRelations: mockPersistTagRelations,
  noteRelations: [{ id: 'should-be-hidden' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEntityRelations.mockReturnValue(relations);
});

it('wires tag relations without the note half, since notes cannot attach to notes', async () => {
  const view = await renderHook(() => useNoteFormAssociations({ currentNoteId: 'note-1' }));

  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'Note',
    entityId: 'note-1',
    withNotes: false,
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.availableTags).toBe(relations.availableTags);
  expect(view.result.current.selectedTagIds).toEqual(['tag-1']);
  expect(view.result.current.persistTagRelations).toBe(mockPersistTagRelations);
  expect('noteRelations' in view.result.current).toBe(false);
});

it('delegates tag selection changes to the relations hook', async () => {
  const view = await renderHook(() => useNoteFormAssociations({ currentNoteId: undefined }));

  await act(async () => {
    view.result.current.handleTagSelectionChange(['tag-2']);
  });

  expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-2']);
});

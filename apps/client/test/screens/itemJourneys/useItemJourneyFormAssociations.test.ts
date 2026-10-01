const mockUseEntityRelations = jest.fn();

jest.mock('../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useItemJourneyFormAssociations } from '../../../src/screens/itemJourneys/useItemJourneyFormAssociations';

const stubRelations = () => ({
  availableTags: [],
  selectedTagIds: [],
  setSelectedTagIds: jest.fn(),
  selectedTags: [],
  allNotes: [],
  noteRelations: [{ id: 'note-relation-1' }],
  pendingNoteRelations: [],
  persistTagRelations: jest.fn(),
  saveNoteRelation: jest.fn(),
  deleteNoteRelation: jest.fn(),
  persistNoteRelations: jest.fn(),
  refresh: jest.fn(),
  refreshNotes: jest.fn(),
  refreshNoteRelations: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEntityRelations.mockReturnValue(stubRelations());
});

it('wires the ItemJourney entity id into shared relation state', async () => {
  const view = await renderHook(() => useItemJourneyFormAssociations('journey-1'));

  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'ItemJourney',
    entityId: 'journey-1',
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.itemJourneyNoteRelations).toEqual([{ id: 'note-relation-1' }]);
  expect(view.result.current.noteRelations).toEqual([{ id: 'note-relation-1' }]);
});

it('keeps the creation draft buffered while the journey has no id yet', async () => {
  const view = await renderHook(() => useItemJourneyFormAssociations(undefined));

  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'ItemJourney',
    entityId: undefined,
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.itemJourneyNoteRelations).toEqual([{ id: 'note-relation-1' }]);
});

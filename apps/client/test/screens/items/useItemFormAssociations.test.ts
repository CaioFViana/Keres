const mockUseEntityRelations = jest.fn();
const mockSetSelectedTagIds = jest.fn();
const mockSetCharacterDbAndStoryId = jest.fn();
const mockInitializeCharacterService = jest.fn();
const mockFetchCharacters = jest.fn();
let mockCharacters: { id: string; name: string; isDeleted: boolean }[] = [];

jest.mock('../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));
jest.mock('../../../src/state/characterStore', () => ({
  useCharacterStore: () => ({
    characters: mockCharacters,
    fetchCharacters: mockFetchCharacters,
    setDbAndStoryId: mockSetCharacterDbAndStoryId,
    initializeService: mockInitializeCharacterService,
  }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useItemFormAssociations } from '../../../src/screens/items/useItemFormAssociations';

const stubRelations = () => ({
  availableTags: [],
  selectedTagIds: [],
  setSelectedTagIds: mockSetSelectedTagIds,
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

const renderAssociations = (currentItemId?: string, storyId?: string) =>
  renderHook(() => useItemFormAssociations({ currentItemId, storyId, drizzleDb: {} as never }));

beforeEach(() => {
  jest.clearAllMocks();
  mockCharacters = [];
  mockUseEntityRelations.mockReturnValue(stubRelations());
});

it('wires the Item entity id into shared relation state', async () => {
  const view = await renderAssociations('item-1', 'story-1');

  expect(mockUseEntityRelations).toHaveBeenCalledWith({
    entityType: 'Item',
    entityId: 'item-1',
    preserveDraftOnEntityCreation: true,
  });
  expect(view.result.current.itemNoteRelations).toEqual([{ id: 'note-relation-1' }]);
});

it('initializes the character store once the story is known', async () => {
  await renderAssociations(undefined, 'story-1');

  expect(mockSetCharacterDbAndStoryId).toHaveBeenCalledWith(expect.anything(), 'story-1');
  expect(mockInitializeCharacterService).toHaveBeenCalled();
  expect(mockFetchCharacters).toHaveBeenCalled();
});

it('does not touch the character store without a story', async () => {
  await renderAssociations(undefined, undefined);

  expect(mockFetchCharacters).not.toHaveBeenCalled();
});

it('exposes owner options from live characters only and forwards tag changes', async () => {
  mockCharacters = [
    { id: 'character-1', name: 'Hero', isDeleted: false },
    { id: 'character-2', name: 'Ghost', isDeleted: true },
  ];
  const view = await renderAssociations('item-1', 'story-1');

  expect(view.result.current.characterOptions).toEqual([{ label: 'Hero', value: 'character-1' }]);

  await act(async () => {
    view.result.current.handleTagSelectionChange(['tag-1']);
  });
  expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-1']);
});

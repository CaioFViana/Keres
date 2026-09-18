const mockUseEntityRelations = jest.fn();
const mockSetSelectedTagIds = jest.fn();
const mockAlert = jest.fn();
const mockEmit = jest.fn();
const mockReadDraft = jest.fn();
const mockPatchDraft = jest.fn();
let mockModes: { id: string; characterId: string }[] = [];

jest.mock('../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));
jest.mock('../../../src/hooks/useStoryStats', () => ({
  useStoryStats: () => ({ modes: mockModes }),
}));
jest.mock('../../../src/services/storymanagement/ModeService', () => ({
  createModeService: jest.fn(() => ({ id: 'mode-service' })),
}));
jest.mock('../../../src/services/storymanagement/StatRelationService', () => ({
  createStatRelationService: jest.fn(() => ({ id: 'stat-relation-service' })),
}));
jest.mock('../../../src/services/storymanagement/EntityFormSecondaryDraftStore', () => ({
  readEntityFormSecondaryDraft: (...args: unknown[]) => mockReadDraft(...args),
  patchEntityFormSecondaryDraft: (...args: unknown[]) => mockPatchDraft(...args),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/utils/EventEmitter', () => ({
  entityEventEmitter: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import { useCharacterFormAssociations } from '../../../src/screens/characters/useCharacterFormAssociations';

const stubRelations = () => ({
  availableTags: [],
  selectedTagIds: [],
  setSelectedTagIds: mockSetSelectedTagIds,
  selectedTags: [],
  allNotes: [],
  noteRelations: [],
  pendingNoteRelations: [],
  persistTagRelations: jest.fn(),
  saveNoteRelation: jest.fn(),
  deleteNoteRelation: jest.fn(),
  persistNoteRelations: jest.fn(),
  refresh: jest.fn(),
  refreshNotes: jest.fn(),
  refreshNoteRelations: jest.fn(),
});

const relation = (partial: Partial<CharacterRelation> = {}): CharacterRelation =>
  ({
    id: 'relation-1',
    character1Id: 'character-1',
    character2Id: 'character-2',
    storyId: 'story-1',
    ...partial,
  }) as CharacterRelation;

const renderAssociations = async (options?: {
  initialCharacterId?: string;
  currentCharacterId?: string;
  characters?: object[];
  relations?: CharacterRelation[];
  onSecondaryDraftRestored?: () => void;
}) => {
  const getAllByStoryId = jest.fn().mockResolvedValue(options?.characters ?? []);
  const getRelationsForCharacter = jest.fn().mockResolvedValue(options?.relations ?? []);
  const saveCharacterRelation = jest.fn(async (_userId: string, rel: CharacterRelation) => rel);
  const deleteCharacterRelation = jest.fn(async () => true);
  const characterServiceRef = { current: { getAllByStoryId } as never };
  const characterRelationServiceRef = {
    current: { getRelationsForCharacter, saveCharacterRelation, deleteCharacterRelation } as never,
  };
  const view = await renderHook(() =>
    useCharacterFormAssociations({
      initialCharacterId: options?.initialCharacterId,
      currentCharacterId: options?.currentCharacterId,
      storyId: 'story-1',
      userId: 'user-1',
      drizzleDb: {} as never,
      characterServiceRef,
      characterRelationServiceRef,
      onSecondaryDraftRestored: options?.onSecondaryDraftRestored,
    }),
  );
  return {
    getAllByStoryId,
    getRelationsForCharacter,
    saveCharacterRelation,
    deleteCharacterRelation,
    view,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockModes = [];
  mockUseEntityRelations.mockReturnValue(stubRelations());
  mockReadDraft.mockResolvedValue(null);
  mockPatchDraft.mockResolvedValue(undefined);
});

it('loads live characters, relations and only the current character modes', async () => {
  mockModes = [
    { id: 'mode-1', characterId: 'character-1' },
    { id: 'mode-2', characterId: 'character-9' },
  ];
  const { getAllByStoryId, getRelationsForCharacter, view } = await renderAssociations({
    currentCharacterId: 'character-1',
    characters: [
      { id: 'character-1', name: 'Hero', isDeleted: false },
      { id: 'character-2', name: 'Ghost', isDeleted: true },
    ],
    relations: [relation()],
  });

  await waitFor(() => expect(getAllByStoryId).toHaveBeenCalledWith('story-1'));
  await waitFor(() =>
    expect(getRelationsForCharacter).toHaveBeenCalledWith('story-1', 'character-1'),
  );

  expect(view.result.current.allCharacters.map((c) => c.id)).toEqual(['character-1']);
  expect(view.result.current.characterRelations).toHaveLength(1);
  expect(view.result.current.characterModes.map((m) => m.id)).toEqual(['mode-1']);
  expect(view.result.current.characterNoteRelations).toEqual([]);
});

it('queues relations locally while the character does not exist yet', async () => {
  const { saveCharacterRelation, view } = await renderAssociations();
  const pending = relation({ id: 'pending-1', character1Id: '' });

  await act(async () => {
    await view.result.current.handleSaveRelation(pending);
  });

  expect(saveCharacterRelation).not.toHaveBeenCalled();
  expect(view.result.current.pendingCharacterRelations).toEqual([pending]);
  expect(view.result.current.characterRelations).toEqual([pending]);
  expect(mockAlert).toHaveBeenCalledWith('success', 'relation_saved_successfully');
});

it('persists relations through the service once the character exists', async () => {
  const { saveCharacterRelation, view } = await renderAssociations({
    initialCharacterId: 'character-1',
    currentCharacterId: 'character-1',
  });

  await act(async () => {
    await view.result.current.handleSaveRelation(relation());
  });

  expect(saveCharacterRelation).toHaveBeenCalledWith('user-1', relation());
  expect(mockEmit).toHaveBeenCalledWith('character_relation_changed', 'story-1', 'character-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'relation_saved_successfully');
});

it('deletes persisted relations through the service and refreshes the list', async () => {
  const { deleteCharacterRelation, view } = await renderAssociations({
    initialCharacterId: 'character-1',
    currentCharacterId: 'character-1',
    relations: [relation()],
  });
  await waitFor(() => expect(view.result.current.characterRelations).toHaveLength(1));

  await act(async () => {
    await view.result.current.handleDeleteRelation('relation-1');
  });

  expect(deleteCharacterRelation).toHaveBeenCalledWith('user-1', 'relation-1');
  expect(view.result.current.characterRelations).toEqual([]);
  expect(mockEmit).toHaveBeenCalledWith('character_relation_changed', 'story-1', 'character-1');
});

it('replays pending relations against the retained id after creation', async () => {
  const { saveCharacterRelation, view } = await renderAssociations();
  await act(async () => {
    await view.result.current.handleSaveRelation(relation({ id: 'pending-1', character1Id: '' }));
  });

  await act(async () => {
    await view.result.current.persistPendingCharacterRelations('character-created');
  });

  expect(saveCharacterRelation).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ character1Id: 'character-created', character2Id: 'character-2' }),
  );
  expect(view.result.current.pendingCharacterRelations).toEqual([]);
  expect(mockEmit).toHaveBeenCalledWith(
    'character_relation_changed',
    'story-1',
    'character-created',
  );
});

it('restores durable pending relations and forwards tag changes', async () => {
  mockReadDraft.mockResolvedValue({ pendingEntityRelations: [relation({ id: 'draft-1' })] });
  const onSecondaryDraftRestored = jest.fn();
  const { view } = await renderAssociations({
    initialCharacterId: 'character-1',
    currentCharacterId: 'character-1',
    onSecondaryDraftRestored,
  });

  await waitFor(() =>
    expect(view.result.current.pendingCharacterRelations.map((r) => r.id)).toEqual(['draft-1']),
  );
  expect(onSecondaryDraftRestored).toHaveBeenCalled();

  await act(async () => {
    view.result.current.handleTagSelectionChange(['tag-1']);
  });
  expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-1']);
});

const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();
const mockEmit = jest.fn();
const mockSaveEntityWithSecondaryData = jest.fn();
const mockSaveValuesForEntity = jest.fn();
const mockValidateRequired = jest.fn();

jest.mock('@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields', () => ({
  validateRequiredCustomAttributes: (...args: unknown[]) => mockValidateRequired(...args),
}));
jest.mock('@/src/hooks/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    pending: false,
    run: (operation: () => Promise<void>) => operation(),
  }),
}));
jest.mock('../../../src/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ saveValuesForEntity: mockSaveValuesForEntity }),
}));
jest.mock('../../../src/services/storymanagement/EntityFormSaveCoordinator', () => ({
  saveEntityWithSecondaryData: (...args: unknown[]) => mockSaveEntityWithSecondaryData(...args),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/utils/EventEmitter', () => ({
  entityEventEmitter: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  useVocabularyEntityCopy: () => ({
    created: 'created',
    updated: 'updated',
    deleted: 'deleted',
    deleteLabel: 'delete',
    deleteMessage: 'delete message',
    failedToDelete: 'delete failed',
    failedToSave: 'save failed',
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useCharacterFormActions } from '../../../src/screens/characters/useCharacterFormActions';
import type { CharacterFormState } from '../../../src/screens/characters/useCharacterFormState';
import type { CharacterService } from '../../../src/services/storymanagement/CharacterService';

const createState = (overrides: Partial<CharacterFormState> = {}): CharacterFormState =>
  ({
    currentCharacterId: undefined,
    retainPersistedCharacterId: jest.fn(),
    name: 'Ada',
    setName: jest.fn(),
    title: null,
    setTitle: jest.fn(),
    description: null,
    setDescription: jest.fn(),
    gender: null,
    setGender: jest.fn(),
    race: null,
    setRace: jest.fn(),
    subrace: null,
    setSubrace: jest.fn(),
    personality: null,
    setPersonality: jest.fn(),
    motivation: null,
    setMotivation: jest.fn(),
    qualities: null,
    setQualities: jest.fn(),
    weaknesses: null,
    setWeaknesses: jest.fn(),
    biography: null,
    setBiography: jest.fn(),
    plannedTimeline: null,
    setPlannedTimeline: jest.fn(),
    isFavorite: false,
    setIsFavorite: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    customValues: {},
    setCustomValues: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as CharacterFormState;

const characterService = {
  createCharacter: jest.fn(),
  updateCharacter: jest.fn(),
  deleteCharacter: jest.fn(),
} as unknown as CharacterService;
const navigation = {
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();
const persistNoteRelations = jest.fn();
const persistPendingCharacterRelations = jest.fn();

const renderActions = (state = createState()) =>
  renderHook(() =>
    useCharacterFormActions({
      state,
      customFields: [],
      drizzleDb: {} as never,
      characterServiceRef: { current: characterService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      persistTagRelations,
      persistNoteRelations,
      persistPendingCharacterRelations,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateRequired.mockReturnValue(undefined);
  mockSaveValuesForEntity.mockResolvedValue(undefined);
  persistTagRelations.mockResolvedValue(undefined);
  persistNoteRelations.mockResolvedValue(undefined);
  persistPendingCharacterRelations.mockResolvedValue(undefined);
  (characterService.deleteCharacter as jest.Mock).mockResolvedValue(undefined);
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('character-1');
    await options.persistSecondaryData('character-1');
    return { entityId: 'character-1', created: true };
  });
});

it('rejects an unnamed character before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'name_required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('coordinates persistence, notification and replacement after creation', async () => {
  const state = createState({ customValues: { field: 'value' } });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.retainPersistedCharacterId).toHaveBeenCalledWith('character-1');
  expect(persistTagRelations).toHaveBeenCalledWith('character-1');
  expect(persistNoteRelations).toHaveBeenCalledWith('character-1');
  expect(persistPendingCharacterRelations).toHaveBeenCalledWith('character-1');
  expect(mockSaveValuesForEntity).toHaveBeenCalledWith(
    'user-1',
    'story-1',
    'Character',
    'character-1',
    { field: 'value' },
  );
  expect(mockEmit).toHaveBeenCalledWith('character_changed', 'story-1', 'character-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'created');
  expect(navigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ name: 'CharacterForm' }) }),
  );
});

it('delegates deletion and completes it with an event and back navigation', async () => {
  const view = await renderActions(
    createState({ currentCharacterId: 'character-1', isEditing: true }),
  );

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(characterService.deleteCharacter).toHaveBeenCalledWith('user-1', 'character-1');
  expect(mockEmit).toHaveBeenCalledWith('character_changed', 'story-1', 'character-1');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not emit success after a secondary-write failure, then recovers on retry', async () => {
  const state = createState();
  let attempt = 0;
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('character-1');
    if (attempt === 0) {
      attempt += 1;
      throw new Error('secondary failed');
    }
    await options.persistSecondaryData('character-1');
    return { entityId: 'character-1', created: false };
  });

  const view = await renderActions(state);
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
  expect(mockEmit).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(state.retainPersistedCharacterId).toHaveBeenCalledWith('character-1');
  expect(mockEmit).toHaveBeenCalledWith('character_changed', 'story-1', 'character-1');
  expect(mockAlert).toHaveBeenCalledWith('success', expect.any(String));
});

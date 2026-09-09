const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();
const mockEmit = jest.fn();
const mockSaveEntityWithSecondaryData = jest.fn();

jest.mock('@/src/hooks/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    pending: false,
    run: (operation: () => Promise<void>) => operation(),
  }),
}));
jest.mock('../../../src/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => mockConfirmDelete,
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
    itemJourney: 'Journey',
    required: 'item required',
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useItemJourneyFormActions } from '../../../src/screens/itemJourneys/useItemJourneyFormActions';
import type { ItemJourneyFormState } from '../../../src/screens/itemJourneys/useItemJourneyFormState';
import type { ItemJourneyService } from '../../../src/services/storymanagement/ItemJourneyService';

const createState = (overrides: Partial<ItemJourneyFormState> = {}): ItemJourneyFormState =>
  ({
    currentItemJourneyId: undefined,
    retainPersistedItemJourneyId: jest.fn(),
    itemId: 'item-1',
    setItemId: jest.fn(),
    sceneId: 'scene-1',
    setSceneId: jest.fn(),
    newCharacterOwnerId: null,
    setNewCharacterOwnerId: jest.fn(),
    newState: 'found',
    setNewState: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as ItemJourneyFormState;

const itemJourneyService = {
  createItemJourney: jest.fn(),
  updateItemJourney: jest.fn(),
  deleteItemJourney: jest.fn(),
} as unknown as ItemJourneyService;
const navigation = {
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();
const persistNoteRelations = jest.fn();

const renderActions = (state = createState()) =>
  renderHook(() =>
    useItemJourneyFormActions({
      state,
      itemJourneyServiceRef: { current: itemJourneyService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      persistTagRelations,
      persistNoteRelations,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  persistTagRelations.mockResolvedValue(undefined);
  persistNoteRelations.mockResolvedValue(undefined);
  (itemJourneyService.deleteItemJourney as jest.Mock).mockResolvedValue(undefined);
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('item-journey-1');
    await options.persistSecondaryData('item-journey-1');
    return { entityId: 'item-journey-1', created: true };
  });
});

it('rejects an item journey without an item before persistence', async () => {
  const view = await renderActions(createState({ itemId: null }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'item required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('rejects an item journey without a scene before persistence', async () => {
  const view = await renderActions(createState({ sceneId: null }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'scene_required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('rejects an item journey without a new state before persistence', async () => {
  const view = await renderActions(createState({ newState: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'new_state_required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('coordinates persistence, notification and replacement after creation', async () => {
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.retainPersistedItemJourneyId).toHaveBeenCalledWith('item-journey-1');
  expect(persistTagRelations).toHaveBeenCalledWith('item-journey-1');
  expect(persistNoteRelations).toHaveBeenCalledWith('item-journey-1');
  expect(mockEmit).toHaveBeenCalledWith('item_journey_changed', 'story-1', 'item-journey-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'vocabulary_entity_created:Journey');
  expect(navigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ name: 'ItemJourneyForm' }) }),
  );
});

it('delegates deletion and completes it with an event and back navigation', async () => {
  const view = await renderActions(
    createState({ currentItemJourneyId: 'item-journey-1', isEditing: true }),
  );

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(itemJourneyService.deleteItemJourney).toHaveBeenCalledWith('user-1', 'item-journey-1');
  expect(mockEmit).toHaveBeenCalledWith('item_journey_changed', 'story-1', 'item-journey-1');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not emit success after a secondary-write failure, then recovers on retry', async () => {
  const state = createState();
  let attempt = 0;
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('item-journey-1');
    if (attempt === 0) {
      attempt += 1;
      throw new Error('secondary failed');
    }
    await options.persistSecondaryData('item-journey-1');
    return { entityId: 'item-journey-1', created: false };
  });

  const view = await renderActions(state);
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith(
    'error',
    'vocabulary_failed_to_save_entity:Journey',
  );
  expect(mockEmit).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(state.retainPersistedItemJourneyId).toHaveBeenCalledWith('item-journey-1');
  expect(mockEmit).toHaveBeenCalledWith('item_journey_changed', 'story-1', 'item-journey-1');
  expect(mockAlert).toHaveBeenCalledWith('success', expect.any(String));
});

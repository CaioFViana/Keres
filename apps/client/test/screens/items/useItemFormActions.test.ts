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
    required: 'name required',
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useItemFormActions } from '../../../src/screens/items/useItemFormActions';
import type { ItemFormState } from '../../../src/screens/items/useItemFormState';
import type { ItemService } from '../../../src/services/storymanagement/ItemService';

const createState = (overrides: Partial<ItemFormState> = {}): ItemFormState =>
  ({
    currentItemId: undefined,
    retainPersistedItemId: jest.fn(),
    name: 'Sword',
    setName: jest.fn(),
    category: null,
    setCategory: jest.fn(),
    description: null,
    setDescription: jest.fn(),
    initialState: null,
    setInitialState: jest.fn(),
    isFavorite: false,
    setIsFavorite: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    characterOwnerId: null,
    setCharacterOwnerId: jest.fn(),
    customValues: {},
    setCustomValues: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as ItemFormState;

const itemService = {
  createItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
} as unknown as ItemService;
const navigation = {
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();
const persistNoteRelations = jest.fn();

const renderActions = (state = createState()) =>
  renderHook(() =>
    useItemFormActions({
      state,
      customFields: [],
      drizzleDb: {} as never,
      itemServiceRef: { current: itemService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      persistTagRelations,
      persistNoteRelations,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateRequired.mockReturnValue(undefined);
  mockSaveValuesForEntity.mockResolvedValue(undefined);
  persistTagRelations.mockResolvedValue(undefined);
  persistNoteRelations.mockResolvedValue(undefined);
  (itemService.deleteItem as jest.Mock).mockResolvedValue(undefined);
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('item-1');
    await options.persistSecondaryData('item-1');
    return { entityId: 'item-1', created: true };
  });
});

it('rejects an unnamed item before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'name required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('coordinates persistence, notification and replacement after creation', async () => {
  const state = createState({ customValues: { field: 'value' } });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.retainPersistedItemId).toHaveBeenCalledWith('item-1');
  expect(persistTagRelations).toHaveBeenCalledWith('item-1');
  expect(persistNoteRelations).toHaveBeenCalledWith('item-1');
  expect(mockSaveValuesForEntity).toHaveBeenCalledWith(
    'user-1',
    'story-1',
    'Item',
    'item-1',
    { field: 'value' },
  );
  expect(mockEmit).toHaveBeenCalledWith('item_changed', 'story-1', 'item-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'created');
  expect(navigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ name: 'ItemForm' }) }),
  );
});

it('delegates deletion and completes it with an event and back navigation', async () => {
  const view = await renderActions(createState({ currentItemId: 'item-1', isEditing: true }));

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(itemService.deleteItem).toHaveBeenCalledWith('user-1', 'item-1');
  expect(mockEmit).toHaveBeenCalledWith('item_changed', 'story-1', 'item-1');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not emit success after a secondary-write failure, then recovers on retry', async () => {
  const state = createState();
  let attempt = 0;
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('item-1');
    if (attempt === 0) {
      attempt += 1;
      throw new Error('secondary failed');
    }
    await options.persistSecondaryData('item-1');
    return { entityId: 'item-1', created: false };
  });

  const view = await renderActions(state);
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
  expect(mockEmit).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(state.retainPersistedItemId).toHaveBeenCalledWith('item-1');
  expect(mockEmit).toHaveBeenCalledWith('item_changed', 'story-1', 'item-1');
  expect(mockAlert).toHaveBeenCalledWith('success', expect.any(String));
});

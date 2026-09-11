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
import { useLocationFormActions } from '../../../src/screens/locations/useLocationFormActions';
import type { LocationFormState } from '../../../src/screens/locations/useLocationFormState';
import type { LocationService } from '../../../src/services/storymanagement/LocationService';

const createState = (overrides: Partial<LocationFormState> = {}): LocationFormState =>
  ({
    currentLocationId: undefined,
    retainPersistedLocationId: jest.fn(),
    name: 'Rivendell',
    setName: jest.fn(),
    description: null,
    setDescription: jest.fn(),
    isFavorite: false,
    setIsFavorite: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    customValues: {},
    setCustomValues: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as LocationFormState;

const locationService = {
  createLocation: jest.fn(),
  updateLocation: jest.fn(),
  deleteLocation: jest.fn(),
} as unknown as LocationService;
const navigation = {
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();
const persistNoteRelations = jest.fn();
const persistPendingLocationRelations = jest.fn();

const renderActions = (state = createState()) =>
  renderHook(() =>
    useLocationFormActions({
      state,
      customFields: [],
      drizzleDb: {} as never,
      locationServiceRef: { current: locationService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      persistTagRelations,
      persistNoteRelations,
      persistPendingLocationRelations,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateRequired.mockReturnValue(undefined);
  mockSaveValuesForEntity.mockResolvedValue(undefined);
  persistTagRelations.mockResolvedValue(undefined);
  persistNoteRelations.mockResolvedValue(undefined);
  persistPendingLocationRelations.mockResolvedValue(undefined);
  (locationService.deleteLocation as jest.Mock).mockResolvedValue(undefined);
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('location-1');
    await options.persistSecondaryData('location-1');
    return { entityId: 'location-1', created: true };
  });
});

it('rejects an unnamed location before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'name_required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('coordinates persistence and retains identity before secondary writes complete', async () => {
  const state = createState({ customValues: { field: 'value' } });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.retainPersistedLocationId).toHaveBeenCalledWith('location-1');
  expect(persistTagRelations).toHaveBeenCalledWith('location-1');
  expect(persistNoteRelations).toHaveBeenCalledWith('location-1');
  expect(persistPendingLocationRelations).toHaveBeenCalledWith('location-1');
  expect(mockEmit).toHaveBeenCalledWith('location_changed', 'story-1', 'location-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'created');
});

it('retries after a secondary failure without signalling success on the first attempt', async () => {
  const state = createState();
  let attempt = 0;
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('location-1');
    if (attempt === 0) {
      attempt += 1;
      throw new Error('secondary failed');
    }
    await options.persistSecondaryData('location-1');
    return { entityId: 'location-1', created: false };
  });

  const view = await renderActions(state);
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
  expect(mockEmit).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(state.retainPersistedLocationId).toHaveBeenCalledWith('location-1');
  expect(mockAlert).toHaveBeenCalledWith('success', expect.any(String));
});

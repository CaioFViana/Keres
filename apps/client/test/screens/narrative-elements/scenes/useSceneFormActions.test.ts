const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();
const mockEmit = jest.fn();
const mockSaveSceneWithRelations = jest.fn();
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
jest.mock('../../../../src/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ saveValuesForEntity: mockSaveValuesForEntity }),
}));
jest.mock('../../../../src/services/storymanagement/SceneSaveCoordinator', () => ({
  saveSceneWithRelations: (...args: unknown[]) => mockSaveSceneWithRelations(...args),
}));
jest.mock('../../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../../src/utils/EventEmitter', () => ({
  entityEventEmitter: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('../../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  useVocabularyEntityCopy: () => ({
    created: 'created',
    updated: 'updated',
    deleted: 'deleted',
    deleteLabel: 'delete',
    deleteMessage: 'delete message',
    failedToDelete: 'delete failed',
    failedToSave: 'save failed',
    notFound: 'not found',
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@keres/shared', () => ({
  parseCalendarDateCoordinate: jest.fn(() => ({ year: 1, month: 1, day: 1 })),
}));

import { act, renderHook } from '@testing-library/react-native';
import type { SceneService } from '../../../../src/services/storymanagement/SceneService';
import { useSceneFormActions } from '../../../../src/screens/narrative-elements/scenes/useSceneFormActions';
import type { SceneFormState } from '../../../../src/screens/narrative-elements/scenes/useSceneFormState';

const createState = (overrides: Partial<SceneFormState> = {}): SceneFormState =>
  ({
    currentSceneId: undefined,
    setCurrentSceneId: jest.fn(),
    chapterId: null,
    setChapterId: jest.fn(),
    locationId: null,
    setLocationId: jest.fn(),
    name: 'Arrival',
    setName: jest.fn(),
    summary: null,
    setSummary: jest.fn(),
    isFavorite: false,
    setIsFavorite: jest.fn(),
    extraNotes: null,
    setExtraNotes: jest.fn(),
    gapInput: '',
    setGapInput: jest.fn(),
    gapType: null,
    setGapType: jest.fn(),
    calendarDateOverride: '',
    setCalendarDateOverride: jest.fn(),
    calendarDateOverrideCalendarId: null,
    setCalendarDateOverrideCalendarId: jest.fn(),
    durationInput: '',
    setDurationInput: jest.fn(),
    durationType: null,
    setDurationType: jest.fn(),
    isStart: false,
    setIsStart: jest.fn(),
    isFinish: false,
    setIsFinish: jest.fn(),
    customValues: {},
    setCustomValues: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as SceneFormState;

const sceneService = {
  deleteScene: jest.fn(),
} as unknown as SceneService;
const navigation = {
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();
const persistNoteRelations = jest.fn();
const persistCharacterRelations = jest.fn();

const renderActions = (state = createState()) =>
  renderHook(() =>
    useSceneFormActions({
      state,
      customFields: [],
      drizzleDb: {} as never,
      sceneServiceRef: { current: sceneService },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
      persistTagRelations,
      persistNoteRelations,
      persistCharacterRelations,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateRequired.mockReturnValue(undefined);
  mockSaveValuesForEntity.mockResolvedValue(undefined);
  persistTagRelations.mockResolvedValue(undefined);
  persistNoteRelations.mockResolvedValue(undefined);
  persistCharacterRelations.mockResolvedValue(undefined);
  (sceneService.deleteScene as jest.Mock).mockResolvedValue(undefined);
  mockSaveSceneWithRelations.mockImplementation(async (options) => {
    options.onScenePersisted('scene-1');
    await options.persistRelations('scene-1');
    await options.persistCustomAttributes('scene-1');
    return { sceneId: 'scene-1', created: true };
  });
});

it('rejects an unnamed scene before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'name_required');
  expect(mockSaveSceneWithRelations).not.toHaveBeenCalled();
});

it('coordinates persistence, notification and replacement after creation', async () => {
  const state = createState({ customValues: { field: 'value' } });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.setCurrentSceneId).toHaveBeenCalledWith('scene-1');
  expect(persistTagRelations).toHaveBeenCalledWith('scene-1');
  expect(persistNoteRelations).toHaveBeenCalledWith('scene-1');
  expect(persistCharacterRelations).toHaveBeenCalledWith('scene-1');
  expect(mockSaveValuesForEntity).toHaveBeenCalledWith(
    'user-1',
    'story-1',
    'Scene',
    'scene-1',
    { field: 'value' },
  );
  expect(mockEmit).toHaveBeenCalledWith('scene_changed', 'story-1', 'scene-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'created');
  expect(navigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ name: 'SceneForm' }) }),
  );
});

it('delegates deletion and completes it with an event and back navigation', async () => {
  const view = await renderActions(createState({ currentSceneId: 'scene-1', isEditing: true }));

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(sceneService.deleteScene).toHaveBeenCalledWith('user-1', 'scene-1');
  expect(mockEmit).toHaveBeenCalledWith('scene_changed', 'story-1', 'scene-1');
  expect(navigation.goBack).toHaveBeenCalled();
});

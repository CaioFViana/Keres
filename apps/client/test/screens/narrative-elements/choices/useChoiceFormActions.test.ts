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
jest.mock('../../../../src/hooks/useConfirmDelete', () => ({
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../../src/services/storymanagement/EntityFormSaveCoordinator', () => ({
  saveEntityWithSecondaryData: (...args: unknown[]) => mockSaveEntityWithSecondaryData(...args),
}));
jest.mock('../../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../../src/utils/EventEmitter', () => ({
  entityEventEmitter: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('../../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  useVocabularyEntityCopy: (entity: string) =>
    entity === 'Scene'
      ? { required: 'scene required' }
      : {
          created: 'created',
          updated: 'updated',
          deleted: 'deleted',
          deleteLabel: 'delete',
          deleteMessage: 'delete message',
          failedToDelete: 'delete failed',
          failedToSave: 'save failed',
        },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useChoiceFormActions } from '../../../../src/screens/narrative-elements/choices/useChoiceFormActions';
import type { ChoiceFormState } from '../../../../src/screens/narrative-elements/choices/useChoiceFormState';
import type { ChoiceService } from '../../../../src/services/storymanagement/ChoiceService';

const createState = (overrides: Partial<ChoiceFormState> = {}): ChoiceFormState =>
  ({
    currentChoiceId: undefined,
    retainPersistedChoiceId: jest.fn(),
    sceneId: 'scene-1',
    setSceneId: jest.fn(),
    nextSceneId: 'scene-2',
    setNextSceneId: jest.fn(),
    text: 'Go north',
    setText: jest.fn(),
    notes: null,
    setNotes: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as ChoiceFormState;

const choiceService = {
  createChoice: jest.fn(),
  updateChoice: jest.fn(),
  deleteChoice: jest.fn(),
} as unknown as ChoiceService;
const navigation = {
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();
const persistNoteRelations = jest.fn();

const renderActions = (
  state = createState(),
  overrides: { storyId?: string; userId?: string | null; service?: ChoiceService | null } = {},
) =>
  renderHook(() =>
    useChoiceFormActions({
      state,
      choiceServiceRef: {
        current: overrides.service === undefined ? choiceService : overrides.service,
      },
      navigation: navigation as never,
      storyId: 'storyId' in overrides ? overrides.storyId : 'story-1',
      userId: 'userId' in overrides ? overrides.userId : 'user-1',
      persistTagRelations,
      persistNoteRelations,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  persistTagRelations.mockResolvedValue(undefined);
  persistNoteRelations.mockResolvedValue(undefined);
  (choiceService.deleteChoice as jest.Mock).mockResolvedValue(undefined);
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('choice-1');
    await options.persistSecondaryData('choice-1');
    return { entityId: 'choice-1', created: true };
  });
});

it('rejects a choice without text before persistence', async () => {
  const view = await renderActions(createState({ text: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'text_required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('rejects a choice without a scene before persistence', async () => {
  const view = await renderActions(createState({ sceneId: null }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'scene required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('rejects a choice without a next scene before persistence', async () => {
  const view = await renderActions(createState({ nextSceneId: null }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'next_scene_required');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('coordinates persistence, notification and replacement after creation', async () => {
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(state.retainPersistedChoiceId).toHaveBeenCalledWith('choice-1');
  expect(persistTagRelations).toHaveBeenCalledWith('choice-1');
  expect(persistNoteRelations).toHaveBeenCalledWith('choice-1');
  expect(mockEmit).toHaveBeenCalledWith('choice_changed', 'story-1', 'choice-1');
  expect(mockAlert).toHaveBeenCalledWith('success', 'created');
  expect(navigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ name: 'ChoiceForm' }) }),
  );
});

it('delegates deletion and completes it with an event and back navigation', async () => {
  const view = await renderActions(createState({ currentChoiceId: 'choice-1', isEditing: true }));

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(choiceService.deleteChoice).toHaveBeenCalledWith('user-1', 'choice-1');
  expect(mockEmit).toHaveBeenCalledWith('choice_changed', 'story-1', 'choice-1');
  expect(navigation.goBack).toHaveBeenCalled();
});

it('does not emit success after a secondary-write failure, then recovers on retry', async () => {
  const state = createState();
  let attempt = 0;
  mockSaveEntityWithSecondaryData.mockImplementation(async (options) => {
    options.onEntityPersisted('choice-1');
    if (attempt === 0) {
      attempt += 1;
      throw new Error('secondary failed');
    }
    await options.persistSecondaryData('choice-1');
    return { entityId: 'choice-1', created: false };
  });

  const view = await renderActions(state);
  await act(async () => view.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
  expect(mockEmit).not.toHaveBeenCalled();

  mockAlert.mockClear();
  await act(async () => view.result.current.handleSave());
  expect(state.retainPersistedChoiceId).toHaveBeenCalledWith('choice-1');
  expect(mockEmit).toHaveBeenCalledWith('choice_changed', 'story-1', 'choice-1');
  expect(mockAlert).toHaveBeenCalledWith('success', expect.any(String));
});

it('rejects a save without a user, story, or service', async () => {
  const noUser = await renderActions(createState(), { userId: undefined });
  await act(async () => noUser.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'user_not_identified');

  const noStory = await renderActions(createState(), { storyId: undefined });
  await act(async () => noStory.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'no_story_selected');

  const noService = await renderActions(createState(), { service: null });
  await act(async () => noService.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
  expect(mockSaveEntityWithSecondaryData).not.toHaveBeenCalled();
});

it('creates through the service with trimmed text and notes', async () => {
  (choiceService.createChoice as jest.Mock).mockResolvedValue({ id: 'choice-1' });
  const view = await renderActions(createState({ text: '  Go north  ', notes: '  Padded  ' }));

  await act(async () => view.result.current.handleSave());

  const options = mockSaveEntityWithSecondaryData.mock.calls[0][0];
  await act(async () => options.createEntity());
  expect(choiceService.createChoice).toHaveBeenCalledWith('user-1', {
    storyId: 'story-1',
    sceneId: 'scene-1',
    nextSceneId: 'scene-2',
    text: 'Go north',
    notes: 'Padded',
  });
});

it('nulls blank notes on create', async () => {
  (choiceService.createChoice as jest.Mock).mockResolvedValue({ id: 'choice-1' });
  const view = await renderActions(createState({ notes: '   ' }));

  await act(async () => view.result.current.handleSave());

  const options = mockSaveEntityWithSecondaryData.mock.calls[0][0];
  await act(async () => options.createEntity());
  expect(choiceService.createChoice).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ notes: null }),
  );
});

it('updates through the service for a persisted choice', async () => {
  (choiceService.updateChoice as jest.Mock).mockResolvedValue(undefined);
  const view = await renderActions(createState({ currentChoiceId: 'choice-1', isEditing: true }));

  await act(async () => view.result.current.handleSave());

  const options = mockSaveEntityWithSecondaryData.mock.calls[0][0];
  await act(async () => options.updateEntity('choice-1'));
  expect(choiceService.updateChoice).toHaveBeenCalledWith('user-1', 'choice-1', {
    sceneId: 'scene-1',
    nextSceneId: 'scene-2',
    text: 'Go north',
    notes: null,
  });
});

it('rejects deletion without a user, id, or service', async () => {
  const noUser = await renderActions(createState({ currentChoiceId: 'choice-1' }), {
    userId: undefined,
  });
  await act(async () => noUser.result.current.handleDelete());
  expect(mockAlert).toHaveBeenCalledWith('error', 'user_not_identified');

  const noId = await renderActions(createState());
  await act(async () => noId.result.current.handleDelete());
  const noService = await renderActions(createState({ currentChoiceId: 'choice-1' }), {
    service: null,
  });
  await act(async () => noService.result.current.handleDelete());
  expect(mockConfirmDelete).not.toHaveBeenCalled();
});

const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();
const mockEmit = jest.fn();
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
    retainPersistedSceneId: jest.fn(),
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
    clearFormDraft: jest.fn().mockResolvedValue(undefined),
    draftRestored: false,
    ...overrides,
  }) as SceneFormState;

const sceneService = {
  getById: jest.fn(),
  createScene: jest.fn(),
  updateScene: jest.fn(),
  deleteScene: jest.fn(),
};
const navigation = {
  dispatch: jest.fn(),
  goBack: jest.fn(),
};
const persistTagRelations = jest.fn();
const persistNoteRelations = jest.fn();
const persistCharacterRelations = jest.fn();
const persistSecondaryDraft = jest.fn();
const clearSecondaryDraft = jest.fn();
const persistPending = jest.fn();

type RenderOptions = {
  storyId?: string;
  userId?: string | null;
  service?: SceneService | null;
};

const renderActions = (state = createState(), overrides: RenderOptions = {}) => {
  const view = renderHook(() =>
    useSceneFormActions({
      state,
      customFields: [],
      drizzleDb: {} as never,
      sceneServiceRef: {
        current:
          overrides.service === undefined
            ? (sceneService as unknown as SceneService)
            : overrides.service,
      },
      navigation: navigation as never,
      storyId: 'storyId' in overrides ? overrides.storyId : 'story-1',
      userId: 'userId' in overrides ? overrides.userId : 'user-1',
      persistTagRelations,
      persistNoteRelations,
      persistCharacterRelations,
      persistSecondaryDraft,
      clearSecondaryDraft,
    }),
  );
  return view;
};

/** The order in which everything that reaches storage or the outside world happens. */
let calls: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
  mockValidateRequired.mockReturnValue(undefined);
  mockSaveValuesForEntity.mockImplementation(async () => {
    calls.push('attributes');
  });
  persistTagRelations.mockImplementation(async () => {
    calls.push('tags');
  });
  persistNoteRelations.mockImplementation(async () => {
    calls.push('notes');
  });
  persistCharacterRelations.mockImplementation(async () => {
    calls.push('characters');
  });
  persistSecondaryDraft.mockImplementation(async () => {
    calls.push('draft saved');
  });
  clearSecondaryDraft.mockImplementation(async () => {
    calls.push('draft cleared');
  });
  persistPending.mockImplementation(async () => {
    calls.push('see also');
  });
  mockEmit.mockImplementation(() => {
    calls.push('event');
  });
  sceneService.createScene.mockImplementation(async () => {
    calls.push('created');
    return { id: 'scene-1' };
  });
  sceneService.updateScene.mockImplementation(async () => {
    calls.push('updated');
    return { id: 'scene-1' };
  });
  sceneService.getById.mockResolvedValue({ id: 'scene-1' });
  sceneService.deleteScene.mockResolvedValue(undefined);
});

const retained = (state: SceneFormState) =>
  (state.retainPersistedSceneId as jest.Mock).mockImplementation(() => {
    calls.push('retained');
  });

it('rejects an unnamed scene before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'name_required');
  expect(sceneService.createScene).not.toHaveBeenCalled();
});

describe('a new scene', () => {
  it('is written first, then its relations in order, then the attributes, and only then announced', async () => {
    const state = createState({ customValues: { field: 'value' } });
    retained(state);
    const view = await renderActions(state);
    view.result.current.seeAlsoManagerRef.current = { persistPending } as never;

    await act(async () => view.result.current.handleSave());

    expect(calls).toEqual([
      'created',
      'retained',
      'draft saved',
      'tags',
      'notes',
      'see also',
      'characters',
      'attributes',
      'draft cleared',
      'event',
    ]);
    expect(persistTagRelations).toHaveBeenCalledWith('scene-1');
    expect(persistNoteRelations).toHaveBeenCalledWith('scene-1');
    expect(persistPending).toHaveBeenCalledWith('scene-1');
    expect(persistCharacterRelations).toHaveBeenCalledWith('scene-1');
    expect(mockSaveValuesForEntity).toHaveBeenCalledWith('user-1', 'story-1', 'Scene', 'scene-1', {
      field: 'value',
    });
    expect(mockEmit).toHaveBeenCalledWith('scene_changed', 'story-1', 'scene-1');
    expect(state.retainPersistedSceneId).toHaveBeenCalledWith('scene-1');
    expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  });

  it('says it was created and replaces the form with the one of the new scene', async () => {
    const view = await renderActions();

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('success', 'created');
    expect(navigation.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ name: 'SceneForm', params: { sceneId: 'scene-1' } }),
      }),
    );
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('is created in its story with the name trimmed and without a manuscript body', async () => {
    const view = await renderActions(createState({ name: '  Arrival  ', isFavorite: true }));

    await act(async () => view.result.current.handleSave());

    const [user, data] = sceneService.createScene.mock.calls[0];
    expect(user).toBe('user-1');
    expect(data).toMatchObject({ storyId: 'story-1', name: 'Arrival', isFavorite: true });
    expect(data).not.toHaveProperty('body');
  });

  it('keeps the draft and says nothing when a relation cannot be written', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    persistTagRelations.mockRejectedValueOnce(new Error('tags down'));
    const state = createState();
    retained(state);
    const view = await renderActions(state);

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
    expect(mockAlert).not.toHaveBeenCalledWith('success', expect.anything());
    expect(calls).toEqual(['created', 'retained', 'draft saved']);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockSaveValuesForEntity).not.toHaveBeenCalled();
    expect(clearSecondaryDraft).not.toHaveBeenCalled();
    expect(state.clearFormDraft).not.toHaveBeenCalled();
    expect(navigation.dispatch).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('keeps the draft when the attributes cannot be written', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveValuesForEntity.mockRejectedValueOnce(new Error('attributes down'));
    const state = createState();
    const view = await renderActions(state);

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
    expect(clearSecondaryDraft).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(state.clearFormDraft).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('writes nothing when the scene itself cannot be created', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    sceneService.createScene.mockRejectedValueOnce(new Error('db down'));
    const state = createState();
    retained(state);
    const view = await renderActions(state);

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
    expect(state.retainPersistedSceneId).not.toHaveBeenCalled();
    expect(persistTagRelations).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(state.clearFormDraft).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('an existing scene', () => {
  const editing = () => createState({ currentSceneId: 'scene-1', isEditing: true });

  it('is read, updated without its story and left by going back', async () => {
    const view = await renderActions(editing());

    await act(async () => view.result.current.handleSave());

    expect(sceneService.getById).toHaveBeenCalledWith('scene-1');
    expect(sceneService.updateScene).toHaveBeenCalledWith(
      'user-1',
      'scene-1',
      expect.not.objectContaining({ storyId: expect.anything() }),
    );
    expect(sceneService.createScene).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('success', 'updated');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith('scene_changed', 'story-1', 'scene-1');
  });

  it('is not written to when it no longer exists', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    sceneService.getById.mockResolvedValueOnce(null);
    const state = editing();
    const view = await renderActions(state);

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
    expect(sceneService.updateScene).not.toHaveBeenCalled();
    expect(persistTagRelations).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(state.clearFormDraft).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('keeps the form when the update fails', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    sceneService.updateScene.mockRejectedValueOnce(new Error('db down'));
    const state = editing();
    const view = await renderActions(state);

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', 'save failed');
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(state.clearFormDraft).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

it('rejects a save missing a required custom attribute', async () => {
  mockValidateRequired.mockReturnValue('Era');
  const view = await renderActions(createState());

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'custom_attribute_required');
  expect(sceneService.createScene).not.toHaveBeenCalled();
});

it.each([
  ['no user', { userId: undefined }, 'user_not_identified'],
  ['no story', { storyId: undefined }, 'no_story_selected'],
  ['no service', { service: null }, 'save failed'],
])('says so and writes nothing with %s', async (_label, options, message) => {
  const view = await renderActions(createState(), options as RenderOptions);

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', message);
  expect(sceneService.createScene).not.toHaveBeenCalled();
  expect(sceneService.updateScene).not.toHaveBeenCalled();
});

it('rejects invalid timing input', async () => {
  const badGap = await renderActions(createState({ gapInput: 'abc' }));
  await act(async () => badGap.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'scene_timing_invalid');

  const badDuration = await renderActions(createState({ durationInput: '1.5' }));
  await act(async () => badDuration.result.current.handleSave());
  expect(mockAlert).toHaveBeenCalledWith('error', 'scene_timing_invalid');
  expect(sceneService.createScene).not.toHaveBeenCalled();
});

it('rejects an unparseable fixed date', async () => {
  const shared = jest.requireMock('@keres/shared') as {
    parseCalendarDateCoordinate: jest.Mock;
  };
  shared.parseCalendarDateCoordinate.mockReturnValueOnce(null);
  const view = await renderActions(createState({ calendarDateOverride: 'bogus' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'scene_fixed_date_invalid');
  expect(sceneService.createScene).not.toHaveBeenCalled();
});

it('persists timing and fixed-date data on save', async () => {
  const view = await renderActions(
    createState({
      gapInput: '2',
      gapType: 'days',
      durationInput: '3',
      durationType: 'hours',
      calendarDateOverride: 'D5',
      calendarDateOverrideCalendarId: 'cal-1',
    }),
  );

  await act(async () => view.result.current.handleSave());

  expect(sceneService.createScene.mock.calls[0][1]).toMatchObject({
    gap: 2,
    gapType: 'days',
    duration: 3,
    durationType: 'hours',
    calendarDateOverride: 'D5',
    calendarDateOverrideCalendarId: 'cal-1',
  });
});

it('drops the calendar of a fixed date that was cleared', async () => {
  const view = await renderActions(createState({ calendarDateOverrideCalendarId: 'cal-1' }));

  await act(async () => view.result.current.handleSave());

  expect(sceneService.createScene.mock.calls[0][1]).toMatchObject({
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
  });
});

describe('deleting', () => {
  it('deletes after confirmation, announces it and goes back', async () => {
    const state = createState({ currentSceneId: 'scene-1', isEditing: true });
    const view = await renderActions(state);

    await act(async () => view.result.current.handleDelete());
    const request = mockConfirmDelete.mock.calls[0][0];
    await act(async () => request.onConfirm());

    expect(sceneService.deleteScene).toHaveBeenCalledWith('user-1', 'scene-1');
    expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith('scene_changed', 'story-1', 'scene-1');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('asks in the words of the story', async () => {
    const view = await renderActions(createState({ currentSceneId: 'scene-1', isEditing: true }));

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete.mock.calls[0][0]).toMatchObject({
      titleKey: 'delete_scene_title',
      title: 'delete',
      messageKey: 'delete_scene_message',
      message: 'delete message',
      successMessage: 'deleted',
      failureKey: 'failed_to_delete_scene',
      failureMessage: 'delete failed',
    });
  });

  it('leaves the draft, the event and the screen alone when the delete fails', async () => {
    sceneService.deleteScene.mockRejectedValueOnce(new Error('db down'));
    const state = createState({ currentSceneId: 'scene-1', isEditing: true });
    const view = await renderActions(state);

    await act(async () => view.result.current.handleDelete());
    const request = mockConfirmDelete.mock.calls[0][0];
    await expect(request.onConfirm()).rejects.toThrow('db down');

    expect(state.clearFormDraft).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('rejects deletion without a user, id, or service', async () => {
    const noUser = await renderActions(createState({ currentSceneId: 'scene-1' }), {
      userId: undefined,
    });
    await act(async () => noUser.result.current.handleDelete());
    expect(mockAlert).toHaveBeenCalledWith('error', 'user_not_identified');

    const noId = await renderActions(createState());
    await act(async () => noId.result.current.handleDelete());
    const noService = await renderActions(createState({ currentSceneId: 'scene-1' }), {
      service: null,
    });
    await act(async () => noService.result.current.handleDelete());
    expect(mockConfirmDelete).not.toHaveBeenCalled();
  });
});

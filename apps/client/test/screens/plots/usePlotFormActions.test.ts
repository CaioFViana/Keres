const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();

// Only the shared hook imports these, and it loads them even for a form with no custom attributes.
jest.mock('@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields', () => ({
  validateRequiredCustomAttributes: () => null,
}));
jest.mock('../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ saveValuesForEntity: jest.fn() }),
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
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { usePlotFormActions } from '../../../src/screens/plots/usePlotFormActions';
import type { PlotFormState } from '../../../src/screens/plots/usePlotFormState';

const createState = (overrides: Partial<PlotFormState> = {}): PlotFormState =>
  ({
    plotId: undefined,
    name: 'Main Plot',
    setName: jest.fn(),
    details: '',
    setDetails: jest.fn(),
    loading: false,
    isEditing: false,
    clearFormDraft: jest.fn().mockResolvedValue(undefined),
    draftRestored: false,
    ...overrides,
  }) as PlotFormState;

const plotService = {
  save: jest.fn(),
  delete: jest.fn(),
};
const plotSceneService = {
  save: jest.fn(),
  delete: jest.fn(),
};
const navigation = {
  goBack: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
};
const reloadPlotData = jest.fn();

type RenderOptions = { userId?: string | null; storyId?: string; service?: null };

const renderActions = (state = createState(), options: RenderOptions = {}) =>
  renderHook(() =>
    usePlotFormActions({
      state,
      plotServiceRef: { current: 'service' in options ? null : (plotService as never) },
      plotSceneServiceRef: { current: plotSceneService as never },
      navigation: navigation as never,
      storyId: 'storyId' in options ? options.storyId : 'story-1',
      userId: 'userId' in options ? options.userId : 'user-1',
      reloadPlotData,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  plotService.save.mockResolvedValue({ id: 'plot-1' });
  plotService.delete.mockResolvedValue(undefined);
  plotSceneService.save.mockResolvedValue(undefined);
  plotSceneService.delete.mockResolvedValue(undefined);
  reloadPlotData.mockResolvedValue(undefined);
});

it('rejects an unnamed plot before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'plot_name_required');
  expect(plotService.save).not.toHaveBeenCalled();
});

it('replaces into the edit form after creating a plot', async () => {
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(plotService.save).toHaveBeenCalledWith('user-1', {
    id: undefined,
    storyId: 'story-1',
    name: 'Main Plot',
    details: null,
  });
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.replace).toHaveBeenCalledWith('PlotForm', { plotId: 'plot-1' });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

it('goes back after updating an existing plot', async () => {
  const state = createState({ plotId: 'plot-1', isEditing: true, details: ' notes ' });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(plotService.save).toHaveBeenCalledWith('user-1', {
    id: 'plot-1',
    storyId: 'story-1',
    name: 'Main Plot',
    details: 'notes',
  });
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalled();
});

it('delegates deletion and navigates to the plots list', async () => {
  const state = createState({ plotId: 'plot-1', isEditing: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(plotService.delete).toHaveBeenCalledWith('user-1', 'plot-1');
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith('Plots');
});

it('persists a plot-scene relation and reloads plot data', async () => {
  const view = await renderActions(createState({ plotId: 'plot-1', isEditing: true }));
  const relation = {
    storyId: 'story-1',
    plotId: 'plot-1',
    sceneId: 'scene-1',
    note: '',
  };

  await act(async () => view.result.current.handleSavePlotScene(relation));

  expect(plotSceneService.save).toHaveBeenCalledWith('user-1', relation);
  expect(reloadPlotData).toHaveBeenCalled();
});

it('deletes a plot-scene relation and reloads plot data', async () => {
  const view = await renderActions(createState({ plotId: 'plot-1', isEditing: true }));

  await act(async () => view.result.current.handleDeletePlotScene('relation-1'));

  expect(plotSceneService.delete).toHaveBeenCalledWith('user-1', 'relation-1');
  expect(reloadPlotData).toHaveBeenCalled();
});

describe('what stops a save before it reaches the service', () => {
  it.each([
    ['no user', { userId: null }],
    ['no story', { storyId: undefined }],
    ['no service', { service: null }],
  ])('alerts and writes nothing with %s', async (_label, options) => {
    const state = createState();
    const view = await renderActions(state, options as RenderOptions);

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', expect.any(String));
    expect(plotService.save).not.toHaveBeenCalled();
    expect(state.clearFormDraft).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('names the failure to save when there is no service', async () => {
    const view = await renderActions(createState(), { service: null });

    await act(async () => view.result.current.handleSave());

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_plot');
  });
});

it('saves the name as typed and the trimmed details, with no success alert', async () => {
  const view = await renderActions(createState({ details: '  the arc  ' }));

  await act(async () => view.result.current.handleSave());

  expect(plotService.save).toHaveBeenCalledWith('user-1', {
    id: undefined,
    storyId: 'story-1',
    name: 'Main Plot',
    details: 'the arc',
  });
  expect(mockAlert).not.toHaveBeenCalled();
});

it('replaces into the form of the new plot, so scenes can be added right away', async () => {
  const view = await renderActions();

  await act(async () => view.result.current.handleSave());

  expect(navigation.replace).toHaveBeenCalledWith('PlotForm', { plotId: 'plot-1' });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

it('keeps the form and the draft when saving fails', async () => {
  plotService.save.mockRejectedValueOnce(new Error('failed'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const state = createState({ plotId: 'plot-1', isEditing: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_plot');
  expect(state.clearFormDraft).not.toHaveBeenCalled();
  expect(navigation.goBack).not.toHaveBeenCalled();
  log.mockRestore();
});

describe('deleting', () => {
  it('asks for no confirmation without a user', async () => {
    const view = await renderActions(createState({ plotId: 'plot-1', isEditing: true }), {
      userId: null,
    });

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete).not.toHaveBeenCalled();
  });

  it('asks for no confirmation without a service', async () => {
    const view = await renderActions(createState({ plotId: 'plot-1', isEditing: true }), {
      service: null,
    });

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete).not.toHaveBeenCalled();
  });

  it('leaves the draft and the screen alone when the delete fails', async () => {
    plotService.delete.mockRejectedValueOnce(new Error('failed'));
    const state = createState({ plotId: 'plot-1', isEditing: true });
    const view = await renderActions(state);

    await act(async () => view.result.current.handleDelete());
    const request = mockConfirmDelete.mock.calls[0][0];
    await expect(request.onConfirm()).rejects.toThrow('failed');

    expect(state.clearFormDraft).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('passes the texts of the plot to the confirmation', async () => {
    const view = await renderActions(createState({ plotId: 'plot-1', isEditing: true }));

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete.mock.calls[0][0]).toMatchObject({
      titleKey: 'delete_plot_title',
      messageKey: 'delete_plot_message',
      successKey: 'plot_deleted_successfully',
      failureKey: 'failed_to_delete_plot',
    });
  });
});

describe('the scene relations', () => {
  it('alert and do nothing without a user', async () => {
    const view = await renderActions(createState(), { userId: null });

    await act(async () =>
      view.result.current.handleSavePlotScene({ plotId: 'plot-1', sceneId: 'scene-1' } as never),
    );
    await act(async () => view.result.current.handleDeletePlotScene('relation-1'));

    expect(mockAlert).toHaveBeenCalledTimes(2);
    expect(plotSceneService.save).not.toHaveBeenCalled();
    expect(plotSceneService.delete).not.toHaveBeenCalled();
    expect(reloadPlotData).not.toHaveBeenCalled();
  });

  it('say so when the relation cannot be saved or deleted, and do not reload', async () => {
    plotSceneService.save.mockRejectedValueOnce(new Error('failed'));
    plotSceneService.delete.mockRejectedValueOnce(new Error('failed'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const view = await renderActions();

    await act(async () =>
      view.result.current.handleSavePlotScene({ plotId: 'plot-1', sceneId: 'scene-1' } as never),
    );
    await act(async () => view.result.current.handleDeletePlotScene('relation-1'));

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_plot_scene_relation');
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_plot_scene');
    expect(reloadPlotData).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

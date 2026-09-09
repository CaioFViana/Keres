const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();

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

const renderActions = (state = createState()) =>
  renderHook(() =>
    usePlotFormActions({
      state,
      plotServiceRef: { current: plotService as never },
      plotSceneServiceRef: { current: plotSceneService as never },
      navigation: navigation as never,
      storyId: 'story-1',
      userId: 'user-1',
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
  const view = await renderActions();

  await act(async () => view.result.current.handleSave());

  expect(plotService.save).toHaveBeenCalledWith('user-1', {
    id: undefined,
    storyId: 'story-1',
    name: 'Main Plot',
    details: null,
  });
  expect(navigation.replace).toHaveBeenCalledWith('PlotForm', { plotId: 'plot-1' });
  expect(navigation.goBack).not.toHaveBeenCalled();
});

it('goes back after updating an existing plot', async () => {
  const view = await renderActions(
    createState({ plotId: 'plot-1', isEditing: true, details: ' notes ' }),
  );

  await act(async () => view.result.current.handleSave());

  expect(plotService.save).toHaveBeenCalledWith('user-1', {
    id: 'plot-1',
    storyId: 'story-1',
    name: 'Main Plot',
    details: 'notes',
  });
  expect(navigation.goBack).toHaveBeenCalled();
});

it('delegates deletion and navigates to the plots list', async () => {
  const view = await renderActions(createState({ plotId: 'plot-1', isEditing: true }));

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(plotService.delete).toHaveBeenCalledWith('user-1', 'plot-1');
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

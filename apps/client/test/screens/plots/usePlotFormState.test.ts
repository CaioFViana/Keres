import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePlotFormState } from '../../../src/screens/plots/usePlotFormState';
import type { createPlotService } from '../../../src/services/storymanagement/PlotService';

type PlotService = ReturnType<typeof createPlotService>;

const createPlotServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as PlotService,
});

const renderState = async (options: {
  plotId?: string;
  plot?: object | null;
  serviceRef?: { current: PlotService | null };
}) => {
  const plotServiceRef = options.serviceRef ?? createPlotServiceRef();
  if (options.plot !== undefined && plotServiceRef.current) {
    (plotServiceRef.current.getById as jest.Mock).mockResolvedValue(options.plot);
  }
  const view = await renderHook(() => usePlotFormState({ plotId: options.plotId, plotServiceRef }));
  return { plotServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('starts a creation form empty and ready', async () => {
  const { plotServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.name).toBe('');
  expect(view.result.current.details).toBe('');
  expect(plotServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates the plot being edited', async () => {
  // A pending fetch keeps the loading flag observable: an immediately-resolved mock would
  // already have settled by the time renderHook returns.
  const plotServiceRef = createPlotServiceRef();
  let resolveFetch!: (plot: object | null) => void;
  (plotServiceRef.current.getById as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveFetch = resolve;
    }),
  );
  const view = await renderHook(() => usePlotFormState({ plotId: 'plot-1', plotServiceRef }));

  expect(view.result.current.loading).toBe(true);
  await act(async () => {
    resolveFetch({ name: 'Revenge', details: 'Slow burn' });
  });
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(plotServiceRef.current!.getById).toHaveBeenCalledWith('plot-1');
  expect(view.result.current.name).toBe('Revenge');
  expect(view.result.current.details).toBe('Slow burn');
});

it('treats missing details as an empty draft', async () => {
  const { view } = await renderState({
    plotId: 'plot-1',
    plot: { name: 'Revenge', details: null },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.details).toBe('');
});

it('finishes loading when the plot is gone or the service is missing', async () => {
  const gone = await renderState({ plotId: 'missing', plot: null });
  await waitFor(() => expect(gone.view.result.current.loading).toBe(false));
  expect(gone.view.result.current.name).toBe('');

  const noService = await renderState({ plotId: 'plot-1', serviceRef: { current: null } });
  await waitFor(() => expect(noService.view.result.current.loading).toBe(false));
});

it('logs and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const plotServiceRef = createPlotServiceRef();
  (plotServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() => usePlotFormState({ plotId: 'plot-1', plotServiceRef }));

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load plot:', expect.any(Error));
  error.mockRestore();
});

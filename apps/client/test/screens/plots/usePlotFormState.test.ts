/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePlotFormState } from '../../../src/screens/plots/usePlotFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { createPlotService } from '../../../src/services/storymanagement/PlotService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

type PlotService = ReturnType<typeof createPlotService>;

let database: TestDatabase;

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
  const view = await renderHook(() =>
    usePlotFormState({ plotId: options.plotId, storyId: 'story-1', plotServiceRef }),
  );
  return { plotServiceRef, view };
};

const persistedPlot = {
  name: 'A Vingança',
  details: 'Queima lenta',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  database = await createTestDatabase();
  setEditorDraftDb(database.db);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  resetEditorDraftDbForTests();
  database.close();
  jest.restoreAllMocks();
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

describe('usePlotFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('A Traição');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('A Traição');
  });

  it('writes no draft when nothing was typed', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');
  });

  it('restores edits over the loaded database values', async () => {
    const { view: first } = await renderState({ plotId: 'plot-1', plot: persistedPlot });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('A Vingança');

    await act(async () => {
      first.result.current.setName('A Vingança, adiada');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ plotId: 'plot-1', plot: persistedPlot });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('A Vingança, adiada');
    expect(second.result.current.details).toBe('Queima lenta');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('A Traição');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    // Nothing comes back: the draft died with the reset, and tracking re-armed instead.
    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('');

    // ...so typing again drafts again.
    await act(async () => {
      second.result.current.setName('A Redenção');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('A Redenção');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({ plotId: 'plot-1', plot: persistedPlot });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Rascunho');
      first.result.current.setDetails('Detalhe novo');
    });
    expect(first.result.current.isDirty).toBe(true);

    await act(async () => {
      await first.result.current.resetForm();
    });

    expect(first.result.current.name).toBe('A Vingança');
    expect(first.result.current.details).toBe('Queima lenta');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ plotId: 'plot-1', plot: persistedPlot });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('A Vingança');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({ plotId: 'plot-1', plot: persistedPlot });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerPlot = {
      ...persistedPlot,
      name: 'A Vingança refeita',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({ plotId: 'plot-1', plot: newerPlot });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('A Vingança refeita');
  });
});

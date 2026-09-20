/** @jest-environment node */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouteFormState } from '../../../src/screens/routes/useRouteFormState';
import {
  resetEditorDraftDbForTests,
  setEditorDraftDb,
} from '../../../src/services/EditorDraftService';
import type { createRouteService } from '../../../src/services/storymanagement/RouteService';
import { createTestDatabase, type TestDatabase } from '../../helpers/testDb';

type RouteService = ReturnType<typeof createRouteService>;

let database: TestDatabase;

const createRouteServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as RouteService,
});

const renderState = async (options: {
  routeId?: string;
  route?: object | null;
  serviceRef?: { current: RouteService | null };
}) => {
  const routeServiceRef = options.serviceRef ?? createRouteServiceRef();
  if (options.route !== undefined && routeServiceRef.current) {
    (routeServiceRef.current.getById as jest.Mock).mockResolvedValue(options.route);
  }
  const view = await renderHook(() =>
    useRouteFormState({ routeId: options.routeId, storyId: 'story-1', routeServiceRef }),
  );
  return { routeServiceRef, view };
};

const persistedRoute = {
  name: 'Passagem do Norte',
  details: 'Nevada',
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
  const { routeServiceRef, view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.name).toBe('');
  expect(view.result.current.details).toBe('');
  expect(routeServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('hydrates the route being edited', async () => {
  const { routeServiceRef, view } = await renderState({
    routeId: 'route-1',
    route: { name: 'Northern pass', details: 'Snowy' },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(routeServiceRef.current!.getById).toHaveBeenCalledWith('route-1');
  expect(view.result.current.name).toBe('Northern pass');
  expect(view.result.current.details).toBe('Snowy');
});

it('treats missing details as an empty draft', async () => {
  const { view } = await renderState({
    routeId: 'route-1',
    route: { name: 'Northern pass', details: null },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.details).toBe('');
});

it('finishes loading when the route is gone or the service is missing', async () => {
  const gone = await renderState({ routeId: 'missing', route: null });
  await waitFor(() => expect(gone.view.result.current.loading).toBe(false));
  expect(gone.view.result.current.name).toBe('');

  const noService = await renderState({ routeId: 'route-1', serviceRef: { current: null } });
  await waitFor(() => expect(noService.view.result.current.loading).toBe(false));
});

describe('useRouteFormState durable drafts', () => {
  it('restores typed creation content after a navigation round-trip', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Trilha do Sul');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({});
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Trilha do Sul');
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
    const { view: first } = await renderState({ routeId: 'route-1', route: persistedRoute });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.name).toBe('Passagem do Norte');

    await act(async () => {
      first.result.current.setName('Passagem do Norte, bloqueada');
    });
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ routeId: 'route-1', route: persistedRoute });
    await waitFor(() => expect(second.result.current.draftRestored).toBe(true));

    expect(second.result.current.name).toBe('Passagem do Norte, bloqueada');
    expect(second.result.current.details).toBe('Nevada');
  });

  it('resets a creation back to blanks and drops the stored draft', async () => {
    const { view: first } = await renderState({});
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isDirty).toBe(false);

    await act(async () => {
      first.result.current.setName('Trilha do Sul');
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
      second.result.current.setName('Atalho do Leste');
    });
    await act(async () => {
      second.unmount();
    });
    const { view: third } = await renderState({});
    await waitFor(() => expect(third.result.current.draftRestored).toBe(true));
    expect(third.result.current.name).toBe('Atalho do Leste');
  });

  it('resets an edit back to the saved values and drops the stored draft', async () => {
    const { view: first } = await renderState({ routeId: 'route-1', route: persistedRoute });
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

    expect(first.result.current.name).toBe('Passagem do Norte');
    expect(first.result.current.details).toBe('Nevada');
    expect(first.result.current.isDirty).toBe(false);
    await act(async () => {
      first.unmount();
    });

    const { view: second } = await renderState({ routeId: 'route-1', route: persistedRoute });
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Passagem do Norte');
  });

  it('discards the draft when the entity was saved elsewhere since', async () => {
    const { view: first } = await renderState({ routeId: 'route-1', route: persistedRoute });
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    await act(async () => {
      first.result.current.setName('Rascunho velho');
    });
    await act(async () => {
      first.unmount();
    });

    const newerRoute = {
      ...persistedRoute,
      name: 'Passagem refeita',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const { view: second } = await renderState({ routeId: 'route-1', route: newerRoute });
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.draftRestored).toBe(false);
    expect(second.result.current.name).toBe('Passagem refeita');
  });
});

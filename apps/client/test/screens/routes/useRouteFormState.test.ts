import { renderHook, waitFor } from '@testing-library/react-native';
import { useRouteFormState } from '../../../src/screens/routes/useRouteFormState';
import type { createRouteService } from '../../../src/services/storymanagement/RouteService';

type RouteService = ReturnType<typeof createRouteService>;

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
    useRouteFormState({ routeId: options.routeId, routeServiceRef }),
  );
  return { routeServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
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

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
import { useRouteFormActions } from '../../../src/screens/routes/useRouteFormActions';
import type { RouteFormState } from '../../../src/screens/routes/useRouteFormState';

const createState = (overrides: Partial<RouteFormState> = {}): RouteFormState =>
  ({
    routeId: undefined,
    name: 'Hero Path',
    setName: jest.fn(),
    details: '',
    setDetails: jest.fn(),
    loading: false,
    isEditing: false,
    ...overrides,
  }) as RouteFormState;

const routeService = {
  save: jest.fn(),
  delete: jest.fn(),
};
const navigation = {
  goBack: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
};

const renderActions = (
  state = createState(),
  options: { storyId?: string; userId?: string | null } = {},
) =>
  renderHook(() =>
    useRouteFormActions({
      state,
      routeServiceRef: { current: routeService as never },
      navigation: navigation as never,
      storyId: options.storyId ?? 'story-1',
      userId: options.userId === undefined ? 'user-1' : options.userId,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  routeService.save.mockResolvedValue({ id: 'route-1' });
  routeService.delete.mockResolvedValue(undefined);
});

it('rejects an unnamed route before persistence', async () => {
  const view = await renderActions(createState({ name: '  ' }));

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'route_name_required');
  expect(routeService.save).not.toHaveBeenCalled();
});

it('alerts user_not_identified when identity is missing but the name is present', async () => {
  const view = await renderActions(createState(), { userId: null });

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'user_not_identified');
  expect(routeService.save).not.toHaveBeenCalled();
});

it('replaces into route detail after creating a route', async () => {
  const view = await renderActions();

  await act(async () => view.result.current.handleSave());

  expect(routeService.save).toHaveBeenCalledWith('user-1', {
    id: undefined,
    storyId: 'story-1',
    name: 'Hero Path',
    details: null,
  });
  expect(navigation.replace).toHaveBeenCalledWith('RouteDetail', { routeId: 'route-1' });
});

it('goes back after updating an existing route', async () => {
  const view = await renderActions(
    createState({ routeId: 'route-1', isEditing: true, details: ' notes ' }),
  );

  await act(async () => view.result.current.handleSave());

  expect(routeService.save).toHaveBeenCalledWith('user-1', {
    id: 'route-1',
    storyId: 'story-1',
    name: 'Hero Path',
    details: 'notes',
  });
  expect(navigation.goBack).toHaveBeenCalled();
});

it('delegates deletion and navigates to the routes list', async () => {
  const view = await renderActions(createState({ routeId: 'route-1', isEditing: true }));

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(routeService.delete).toHaveBeenCalledWith('user-1', 'route-1');
  expect(navigation.navigate).toHaveBeenCalledWith('Routes');
});

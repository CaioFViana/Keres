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
    clearFormDraft: jest.fn().mockResolvedValue(undefined),
    draftRestored: false,
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

type RenderOptions = { storyId?: string; userId?: string | null; service?: null };

const renderActions = (state = createState(), options: RenderOptions = {}) =>
  renderHook(() =>
    useRouteFormActions({
      state,
      routeServiceRef: { current: 'service' in options ? null : (routeService as never) },
      navigation: navigation as never,
      storyId: 'storyId' in options ? options.storyId : 'story-1',
      userId: 'userId' in options ? options.userId : 'user-1',
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
  const state = createState();
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(routeService.save).toHaveBeenCalledWith('user-1', {
    id: undefined,
    storyId: 'story-1',
    name: 'Hero Path',
    details: null,
  });
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.replace).toHaveBeenCalledWith('RouteDetail', { routeId: 'route-1' });
});

it('goes back after updating an existing route', async () => {
  const state = createState({ routeId: 'route-1', isEditing: true, details: ' notes ' });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(routeService.save).toHaveBeenCalledWith('user-1', {
    id: 'route-1',
    storyId: 'story-1',
    name: 'Hero Path',
    details: 'notes',
  });
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.goBack).toHaveBeenCalled();
});

it('delegates deletion and navigates to the routes list', async () => {
  const state = createState({ routeId: 'route-1', isEditing: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleDelete());
  const request = mockConfirmDelete.mock.calls[0][0];
  await act(async () => request.onConfirm());

  expect(routeService.delete).toHaveBeenCalledWith('user-1', 'route-1');
  expect(state.clearFormDraft).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith('Routes');
});

it.each([
  ['no story', { storyId: undefined }],
  ['no service', { service: null }],
])('alerts and writes nothing with %s', async (_label, options) => {
  const state = createState();
  const view = await renderActions(state, options as RenderOptions);

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', expect.any(String));
  expect(routeService.save).not.toHaveBeenCalled();
  expect(state.clearFormDraft).not.toHaveBeenCalled();
  expect(navigation.replace).not.toHaveBeenCalled();
});

it('names the failure to save when there is no service', async () => {
  const view = await renderActions(createState(), { service: null });

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_route');
});

it('saves without a success alert', async () => {
  const view = await renderActions();

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).not.toHaveBeenCalled();
});

it('keeps the form and the draft when saving fails', async () => {
  routeService.save.mockRejectedValueOnce(new Error('failed'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const state = createState({ routeId: 'route-1', isEditing: true });
  const view = await renderActions(state);

  await act(async () => view.result.current.handleSave());

  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_route');
  expect(state.clearFormDraft).not.toHaveBeenCalled();
  expect(navigation.goBack).not.toHaveBeenCalled();
  log.mockRestore();
});

describe('deleting', () => {
  it('asks for no confirmation without a user', async () => {
    const view = await renderActions(createState({ routeId: 'route-1', isEditing: true }), {
      userId: null,
    });

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete).not.toHaveBeenCalled();
  });

  it.each([
    ['a route that was never saved', createState(), {}],
    ['no service', createState({ routeId: 'route-1', isEditing: true }), { service: null }],
  ])('asks for no confirmation for %s', async (_label, state, options) => {
    const view = await renderActions(state, options as RenderOptions);

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete).not.toHaveBeenCalled();
  });

  it('leaves the draft and the screen alone when the delete fails', async () => {
    routeService.delete.mockRejectedValueOnce(new Error('failed'));
    const state = createState({ routeId: 'route-1', isEditing: true });
    const view = await renderActions(state);

    await act(async () => view.result.current.handleDelete());
    const request = mockConfirmDelete.mock.calls[0][0];
    await expect(request.onConfirm()).rejects.toThrow('failed');

    expect(state.clearFormDraft).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('passes the texts of the route to the confirmation', async () => {
    const view = await renderActions(createState({ routeId: 'route-1', isEditing: true }));

    await act(async () => view.result.current.handleDelete());

    expect(mockConfirmDelete.mock.calls[0][0]).toMatchObject({
      titleKey: 'delete_route_title',
      messageKey: 'delete_route_message',
      successKey: 'route_deleted_successfully',
      failureKey: 'failed_to_delete_route',
    });
  });
});

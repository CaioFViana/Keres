const mockAlert = jest.fn();

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useFriendshipFormState } from '../../../src/screens/enterstack/useFriendshipFormState';

const server = (id: string) => ({ id, name: id }) as never;

const renderState = async (servers: { id: string }[] | Error = []) => {
  const getAllServers = jest.fn();
  if (servers instanceof Error) {
    getAllServers.mockRejectedValue(servers);
  } else {
    getAllServers.mockResolvedValue(servers.map((s) => server(s.id)));
  }
  const serverServiceRef = { current: { getAllServers } as never };
  const view = await renderHook(() => useFriendshipFormState({ serverServiceRef }));
  return { getAllServers, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('auto-selects the only registered server', async () => {
  const { view } = await renderState([{ id: 'server-1' }]);

  await waitFor(() => expect(view.result.current.servers).toHaveLength(1));

  expect(view.result.current.selectedServerId).toBe('server-1');
  expect(view.result.current.selectedServer?.id).toBe('server-1');
});

it('leaves the server unselected when several are registered', async () => {
  const { view } = await renderState([{ id: 'server-1' }, { id: 'server-2' }]);

  await waitFor(() => expect(view.result.current.servers).toHaveLength(2));

  expect(view.result.current.selectedServerId).toBe('');
  expect(view.result.current.selectedServer).toBeUndefined();
});

it('alerts when the server list cannot load', async () => {
  const { view } = await renderState(new Error('offline'));

  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_form_data'));

  expect(view.result.current.servers).toEqual([]);
});

it('changing the server clears the previously resolved friend', async () => {
  const { view } = await renderState([{ id: 'server-1' }, { id: 'server-2' }]);
  await waitFor(() => expect(view.result.current.servers).toHaveLength(2));

  await act(async () => {
    view.result.current.setResolvedFriendUserId('friend-1');
    view.result.current.setFriendUsername('friend');
    view.result.current.setFriendFound(true);
  });
  await act(async () => {
    view.result.current.handleServerChange('server-2');
  });

  expect(view.result.current.selectedServerId).toBe('server-2');
  expect(view.result.current.resolvedFriendUserId).toBeNull();
  expect(view.result.current.friendUsername).toBeNull();
  expect(view.result.current.friendFound).toBeNull();
});

it('editing the friend tag clears the previously resolved friend', async () => {
  const { view } = await renderState([{ id: 'server-1' }]);
  await waitFor(() => expect(view.result.current.servers).toHaveLength(1));

  await act(async () => {
    view.result.current.setResolvedFriendUserId('friend-1');
    view.result.current.setFriendFound(true);
  });
  await act(async () => {
    view.result.current.handleFriendTagChange('other#1234');
  });

  expect(view.result.current.resolvedFriendUserId).toBeNull();
  expect(view.result.current.friendFound).toBeNull();
});

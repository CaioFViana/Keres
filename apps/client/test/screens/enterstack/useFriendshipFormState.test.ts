const mockAlert = jest.fn();

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { withSilencedConsole } from '../../helpers/silenceConsole';
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
  await withSilencedConsole(['error'], async () => {
    const { view } = await renderState(new Error('offline'));

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_form_data'),
    );

    expect(view.result.current.servers).toEqual([]);
  });
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

it('does not call the servers "none" until they have been read', async () => {
  const pending = new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 50));
  const serverServiceRef = { current: { getAllServers: () => pending } as never };
  const view = await renderHook(() => useFriendshipFormState({ serverServiceRef }));
  expect(view.result.current.serversLoaded).toBe(false);

  await waitFor(() => expect(view.result.current.serversLoaded).toBe(true));
  expect(view.result.current.servers).toEqual([]);
});

it('counts a failed read of the servers as read, so the form is not left waiting', async () => {
  await withSilencedConsole(['error'], async () => {
    const { view } = await renderState(new Error('offline'));
    await waitFor(() => expect(view.result.current.serversLoaded).toBe(true));
  });
});

it('keeps "could not ask the server" apart from "no such tag", and clears it on any edit', async () => {
  const { view } = await renderState([{ id: 'server-1' }, { id: 'server-2' }]);
  await waitFor(() => expect(view.result.current.servers).toHaveLength(2));

  await act(async () => {
    view.result.current.setCheckFailed(true);
  });
  expect(view.result.current.checkFailed).toBe(true);
  expect(view.result.current.friendFound).toBeNull();

  await act(async () => {
    view.result.current.handleFriendTagChange('friend');
  });
  expect(view.result.current.checkFailed).toBe(false);

  await act(async () => {
    view.result.current.setCheckFailed(true);
  });
  await act(async () => {
    view.result.current.handleServerChange('server-2');
  });
  expect(view.result.current.checkFailed).toBe(false);
});

it('starts on the server asked for when there are several, and ignores one that does not exist', async () => {
  const getAllServers = jest.fn().mockResolvedValue([server('server-1'), server('server-2')]);
  const serverServiceRef = { current: { getAllServers } as never };

  const asked = await renderHook(() =>
    useFriendshipFormState({ serverServiceRef, initialServerId: 'server-2' }),
  );
  await waitFor(() => expect(asked.result.current.selectedServerId).toBe('server-2'));

  const unknown = await renderHook(() =>
    useFriendshipFormState({ serverServiceRef, initialServerId: 'gone' }),
  );
  await waitFor(() => expect(unknown.result.current.servers).toHaveLength(2));
  // With several and none valid, the person chooses: the same tag is another person on each server.
  expect(unknown.result.current.selectedServerId).toBe('');
});

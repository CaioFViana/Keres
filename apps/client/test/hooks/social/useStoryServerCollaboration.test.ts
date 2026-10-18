import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStoryServerCollaboration } from '@/src/hooks/social/useStoryServerCollaboration';
import { syncEngine } from '@/src/services/sync/appSyncEngine';
// @ts-expect-error - only the mock exports it
import { mockInvitationList } from '@/src/hooks/social/useStoryInvitations';

const mockDb = {};
const mockT = (key: string) => key;
const mockStoryState: any = {
  selectedStory: { id: 'story-1', serverId: null },
  setSelectedStory: jest.fn(),
};
const mockSettings = { userId: 'user-1' };
const mockServerService = { getAllServers: jest.fn() };
const mockStoryService = {
  updateStory: jest.fn(),
  unlinkFromServer: jest.fn(),
  discardCollaboratedCopy: jest.fn(),
};
const mockFriendshipService = { getAllFriendships: jest.fn() };
const mockAlert = jest.fn();
const mockInvite = jest.fn();
const mockCloseInvitation = jest.fn();
const mockNotify = jest.fn();
const mockApi = {
  getCollaborators: jest.fn(),
  updateCollaboratorPermission: jest.fn(),
  removeCollaborator: jest.fn(),
  leaveStory: jest.fn(),
};

jest.mock('@/src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('@/src/state/story/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn(() => mockStoryState),
}));
jest.mock('@/src/state/app/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(() => mockSettings),
}));
jest.mock('@/src/services/servers/ServerService', () => ({
  __esModule: true,
  createServerService: jest.fn(() => mockServerService),
}));
jest.mock('@/src/services/storymanagement/story-lifecycle/StoryService', () => ({
  __esModule: true,
  createStoryService: jest.fn(() => mockStoryService),
}));
jest.mock('@/src/services/social/FriendshipService', () => ({
  __esModule: true,
  createFriendshipService: jest.fn(() => mockFriendshipService),
}));
jest.mock('@/src/services/api/apiClient', () => ({
  __esModule: true,
  isOfflineError: jest.fn(() => false),
}));
jest.mock('@/src/services/social/StoryPermissionService', () => ({
  __esModule: true,
  storyPermissionApi: {
    getCollaborators: (...args: unknown[]) => mockApi.getCollaborators(...args),
    updateCollaboratorPermission: (...args: unknown[]) =>
      mockApi.updateCollaboratorPermission(...args),
    removeCollaborator: (...args: unknown[]) => mockApi.removeCollaborator(...args),
    leaveStory: (...args: unknown[]) => mockApi.leaveStory(...args),
  },
}));
jest.mock('@/src/services/api/StoryInvitationApiService', () => ({
  __esModule: true,
  storyInvitationApi: { invite: (...args: unknown[]) => mockInvite(...args) },
}));
jest.mock('@/src/services/social/storyInvitationActions', () => ({
  __esModule: true,
  closeStoryInvitation: (...args: unknown[]) => mockCloseInvitation(...args),
}));
jest.mock('@/src/state/ui/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));
// The hook reads the invitations from the local copy; a settable list stands in for it.
jest.mock('@/src/hooks/social/useStoryInvitations', () => {
  const { create } = require('zustand');
  const store = create(() => ({ invitations: [] as unknown[] }));
  return {
    __esModule: true,
    mockInvitationList: store,
    useStoryInvitations: () => store((state: { invitations: unknown[] }) => state.invitations),
  };
});
const mockSyncInvitations = jest.fn(async () => undefined);
jest.mock('@/src/services/social/StoryInvitationService', () => ({
  __esModule: true,
  createStoryInvitationService: () => ({ syncWithServer: mockSyncInvitations }),
}));
jest.mock('@/src/services/sync/appSyncEngine', () => ({
  __esModule: true,
  syncEngine: { uploadNewStoryToServer: jest.fn() },
}));
jest.mock('@/src/state/ui/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

const mockUpload = syncEngine.uploadNewStoryToServer as jest.Mock;

const server = { id: 'server-1', name: 'Main', idUser: 'owner-1' } as never;
const pendingInvitation = {
  id: 'inv-1',
  serverId: 'server-1',
  serverUserId: 'owner-1',
  storyId: 'story-1',
  inviterId: 'owner-1',
  inviteeId: 'friend-3',
  inviteeUsername: 'Invited',
  permissionType: 'reader',
} as never;
const collaborator = {
  userId: 'friend-1',
  permissionType: 'reader',
  user: { username: 'Friend' },
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockStoryState.selectedStory = { id: 'story-1', serverId: null };
  mockServerService.getAllServers.mockResolvedValue([server]);
  mockFriendshipService.getAllFriendships.mockResolvedValue([]);
  mockApi.getCollaborators.mockResolvedValue([collaborator]);
  mockInvite.mockResolvedValue({ inviteeUsername: 'Other' });
  mockCloseInvitation.mockResolvedValue(undefined);
  mockInvitationList.setState({ invitations: [] });
  mockApi.updateCollaboratorPermission.mockResolvedValue(undefined);
  mockApi.removeCollaborator.mockResolvedValue(undefined);
  mockApi.leaveStory.mockResolvedValue(undefined);
  mockStoryService.discardCollaboratedCopy.mockResolvedValue(undefined);
  mockUpload.mockResolvedValue({ success: true });
});

describe('useStoryServerCollaboration', () => {
  it('loads servers and uploads a local story to the selected target', async () => {
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() =>
      expect(view.result.current.uploadServerOptions).toEqual([
        { label: 'Main', value: 'server-1' },
      ]),
    );
    await act(async () => view.result.current.setUploadTargetServerId('server-1'));
    await act(async () => view.result.current.handleSendToServer());
    expect(mockUpload).toHaveBeenCalledWith('story-1', server, 'user-1', {
      replaceOldCopy: false,
    });
    expect(mockStoryState.setSelectedStory).toHaveBeenCalledWith(
      expect.objectContaining({ serverId: 'server-1' }),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'send_to_server_success');
  });

  it('loads collaborator administration for a linked server and invokes permission actions', async () => {
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    mockFriendshipService.getAllFriendships.mockResolvedValue([
      { serverId: 'server-1', status: 'friend', otherUserId: 'friend-2', friendUsername: 'Other' },
    ]);
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));
    expect(view.result.current.addableFriendOptions).toEqual([
      { label: 'Other', value: 'friend-2' },
    ]);
    await act(async () => view.result.current.setSelectedFriendId('friend-2'));
    await act(async () => view.result.current.handleAddCollaborator());
    await act(async () =>
      view.result.current.handleUpdateCollaboratorPermission(collaborator, 'writer'),
    );
    // Adding is inviting: access only starts when the friend accepts.
    expect(mockInvite).toHaveBeenCalledWith(server, 'story-1', 'friend-2', 'reader');
    expect(mockNotify).toHaveBeenCalledWith('story_invitation_sent', 'success');
    expect(mockApi.updateCollaboratorPermission).toHaveBeenCalledWith(
      server,
      'story-1',
      'friend-1',
      'writer',
    );
  });

  it('does nothing without required context and treats forbidden collaborators as non-owner', async () => {
    mockApi.getCollaborators.mockRejectedValue({ response: { status: 403 } });
    const view = await renderHook(() => useStoryServerCollaboration(undefined));
    await act(async () => view.result.current.handleSendToServer());
    expect(mockUpload).not.toHaveBeenCalled();
    const linked = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(linked.result.current.isOwnerOnServer).toBeNull());
  });

  it('unlinks a story whose server vanished and warns the writer', async () => {
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-gone' };
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('warning', 'server_not_found_for_story'),
    );
    expect(mockStoryService.updateStory).toHaveBeenCalledWith('user-1', 'story-1', {
      serverId: null,
    });
    expect(view.result.current.serverId).toBeNull();
  });

  it('treats a forbidden collaborator list as a non-owner, other failures as unknown', async () => {
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    mockApi.getCollaborators.mockRejectedValue({ response: { status: 403 } });
    const forbidden = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(forbidden.result.current.isOwnerOnServer).toBe(false));
    expect(forbidden.result.current.collaborators).toBeNull();

    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.getCollaborators.mockRejectedValue(new Error('boom'));
    mockFriendshipService.getAllFriendships.mockRejectedValue(new Error('boom'));
    const broken = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Failed to check story ownership/collaborators on server:',
        expect.any(Error),
      ),
    );
    expect(broken.result.current.isOwnerOnServer).toBeNull();
    (console.error as jest.Mock).mockRestore();
  });

  it('reports every upload outcome distinctly instead of a single failure', async () => {
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() =>
      expect(view.result.current.uploadServerOptions).toEqual([
        { label: 'Main', value: 'server-1' },
      ]),
    );
    await act(async () => view.result.current.setUploadTargetServerId('server-1'));

    mockUpload.mockResolvedValue({ success: false, reason: 'already_exists' });
    await act(async () => view.result.current.handleSendToServer());
    expect(mockAlert).toHaveBeenCalledWith('error', 'send_to_server_already_exists');

    mockAlert.mockClear();
    mockUpload.mockResolvedValue({
      success: false,
      reason: 'refused',
      message: 'Story limit reached for your plan (1).',
      planLimit: true,
    });
    await act(async () => view.result.current.handleSendToServer());
    expect(mockAlert).toHaveBeenCalledWith('error', 'send_to_server_refused_plan');

    // Any other refusal (adults-only, say) gets the reason alone: the plan hint would send the person to the wrong place.
    mockAlert.mockClear();
    mockUpload.mockResolvedValue({
      success: false,
      reason: 'refused',
      message: 'This server has no age verification, so it has no adults-only area.',
      planLimit: false,
    });
    await act(async () => view.result.current.handleSendToServer());
    expect(mockAlert).toHaveBeenCalledWith('error', 'send_to_server_refused');
    expect(mockAlert).not.toHaveBeenCalledWith('error', 'send_to_server_refused_plan');

    mockUpload.mockResolvedValue({ success: false, reason: 'other' });
    await act(async () => view.result.current.handleSendToServer());
    expect(mockAlert).toHaveBeenCalledWith('error', 'send_to_server_failed');

    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUpload.mockRejectedValue(new Error('boom'));
    await act(async () => view.result.current.handleSendToServer());
    expect(mockAlert).toHaveBeenCalledWith('error', 'send_to_server_failed');
    (console.error as jest.Mock).mockRestore();
  });

  it('tells the owner a story was on the server before, and only replaces its old data once they agree', async () => {
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() =>
      expect(view.result.current.uploadServerOptions).toEqual([
        { label: 'Main', value: 'server-1' },
      ]),
    );
    await act(async () => view.result.current.setUploadTargetServerId('server-1'));

    mockUpload.mockResolvedValueOnce({ success: false, reason: 'previously_on_server' });
    await act(async () => view.result.current.handleSendToServer());

    // The first try never asks for the old copy to be replaced, whatever the press passes along.
    expect(mockUpload).toHaveBeenLastCalledWith('story-1', expect.anything(), expect.anything(), {
      replaceOldCopy: false,
    });
    const [title, message, buttons] = mockAlert.mock.calls.at(-1) as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    expect(title).toBe('send_to_server_previous_title');
    expect(message).toBe('send_to_server_previous_message');
    expect(buttons.map((button) => button.text)).toEqual([
      'cancel',
      'send_to_server_previous_confirm',
    ]);

    mockUpload.mockResolvedValueOnce({ success: true });
    await act(async () => buttons[1].onPress?.());

    expect(mockUpload).toHaveBeenLastCalledWith('story-1', expect.anything(), expect.anything(), {
      replaceOldCopy: true,
    });
  });

  it('says the plan has no room for another collaborator when adding one is refused with 429', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    mockInvite.mockRejectedValue({ response: { status: 429 } });
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));

    await act(async () => view.result.current.setSelectedFriendId('friend-2'));
    await act(async () => view.result.current.handleAddCollaborator());

    expect(mockAlert).toHaveBeenCalledWith('error', 'invite_collaborator_limit_reached');
  });

  it('reports collaborator failures instead of failing silently', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    mockInvite.mockRejectedValue(new Error('boom'));
    mockApi.updateCollaboratorPermission.mockRejectedValue(new Error('boom'));
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));

    await act(async () => view.result.current.setSelectedFriendId('friend-2'));
    await act(async () => view.result.current.handleAddCollaborator());
    expect(mockAlert).toHaveBeenCalledWith('error', 'invite_collaborator_failed');

    await act(async () =>
      view.result.current.handleUpdateCollaboratorPermission(collaborator, 'writer'),
    );
    expect(mockAlert).toHaveBeenCalledWith('error', 'update_collaborator_permission_failed');
    (console.error as jest.Mock).mockRestore();
  });

  it('removes a collaborator only after confirmation, and reports a failure', async () => {
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));

    await act(async () => view.result.current.handleRemoveCollaborator(collaborator));
    expect(mockApi.removeCollaborator).not.toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0]?.[2] as { onPress?: () => Promise<void> }[];
    await act(async () => buttons[1]?.onPress?.());

    expect(mockApi.removeCollaborator).toHaveBeenCalledWith(server, 'story-1', 'friend-1');
    expect(view.result.current.collaborators).toEqual([]);

    // A failure keeps the list and tells the writer.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.getCollaborators.mockResolvedValue([collaborator]);
    mockApi.removeCollaborator.mockRejectedValueOnce(new Error('boom'));
    const retry = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(retry.result.current.collaborators).toEqual([collaborator]));
    await act(async () => retry.result.current.handleRemoveCollaborator(collaborator));
    const retryButtons = mockAlert.mock.calls.at(-1)?.[2] as {
      onPress?: () => Promise<void>;
    }[];
    await act(async () => retryButtons[1]?.onPress?.());
    expect(mockAlert).toHaveBeenCalledWith('error', 'remove_collaborator_failed');
    expect(retry.result.current.collaborators).toEqual([collaborator]);
    (console.error as jest.Mock).mockRestore();
  });

  it('reads the collaborators again when the server says they changed, for this story only', async () => {
    const { entityEventEmitter } = jest.requireActual('@/src/state/events/EventEmitter');
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));
    expect(mockApi.getCollaborators).toHaveBeenCalledTimes(1);

    mockApi.getCollaborators.mockResolvedValue([]);
    await act(async () =>
      entityEventEmitter.emit('story_collaborators_changed', 'other', 'server-1'),
    );
    await act(async () =>
      entityEventEmitter.emit('story_collaborators_changed', 'story-1', 'another-server'),
    );
    expect(mockApi.getCollaborators).toHaveBeenCalledTimes(1);

    await act(async () =>
      entityEventEmitter.emit('story_collaborators_changed', 'story-1', 'server-1'),
    );
    await waitFor(() => expect(view.result.current.collaborators).toEqual([]));
    expect(mockApi.getCollaborators).toHaveBeenCalledTimes(2);
  });

  describe('a collaborator leaving the story', () => {
    const asCollaborator = async () => {
      mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
      mockApi.getCollaborators.mockRejectedValue({ response: { status: 403 } });
      const view = await renderHook(() => useStoryServerCollaboration('story-1'));
      await waitFor(() => expect(view.result.current.isOwnerOnServer).toBe(false));
      return view;
    };
    const confirm = async () => {
      const buttons = mockAlert.mock.calls.at(-1)?.[2] as {
        onPress?: () => Promise<void>;
      }[];
      await act(async () => buttons[1]?.onPress?.());
    };

    it("asks first, tells the server, then removes this device's copy and moves on", async () => {
      const view = await asCollaborator();
      const onLeft = jest.fn();

      await act(async () => view.result.current.handleLeaveStory(onLeft));
      expect(mockApi.leaveStory).not.toHaveBeenCalled();
      expect(mockAlert.mock.calls.at(-1)?.[0]).toBe('leave_story_title');
      await confirm();

      expect(mockApi.leaveStory).toHaveBeenCalledWith(server, 'story-1');
      expect(mockStoryService.discardCollaboratedCopy).toHaveBeenCalledWith('story-1');
      expect(mockAlert).toHaveBeenCalledWith('success', 'leave_story_success');
      expect(onLeft).toHaveBeenCalledTimes(1);
    });

    it('keeps the copy when the server could not be told - it would come back on the next sync', async () => {
      const view = await asCollaborator();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.leaveStory.mockRejectedValueOnce(new Error('boom'));
      const onLeft = jest.fn();

      await act(async () => view.result.current.handleLeaveStory(onLeft));
      await confirm();

      expect(mockStoryService.discardCollaboratedCopy).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith('error', 'leave_story_failed');
      expect(onLeft).not.toHaveBeenCalled();
      (console.error as jest.Mock).mockRestore();
    });

    it('says so when offline', async () => {
      const { isOfflineError } = jest.requireMock('@/src/services/api/apiClient') as {
        isOfflineError: jest.Mock;
      };
      const view = await asCollaborator();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      mockApi.leaveStory.mockRejectedValueOnce(new Error('network'));
      isOfflineError.mockReturnValueOnce(true);

      await act(async () => view.result.current.handleLeaveStory());
      await confirm();

      expect(mockAlert).toHaveBeenCalledWith('error', 'leave_story_offline');
      (console.error as jest.Mock).mockRestore();
    });

    it('still removes the copy when the owner had already removed them (404)', async () => {
      const view = await asCollaborator();
      mockApi.leaveStory.mockRejectedValueOnce({ response: { status: 404 } });
      const onLeft = jest.fn();

      await act(async () => view.result.current.handleLeaveStory(onLeft));
      await confirm();

      expect(mockStoryService.discardCollaboratedCopy).toHaveBeenCalledWith('story-1');
      expect(onLeft).toHaveBeenCalledTimes(1);
    });
  });

  it('unlinks from the server only after confirmation, and distinguishes offline', async () => {
    const { isOfflineError } = jest.requireMock('@/src/services/api/apiClient') as {
      isOfflineError: jest.Mock;
    };
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));

    await act(async () => view.result.current.handleUnlinkFromServer());
    expect(mockStoryService.unlinkFromServer).not.toHaveBeenCalled();
    const buttons = mockAlert.mock.calls[0]?.[2] as { onPress?: () => Promise<void> }[];
    await act(async () => buttons[1]?.onPress?.());

    expect(mockStoryService.unlinkFromServer).toHaveBeenCalledWith('user-1', 'story-1');
    expect(mockAlert).toHaveBeenCalledWith('success', 'unlink_from_server_success');
    expect(view.result.current.serverId).toBeNull();

    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockStoryService.unlinkFromServer.mockRejectedValueOnce(new Error('boom'));
    const retry = await renderHook(() => useStoryServerCollaboration('story-1'));
    await act(async () => retry.result.current.handleUnlinkFromServer());
    const retryButtons = mockAlert.mock.calls.at(-1)?.[2] as {
      onPress?: () => Promise<void>;
    }[];
    isOfflineError.mockReturnValueOnce(false);
    await act(async () => retryButtons[1]?.onPress?.());
    expect(mockAlert).toHaveBeenCalledWith('error', 'unlink_from_server_failed');

    mockStoryService.unlinkFromServer.mockRejectedValueOnce(new Error('offline'));
    isOfflineError.mockReturnValueOnce(true);
    await act(async () => retry.result.current.handleUnlinkFromServer());
    const offlineButtons = mockAlert.mock.calls.at(-1)?.[2] as {
      onPress?: () => Promise<void>;
    }[];
    await act(async () => offlineButtons[1]?.onPress?.());
    expect(mockAlert).toHaveBeenCalledWith('error', 'unlink_from_server_offline');
    (console.error as jest.Mock).mockRestore();
  });

  it('shows unanswered invitations of the story and keeps their invitees out of the picker', async () => {
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    mockFriendshipService.getAllFriendships.mockResolvedValue([
      {
        serverId: 'server-1',
        status: 'friend',
        otherUserId: 'friend-3',
        friendUsername: 'Invited',
      },
      { serverId: 'server-1', status: 'friend', otherUserId: 'friend-2', friendUsername: 'Other' },
    ]);
    const otherStory = {
      ...(pendingInvitation as object),
      id: 'inv-2',
      storyId: 'story-9',
    } as never;
    mockInvitationList.setState({ invitations: [pendingInvitation, otherStory] });
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));

    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));
    expect(view.result.current.pendingInvitations).toEqual([pendingInvitation]);
    await waitFor(() =>
      expect(view.result.current.addableFriendOptions).toEqual([
        { label: 'Other', value: 'friend-2' },
      ]),
    );

    await act(async () =>
      view.result.current.handleUpdateInvitationRole(pendingInvitation, 'writer'),
    );
    expect(mockInvite).toHaveBeenCalledWith(server, 'story-1', 'friend-3', 'writer');

    await act(async () => view.result.current.handleCancelInvitation(pendingInvitation));
    const [, , buttons] = mockAlert.mock.calls.at(-1);
    await act(async () => buttons[1].onPress());
    expect(mockCloseInvitation).toHaveBeenCalledWith(mockDb, server, pendingInvitation);
  });

  it('fetches the collaborators again when an invitation is answered', async () => {
    mockStoryState.selectedStory = { id: 'story-1', serverId: 'server-1' };
    mockInvitationList.setState({ invitations: [pendingInvitation] });
    const view = await renderHook(() => useStoryServerCollaboration('story-1'));
    await waitFor(() => expect(view.result.current.collaborators).toEqual([collaborator]));
    const calls = mockApi.getCollaborators.mock.calls.length;

    await act(async () => mockInvitationList.setState({ invitations: [] }));

    await waitFor(() => expect(mockApi.getCollaborators.mock.calls.length).toBe(calls + 1));
  });
});

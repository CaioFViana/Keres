const mockFindMany = jest.fn();
const mockInvite = jest.fn();
const mockSync = jest.fn(async (..._args: unknown[]) => undefined);
const mockNotify = jest.fn();
const mockAlert = jest.fn();
// One object for the whole test: the real hook hands out the same database every render.
const mockDb = { query: { stories: { findMany: (...args: unknown[]) => mockFindMany(...args) } } };

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('../../src/services/StoryInvitationApiService', () => ({
  storyInvitationApi: { invite: (...args: unknown[]) => mockInvite(...args) },
}));
jest.mock('../../src/services/StoryInvitationService', () => ({
  createStoryInvitationService: () => ({
    syncWithServer: (...args: unknown[]) => mockSync(...args),
  }),
}));
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: () => ({ showNotification: (...args: unknown[]) => mockNotify(...args) }),
}));
jest.mock('../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useInviteFriendToStory } from '../../src/hooks/useInviteFriendToStory';

const server = { id: 'srv-1', name: 'Main' } as never;
const NONE: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockFindMany.mockResolvedValue([
    { id: 's2', title: 'Zebra' },
    { id: 's1', title: 'Abelha' },
  ]);
  mockInvite.mockResolvedValue({ inviteeUsername: 'Zoe' });
});

const setup = (over: Partial<Parameters<typeof useInviteFriendToStory>[0]> = {}) => {
  const onInvited = jest.fn();
  const options = {
    open: true,
    server,
    friendId: 'friend-1',
    excludeStoryIds: NONE,
    onInvited,
    ...over,
  };
  return { onInvited, hook: renderHook(() => useInviteFriendToStory(options)) };
};

describe('useInviteFriendToStory', () => {
  it('reads the stories the person owns on this server, by name, once it is open', async () => {
    const { hook } = setup();
    const { result } = await hook;

    await waitFor(() => expect(result.current.stories).not.toBeNull());
    expect(result.current.stories).toEqual([
      { id: 's1', title: 'Abelha' },
      { id: 's2', title: 'Zebra' },
    ]);
  });

  it('leaves out the stories that need no invitation', async () => {
    const { result } = await setup({ excludeStoryIds: ['s1'] }).hook;

    await waitFor(() => expect(result.current.stories).toEqual([{ id: 's2', title: 'Zebra' }]));
  });

  it('reads nothing while closed, or before the server is known', async () => {
    await setup({ open: false }).hook;
    await setup({ server: null }).hook;

    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('sends the invitation, refreshes the invitations, tells the person and reports success', async () => {
    const { hook, onInvited } = setup();
    const { result } = await hook;

    let sent = false;
    await act(async () => {
      sent = await result.current.invite('s2', 'writer');
    });

    expect(sent).toBe(true);
    expect(mockInvite).toHaveBeenCalledWith(server, 's2', 'friend-1', 'writer');
    expect(mockSync).toHaveBeenCalledWith(server);
    expect(mockNotify).toHaveBeenCalledWith('story_invitation_sent', 'success');
    expect(onInvited).toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  it('says why when the story is adults-only and the friend is not verified', async () => {
    mockInvite.mockRejectedValue({ response: { status: 403 } });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { hook, onInvited } = setup();
    const { result } = await hook;

    let sent = true;
    await act(async () => {
      sent = await result.current.invite('s1', 'reader');
    });

    expect(sent).toBe(false);
    expect(mockAlert).toHaveBeenCalledWith('error', 'invite_nsfw_blocked');
    expect(onInvited).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
    error.mockRestore();
  });

  it('gives the plain failure for any other refusal', async () => {
    mockInvite.mockRejectedValue(new Error('boom'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await setup().hook;

    await act(async () => {
      await result.current.invite('s1', 'reader');
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'invite_collaborator_failed');
    error.mockRestore();
  });

  it('sends nothing without a server or a friend', async () => {
    const { result } = await setup({ friendId: null }).hook;

    let sent = true;
    await act(async () => {
      sent = await result.current.invite('s1', 'reader');
    });

    expect(sent).toBe(false);
    expect(mockInvite).not.toHaveBeenCalled();
  });
});

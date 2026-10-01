import { act, fireEvent, render } from '@testing-library/react-native';

const mockAccept = jest.fn();
const mockClose = jest.fn();
const mockAlert = jest.fn();
const mockNotify = jest.fn();
const mockDb = {};

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      secondary: '#0a0',
      error: '#f00',
      card: '#fff',
      border: '#ddd',
      background: '#fff',
    },
  }),
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));
jest.mock('../../src/services/storyInvitationActions', () => ({
  __esModule: true,
  acceptStoryInvitation: (...args: unknown[]) => mockAccept(...args),
  closeStoryInvitation: (...args: unknown[]) => mockClose(...args),
}));
let mockInvitations: unknown[] = [];
jest.mock('../../src/hooks/useStoryInvitations', () => ({
  __esModule: true,
  useStoryInvitations: () => mockInvitations,
}));

import StoryInvitationList from '../../src/components/features/story/StoryInvitationList/StoryInvitationList';

const server = { id: 'server-1', idUser: 'me' };
const serverFor = (id: string) => (id === 'server-1' ? (server as never) : undefined);

const received = {
  id: 'inv-1',
  serverId: 'server-1',
  serverUserId: 'me',
  storyId: 'story-1',
  storyTitle: 'A Queda',
  inviterId: 'ana',
  inviterUsername: 'Ana',
  inviteeId: 'me',
  inviteeUsername: 'Me',
  permissionType: 'writer' as const,
  createdAt: '2026-09-27T10:00:00.000Z',
};
const sent = {
  ...received,
  id: 'inv-2',
  storyTitle: 'Minha',
  inviterId: 'me',
  inviterUsername: 'Me',
  inviteeId: 'bia',
  inviteeUsername: 'Bia',
  permissionType: 'reader' as const,
};

/** Presses the confirmation dialog's "proceed". */
async function confirmLastAlert() {
  const [, , buttons] = mockAlert.mock.calls.at(-1);
  await act(async () => buttons[1].onPress());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccept.mockResolvedValue(undefined);
  mockClose.mockResolvedValue(undefined);
  mockInvitations = [received, sent];
});

describe('StoryInvitationList', () => {
  it('renders nothing without invitations', async () => {
    mockInvitations = [];
    const view = await render(<StoryInvitationList serverFor={serverFor} />);

    expect(view.queryByTestId('story-invitation-list')).toBeNull();
  });

  it('splits received from sent, naming the other side and the offered role', async () => {
    const view = await render(<StoryInvitationList serverFor={serverFor} />);

    expect(view.getByText('story_invitations_received')).toBeTruthy();
    expect(view.getByText('story_invitations_sent')).toBeTruthy();
    expect(view.getByText('A Queda')).toBeTruthy();
    expect(
      view.getByText('story_invitation_from:{"name":"Ana","role":"permission_writer"}'),
    ).toBeTruthy();
    expect(
      view.getByText('story_invitation_to:{"name":"Bia","role":"permission_reader"}'),
    ).toBeTruthy();
    expect(view.getByTestId('story-invitation-accept-inv-1')).toBeTruthy();
    expect(view.queryByTestId('story-invitation-accept-inv-2')).toBeNull();
    expect(view.getByTestId('story-invitation-withdraw-inv-2')).toBeTruthy();
  });

  it('accepts only after confirmation, and says so', async () => {
    const view = await render(<StoryInvitationList serverFor={serverFor} />);

    await fireEvent.press(view.getByTestId('story-invitation-accept-inv-1'));
    expect(mockAccept).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      'story_invitation_accept',
      'story_invitation_accept_message',
      expect.any(Array),
      { cancelable: true },
    );

    await confirmLastAlert();
    expect(mockAccept).toHaveBeenCalledWith(mockDb, server, received);
    expect(mockNotify).toHaveBeenCalledWith(
      'story_invitation_accepted:{"story":"A Queda"}',
      'success',
    );
  });

  it('declines a received invitation and withdraws a sent one', async () => {
    const view = await render(<StoryInvitationList serverFor={serverFor} />);

    await fireEvent.press(view.getByTestId('story-invitation-decline-inv-1'));
    await confirmLastAlert();
    await fireEvent.press(view.getByTestId('story-invitation-withdraw-inv-2'));
    await confirmLastAlert();

    expect(mockClose).toHaveBeenNthCalledWith(1, mockDb, server, received);
    expect(mockClose).toHaveBeenNthCalledWith(2, mockDb, server, sent);
  });

  it('reports a failed answer', async () => {
    mockAccept.mockRejectedValue(new Error('gone'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const view = await render(<StoryInvitationList serverFor={serverFor} />);

    await fireEvent.press(view.getByTestId('story-invitation-accept-inv-1'));
    await confirmLastAlert();

    expect(mockNotify).toHaveBeenCalledWith('story_invitation_failed', 'error');
  });

  it('hides invitations of servers this device no longer knows', async () => {
    mockInvitations = [{ ...received, serverId: 'server-9' }];
    const view = await render(<StoryInvitationList serverFor={serverFor} />);

    expect(view.queryByTestId('story-invitation-list')).toBeNull();
  });
});

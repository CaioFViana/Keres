const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockUnsubscribe = jest.fn();
const mockFocusListeners: Array<() => void> = [];
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
  addListener: (_event: string, cb: () => void) => {
    mockFocusListeners.push(cb);
    return mockUnsubscribe;
  },
};
const mockRoute: { params: { friendshipId: string } } = { params: { friendshipId: 'f1' } };
const mockDrizzle = {};
const mockGetAllFriendships = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockCancelSent = jest.fn();
const mockUnfriend = jest.fn();
const mockBlacklist = jest.fn();
const mockUnblacklist = jest.fn();
const mockGetAllServers = jest.fn();
const mockNotify = jest.fn();
const mockNotificationState = { showNotification: (...args: unknown[]) => mockNotify(...args) };
const mockSetTheme = jest.fn();
const mockColors = {
  primary: '#0000ff',
  onPrimary: '#ffffff',
  primaryContainer: '#e0e0ff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  onSecondary: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  surface: '#f5f5f5',
  border: '#cccccc',
  error: '#ff0000',
  onError: '#ffffff',
  accent: '#ff8800',
  onAccent: '#000000',
  notification: '#00aaff',
  onNotification: '#000000',
  shadow: '#000000',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => mockI18n,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

jest.mock('../../../src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../../src/services/FriendshipService', () => ({
  createFriendshipService: () => ({
    getAllFriendships: (...args: unknown[]) => mockGetAllFriendships(...args),
    acceptFriendRequest: (...args: unknown[]) => mockAccept(...args),
    declineFriendRequest: (...args: unknown[]) => mockDecline(...args),
    cancelSentFriendRequest: (...args: unknown[]) => mockCancelSent(...args),
    unfriendUser: (...args: unknown[]) => mockUnfriend(...args),
    blacklistUser: (...args: unknown[]) => mockBlacklist(...args),
    unblacklistUser: (...args: unknown[]) => mockUnblacklist(...args),
  }),
}));

jest.mock('../../../src/services/ServerService', () => ({
  createServerService: () => ({
    getAllServers: (...args: unknown[]) => mockGetAllServers(...args),
  }),
}));

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { withSilencedConsole } from '../../helpers/silenceConsole';
import FriendDetailScreen from '../../../src/screens/enterstack/FriendDetailScreen';

const server = { id: 'srv-1', idUser: 'me-on-server', name: 'Main' };

function friendship(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    serverId: 'srv-1',
    status: FriendStatus.PENDING,
    senderId: 'them',
    receiverId: 'me-on-server',
    friendUsername: 'Zoe',
    otherUserTag: 'zoe',
    otherUserBio: 'Hello there',
    otherUserAvatarColor: null,
    otherUserAvatarIcon: null,
    otherUserId: 'them',
    serverName: 'Main',
    blockedById: null,
    ...overrides,
  };
}

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

describe('FriendDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusListeners.length = 0;
    mockRoute.params = { friendshipId: 'f1' };
    mockCanGoBack.mockReturnValue(true);
    mockGetAllServers.mockResolvedValue([server]);
    mockGetAllFriendships.mockResolvedValue([friendship()]);
    mockAccept.mockResolvedValue(undefined);
    mockDecline.mockResolvedValue(undefined);
    mockCancelSent.mockResolvedValue(undefined);
    mockUnfriend.mockResolvedValue(undefined);
    mockBlacklist.mockResolvedValue(undefined);
    mockUnblacklist.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a received request with accept, decline and blacklist', async () => {
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');
    expect(view.getByText('status_pending')).toBeTruthy();
    expect(view.getByText(/zoe/)).toBeTruthy();
    expect(view.getByText('bio')).toBeTruthy();
    expect(view.getByText('Hello there')).toBeTruthy();
    expect(view.getByText('accept_request_confirmation_title')).toBeTruthy();
    expect(view.getByText('decline_request_confirmation_title')).toBeTruthy();
    expect(view.getByText('blacklist_confirmation_title')).toBeTruthy();

    await fireEvent.press(view.getByText('accept_request_confirmation_title'));
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockNotify).toHaveBeenCalledWith('request_accepted_successfully', 'success');
  });

  it('shows a sent request with a single cancel action', async () => {
    mockGetAllFriendships.mockResolvedValue([
      friendship({
        senderId: 'me-on-server',
        receiverId: 'them',
        otherUserBio: null,
        otherUserTag: null,
      }),
    ]);
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');
    expect(view.getByText('cancel_request_confirmation_title')).toBeTruthy();
    expect(view.queryByText('accept_request_confirmation_title')).toBeNull();
    expect(view.queryByText('bio')).toBeNull();

    await fireEvent.press(view.getByText('cancel_request_confirmation_title'));
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() => expect(mockCancelSent).toHaveBeenCalledWith('f1', 'me-on-server'));
  });

  it('shows a friend with unfriend and blacklist actions', async () => {
    mockGetAllFriendships.mockResolvedValue([friendship({ status: FriendStatus.FRIEND })]);
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');
    expect(view.getByText('status_friend')).toBeTruthy();
    expect(view.getByText('unfriend_confirmation_title')).toBeTruthy();

    await fireEvent.press(view.getByText('unfriend_confirmation_title'));
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() => expect(mockUnfriend).toHaveBeenCalledWith('f1', 'me-on-server'));
  });

  it('lets only the blocking side undo a blacklist', async () => {
    mockGetAllFriendships.mockResolvedValue([
      friendship({ status: FriendStatus.BLACKLISTED, blockedById: 'me-on-server' }),
    ]);
    const byMe = await render(<FriendDetailScreen />);
    await byMe.findByText('status_blacklisted');
    expect(byMe.getByText('unblacklist_confirmation_title')).toBeTruthy();
    await fireEvent.press(byMe.getByText('unblacklist_confirmation_title'));
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() => expect(mockUnblacklist).toHaveBeenCalledWith('f1', 'me-on-server'));

    mockGetAllFriendships.mockResolvedValue([
      friendship({ status: FriendStatus.BLACKLISTED, blockedById: 'them' }),
    ]);
    const byOther = await render(<FriendDetailScreen />);
    await byOther.findByText('blocked_by_other_user');
    expect(byOther.queryByText('unblacklist_confirmation_title')).toBeNull();
  });

  it('navigates away once when the friendship is gone', async () => {
    mockGetAllFriendships.mockResolvedValue([]);
    const view = await render(<FriendDetailScreen />);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));

    const cbs = [...mockFocusListeners];
    await act(async () => {
      for (const cb of cbs) cb();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(view).toBeTruthy();
  });

  it('reports load failures without leaving', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllFriendships.mockRejectedValue(new Error('db down'));
      const view = await render(<FriendDetailScreen />);
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('failed_to_load_friendships', 'error'),
      );
      await view.findByText('friendship_not_found');
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });
});

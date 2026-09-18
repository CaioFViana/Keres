const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { goBack: (...args: unknown[]) => mockGoBack(...args) };
const mockRoute: { params: { serverId: string } } = { params: { serverId: 'srv-1' } };
const mockDrizzle = {};
const mockGetServerById = jest.fn();
const mockGetOwnProfile = jest.fn();
const mockUpdateProfile = jest.fn();
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

jest.mock('../../../src/services/ServerService', () => ({
  createServerService: () => ({
    getServerById: (...args: unknown[]) => mockGetServerById(...args),
  }),
}));

jest.mock('../../../src/services/apiClient', () => ({
  __esModule: true,
  default: {},
  apiUrl: (base: string, path: string) => `${base}${path}`,
  isOfflineError: (err: unknown) => !!(err as { isOffline?: boolean } | null)?.isOffline,
}));

jest.mock('../../../src/services/UserApiService', () => ({
  userApiService: {
    getOwnProfile: (...args: unknown[]) => mockGetOwnProfile(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

jest.mock('../../../src/components/common/inputs/ColorPickerInput/ColorPickerInput', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      currentColor,
      onSelectColor,
      placeholder,
    }: {
      currentColor: string;
      onSelectColor: (color: string) => void;
      placeholder: string;
    }) => (
      <>
        <Text testID="color-picker">{`${placeholder}:${currentColor}`}</Text>
        <Text testID="pick-color" onPress={() => onSelectColor('#aabbcc')}>
          pick-color
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/components/common/inputs/IconPickerInput/IconPickerInput', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      currentIcon,
      onSelectIcon,
      placeholder,
    }: {
      currentIcon: string | null;
      onSelectIcon: (icon: string) => void;
      placeholder: string;
    }) => (
      <>
        <Text testID="icon-picker">{`${placeholder}:${currentIcon}`}</Text>
        <Text testID="pick-icon" onPress={() => onSelectIcon('star')}>
          pick-icon
        </Text>
      </>
    ),
  };
});

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import MyProfileScreen from '../../../src/screens/enterstack/MyProfileScreen';

const server = { id: 'srv-1', idUser: 'user-on-server' };

describe('MyProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1' };
    mockGetServerById.mockResolvedValue(server);
    mockGetOwnProfile.mockResolvedValue({
      avatarColor: '#112233',
      avatarIcon: 'heart',
      bio: 'hello',
    });
    mockUpdateProfile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('loads the profile into the form', async () => {
    const view = await render(<MyProfileScreen />);
    await view.findByText('avatar_color');
    expect(view.getByText('avatar_icon')).toBeTruthy();
    expect(view.getByText('bio')).toBeTruthy();
    expect(view.getByTestId('color-picker').props.children).toBe('select_avatar_color:#112233');
    expect(view.getByTestId('icon-picker').props.children).toBe('select_avatar_icon:heart');
    expect(view.getByPlaceholderText('bio_placeholder').props.value).toBe('hello');
    expect(view.getByText(/5\/200/)).toBeTruthy();
  });

  it('shows the error screen without a server', async () => {
    mockGetServerById.mockResolvedValue(null);
    const view = await render(<MyProfileScreen />);
    await view.findByText('server_not_found');
    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('starts blank without a stored profile', async () => {
    mockGetOwnProfile.mockResolvedValue(null);
    const view = await render(<MyProfileScreen />);
    await view.findByText('avatar_color');
    expect(view.getByTestId('color-picker').props.children).toBe('select_avatar_color:');
    expect(view.getByPlaceholderText('bio_placeholder').props.value).toBe('');
    expect(view.getByText(/0\/200/)).toBeTruthy();
  });

  it('maps load failures to specific messages', async () => {
    mockGetOwnProfile.mockRejectedValueOnce({ isOffline: true });
    const offline = await render(<MyProfileScreen />);
    await offline.findByText('server_unreachable');

    mockGetOwnProfile.mockRejectedValueOnce(new Error('boom'));
    const failed = await render(<MyProfileScreen />);
    await failed.findByText('failed_to_load_profile');
  });

  it('caps the bio at 200 characters', async () => {
    const view = await render(<MyProfileScreen />);
    await view.findByText('avatar_color');
    await fireEvent.changeText(view.getByPlaceholderText('bio_placeholder'), 'x'.repeat(250));
    expect(view.getByPlaceholderText('bio_placeholder').props.value).toHaveLength(200);
    expect(view.getByText(/200\/200/)).toBeTruthy();
  });

  it('saves the edited profile and navigates back', async () => {
    const view = await render(<MyProfileScreen />);
    await view.findByText('save');
    await fireEvent.press(view.getByTestId('pick-color'));
    await fireEvent.press(view.getByTestId('pick-icon'));
    await fireEvent.changeText(view.getByPlaceholderText('bio_placeholder'), '  spaced  ');
    await fireEvent.press(view.getByText('save'));
    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(server, {
        avatarColor: '#aabbcc',
        avatarIcon: 'star',
        bio: 'spaced',
      }),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'profile_updated_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('saves a blank bio as null', async () => {
    const view = await render(<MyProfileScreen />);
    await view.findByText('save');
    await fireEvent.changeText(view.getByPlaceholderText('bio_placeholder'), '   ');
    await fireEvent.press(view.getByText('save'));
    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        server,
        expect.objectContaining({ bio: null }),
      ),
    );
  });

  it('maps save failures to specific messages', async () => {
    mockUpdateProfile.mockRejectedValueOnce({ isOffline: true });
    const view = await render(<MyProfileScreen />);
    await view.findByText('save');
    await fireEvent.press(view.getByText('save'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'server_unreachable'));
    expect(mockGoBack).not.toHaveBeenCalled();

    mockUpdateProfile.mockRejectedValueOnce(new Error('boom'));
    await fireEvent.press(view.getByText('save'));
    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_update_profile'),
    );
  });
});

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import PublicProfileScreen from '@/src/screens/enter-stack/account/PublicProfileScreen';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';

const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { goBack: (...args: unknown[]) => mockGoBack(...args) };
const mockRoute: { params: { serverId: string } } = { params: { serverId: 'srv-1' } };
const mockDrizzle = {};
const mockGetServerById = jest.fn();
const mockGetPublicProfile = jest.fn();
const mockUpdatePublicProfile = jest.fn();
const mockGetOwnProfile = jest.fn();
const mockIsShowcaseEnabled = jest.fn();
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

jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: jest.fn(), colors: mockColors }),
  };
});

jest.mock('@/src/hooks/nav/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

jest.mock('@/src/hooks/nav/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

jest.mock('@/src/hooks/forms/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

jest.mock('@/src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('@/src/state/ui/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('@/src/services/servers/ServerService', () => ({
  createServerService: () => ({
    getServerById: (...args: unknown[]) => mockGetServerById(...args),
  }),
}));

jest.mock('@/src/services/api/apiClient', () => ({
  __esModule: true,
  default: {},
  apiUrl: (base: string, path: string) => `${base}${path}`,
  isOfflineError: (err: unknown) => !!(err as { isOffline?: boolean } | null)?.isOffline,
}));

jest.mock('@/src/services/api/UserApiService', () => ({
  userApiService: {
    getPublicProfile: (...args: unknown[]) => mockGetPublicProfile(...args),
    updatePublicProfile: (...args: unknown[]) => mockUpdatePublicProfile(...args),
    getOwnProfile: (...args: unknown[]) => mockGetOwnProfile(...args),
  },
}));

jest.mock('@/src/services/api/PublicationApiService', () => ({
  publicationApiService: {
    isShowcaseEnabled: (...args: unknown[]) => mockIsShowcaseEnabled(...args),
  },
}));

// The picker repaints the app while a palette is tried on; here it only reports what was picked.
jest.mock('@/src/components/common/inputs/ThemePickerModal/ThemePickerModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      visible,
      description,
      onConfirm,
      onPreview,
    }: {
      visible: boolean;
      description?: string;
      onConfirm: (name: string) => void;
      onPreview: (name: string) => void;
    }) => {
      // The screen must not let a preview repaint the app: it hands over a function that does nothing.
      onPreview('ocean');
      return visible ? (
        <Text
          testID="theme-picker"
          accessibilityHint={description}
          onPress={() => onConfirm('ocean')}
        >
          theme-picker
        </Text>
      ) : null;
    },
  };
});

const server = { id: 'srv-1', idUser: 'user-on-server', url: 'https://keres.example.com/' };

describe('PublicProfileScreen', () => {
  let openUrl: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1' };
    mockGetServerById.mockResolvedValue(server);
    mockGetPublicProfile.mockResolvedValue({
      biography: 'I draw comics.',
      links: [{ label: 'Site', url: 'https://example.com' }],
      theme: 'forest',
    });
    mockGetOwnProfile.mockResolvedValue({ username: 'ana maria' });
    mockUpdatePublicProfile.mockResolvedValue(undefined);
    mockIsShowcaseEnabled.mockResolvedValue(true);
    openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    openUrl.mockRestore();
    await cleanup();
  });

  it('loads the texts into the form', async () => {
    const view = await render(<PublicProfileScreen />);
    await view.findByText('author_page_biography');

    expect(view.getByPlaceholderText('author_page_biography_placeholder').props.value).toBe(
      'I draw comics.',
    );
    expect(view.getByTestId('author-page-link-label-0').props.value).toBe('Site');
    expect(view.getByTestId('author-page-link-url-0').props.value).toBe('https://example.com');
    expect(view.getByTestId('author-page-theme-value').props.children).toBe('theme_forest_label');
    expect(view.getByText(/14\/4000/)).toBeTruthy();
  });

  it('starts empty for an account that never wrote any', async () => {
    mockGetPublicProfile.mockResolvedValue({ biography: null, links: [], theme: null });
    const view = await render(<PublicProfileScreen />);
    await view.findByText('author_page_biography');

    expect(view.getByPlaceholderText('author_page_biography_placeholder').props.value).toBe('');
    expect(view.queryByTestId('author-page-link-0')).toBeNull();
    expect(view.getByTestId('author-page-theme-value').props.children).toBe(
      'author_page_theme_site',
    );
    expect(view.queryByTestId('author-page-theme-clear')).toBeNull();
  });

  it('is empty too on a server that does not know the route', async () => {
    mockGetPublicProfile.mockResolvedValue(undefined);
    const view = await render(<PublicProfileScreen />);
    await view.findByText('author_page_biography');
    expect(view.getByPlaceholderText('author_page_biography_placeholder').props.value).toBe('');
  });

  it('warns when the showcase is off, and offers no link to the page', async () => {
    mockIsShowcaseEnabled.mockResolvedValue(false);
    const view = await render(<PublicProfileScreen />);
    await view.findByText('author_page_showcase_off');
    expect(view.queryByTestId('author-page-view')).toBeNull();
  });

  it('opens the public page of the author, with the name encoded', async () => {
    const view = await render(<PublicProfileScreen />);
    await view.findByTestId('author-page-view');
    await fireEvent.press(view.getByTestId('author-page-view'));
    expect(openUrl).toHaveBeenCalledWith('https://keres.example.com/showcase/author/ana%20maria');
  });

  it('caps the biography', async () => {
    const view = await render(<PublicProfileScreen />);
    await view.findByText('author_page_biography');
    await fireEvent.changeText(
      view.getByPlaceholderText('author_page_biography_placeholder'),
      'x'.repeat(4500),
    );
    expect(view.getByPlaceholderText('author_page_biography_placeholder').props.value).toHaveLength(
      4000,
    );
  });

  it('adds, edits and removes link rows, up to the limit', async () => {
    mockGetPublicProfile.mockResolvedValue({ biography: null, links: [], theme: null });
    const view = await render(<PublicProfileScreen />);
    await view.findByTestId('author-page-add-link');

    for (let index = 0; index < 8; index += 1) {
      await fireEvent.press(view.getByTestId('author-page-add-link'));
    }
    expect(view.getByTestId('author-page-link-7')).toBeTruthy();
    expect(view.getByTestId('author-page-add-link').props.accessibilityState?.disabled).toBe(true);

    await fireEvent.changeText(view.getByTestId('author-page-link-label-0'), 'Shop');
    expect(view.getByTestId('author-page-link-label-0').props.value).toBe('Shop');

    await fireEvent.press(view.getByTestId('author-page-link-remove-0'));
    expect(view.queryByTestId('author-page-link-7')).toBeNull();
    expect(view.getByTestId('author-page-link-label-0').props.value).toBe('');
  });

  it('saves the texts, completing an address typed without its scheme, and goes back', async () => {
    const view = await render(<PublicProfileScreen />);
    await view.findByTestId('author-page-save');
    await fireEvent.changeText(
      view.getByPlaceholderText('author_page_biography_placeholder'),
      '  New text  ',
    );
    await fireEvent.changeText(view.getByTestId('author-page-link-url-0'), 'example.org/me');
    await fireEvent.press(view.getByTestId('author-page-add-link'));
    await fireEvent.press(view.getByTestId('author-page-theme-select'));
    // The picker speaks of the author page, not of a story.
    expect(view.getByTestId('theme-picker').props.accessibilityHint).toBe(
      'author_page_theme_picker_description',
    );
    await fireEvent.press(view.getByTestId('theme-picker'));
    await fireEvent.press(view.getByTestId('author-page-save'));

    await waitFor(() =>
      expect(mockUpdatePublicProfile).toHaveBeenCalledWith(server, {
        biography: 'New text',
        // The row left completely empty is dropped.
        links: [{ label: 'Site', url: 'https://example.org/me' }],
        theme: 'ocean',
      }),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'author_page_saved');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('clears the biography and the theme', async () => {
    const view = await render(<PublicProfileScreen />);
    await view.findByTestId('author-page-save');
    await fireEvent.changeText(
      view.getByPlaceholderText('author_page_biography_placeholder'),
      '  ',
    );
    await fireEvent.press(view.getByTestId('author-page-theme-clear'));
    await fireEvent.press(view.getByTestId('author-page-save'));

    await waitFor(() =>
      expect(mockUpdatePublicProfile).toHaveBeenCalledWith(server, {
        biography: null,
        links: [{ label: 'Site', url: 'https://example.com' }],
        theme: null,
      }),
    );
  });

  it('does not send a link that is not a web address, and says which one', async () => {
    const view = await render(<PublicProfileScreen />);
    await view.findByTestId('author-page-save');
    await fireEvent.changeText(view.getByTestId('author-page-link-url-0'), 'javascript:alert(1)');
    await fireEvent.press(view.getByTestId('author-page-save'));

    expect(mockUpdatePublicProfile).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('error', 'author_page_invalid_link');
    expect(view.getByText('author_page_link_url_invalid')).toBeTruthy();

    // Touching the row takes the complaint away.
    await fireEvent.changeText(view.getByTestId('author-page-link-url-0'), 'example.com');
    expect(view.queryByText('author_page_link_url_invalid')).toBeNull();
  });

  it('asks for a name when a link has an address and no label', async () => {
    const view = await render(<PublicProfileScreen />);
    await view.findByTestId('author-page-save');
    await fireEvent.changeText(view.getByTestId('author-page-link-label-0'), ' ');
    await fireEvent.press(view.getByTestId('author-page-save'));

    expect(mockUpdatePublicProfile).not.toHaveBeenCalled();
    expect(view.getByText('author_page_link_label_missing')).toBeTruthy();
  });

  it('maps load and save failures to specific messages', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetPublicProfile.mockRejectedValueOnce({ isOffline: true });
      const offline = await render(<PublicProfileScreen />);
      await offline.findByText('server_unreachable');

      mockGetPublicProfile.mockRejectedValueOnce(new Error('boom'));
      const failed = await render(<PublicProfileScreen />);
      await failed.findByText('author_page_load_failed');

      mockUpdatePublicProfile.mockRejectedValueOnce({ isOffline: true });
      const view = await render(<PublicProfileScreen />);
      await view.findByTestId('author-page-save');
      await fireEvent.press(view.getByTestId('author-page-save'));
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'server_unreachable'));
      expect(mockGoBack).not.toHaveBeenCalled();

      mockUpdatePublicProfile.mockRejectedValueOnce(new Error('boom'));
      await fireEvent.press(view.getByTestId('author-page-save'));
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'author_page_save_failed'),
      );
    });
  });

  it('shows the error screen without a server', async () => {
    mockGetServerById.mockResolvedValue(null);
    const view = await render(<PublicProfileScreen />);
    await view.findByText('server_not_found');
    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});

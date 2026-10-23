import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ShowcaseAuthorScreen from '@/src/screens/showcase/ShowcaseAuthorScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockHeader = jest.fn();
const mockGetServerById = jest.fn();
const mockGetAuthor = jest.fn();
const mockRoute: { params: Record<string, unknown> } = { params: {} };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: (...args: unknown[]) => mockNavigate(...args),
    goBack: (...args: unknown[]) => mockGoBack(...args),
    getParent: () => ({ navigate: (...args: unknown[]) => mockParentNavigate(...args) }),
  }),
  useRoute: () => mockRoute,
}));
jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
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
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: jest.fn(), colors: mockColors }),
  };
});
jest.mock('@/src/hooks/nav/useScreenHeader', () => ({
  useScreenHeader: (options: unknown) => mockHeader(options),
}));
jest.mock('@/src/hooks/nav/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
const mockDb = {};
jest.mock('@/src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('@/src/services/servers/ServerService', () => ({
  createServerService: () => ({
    getServerById: (...args: unknown[]) => mockGetServerById(...args),
  }),
}));
jest.mock('@/src/services/api/apiClient', () => ({
  isNotFoundError: (error: { response?: { status?: number } } | null) =>
    error?.response?.status === 404,
  isOfflineError: (error: { code?: string } | null) => error?.code === 'NO_RESPONSE',
}));
jest.mock('@/src/services/api/ShowcaseApiService', () => ({
  showcaseSourceUrl: (source: { kind: string; origin?: string; server?: { url: string } }) =>
    source.kind === 'server' ? source.server!.url : source.origin,
  showcaseCoverUrl: (_source: unknown, storyId: string) => `cover://${storyId}`,
  showcaseApiService: { getAuthor: (...args: unknown[]) => mockGetAuthor(...args) },
}));

const server = { id: 'srv-1', name: 'Main', url: 'https://keres.example' };

function page(overrides: Record<string, unknown> = {}) {
  return {
    owner: { username: 'ana', tag: 'ana', avatarColor: '#6200ee', avatarIcon: 'book-outline' },
    biography: 'Comics about small towns.',
    links: [
      { label: 'Shop', url: 'https://shop.example/ana' },
      { label: 'Odd', url: 'javascript:alert(1)' },
      { label: 'Broken', url: 'http://' },
    ],
    theme: null,
    stories: [
      {
        storyId: 'S1',
        isNsfw: false,
        hasCover: true,
        snapshot: { title: 'The Valley', genre: 'Fantasy', type: 'linear' },
        owner: { username: 'ana', tag: 'ana' },
        versionCount: 1,
      },
    ],
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

describe('ShowcaseAuthorScreen', () => {
  let openUrl: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1', username: 'ana' };
    mockGetServerById.mockResolvedValue(server);
    mockGetAuthor.mockResolvedValue(page());
    openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    openUrl.mockRestore();
    await cleanup();
  });

  it('shows who the author is in their own words, and what they have on show', async () => {
    const view = await render(<ShowcaseAuthorScreen />);

    await waitFor(() => expect(view.getByText('ana')).toBeTruthy());
    expect(mockGetAuthor).toHaveBeenCalledWith({ kind: 'server', server }, 'ana');
    expect(view.getByText('Comics about small towns.')).toBeTruthy();
    expect(view.getByText('The Valley')).toBeTruthy();
    // The stories are all this author's: the row does not say so again.
    expect(view.queryByText('showcase_published_by')).toBeNull();
    expect(view.getByTestId('showcase-cover-S1')).toBeTruthy();
    expect(view.queryByTestId('showcase-guest-banner')).toBeNull();
  });

  it('lists the links with where they go, and only the ones that go to the web', async () => {
    const view = await render(<ShowcaseAuthorScreen />);
    await waitFor(() => expect(view.getByTestId('showcase-author-links')).toBeTruthy());

    expect(view.getByText('shop.example')).toBeTruthy();
    expect(view.queryByText('Odd')).toBeNull();

    await fireEvent.press(view.getByTestId('showcase-author-link-Shop'));
    expect(openUrl).toHaveBeenCalledWith('https://shop.example/ana');
  });

  it('shows no links section, and no biography, when the author wrote none', async () => {
    mockGetAuthor.mockResolvedValue(page({ biography: null, links: [] }));
    const view = await render(<ShowcaseAuthorScreen />);

    await waitFor(() => expect(view.getByText('ana')).toBeTruthy());
    expect(view.queryByTestId('showcase-author-links')).toBeNull();
    expect(view.queryByText('Comics about small towns.')).toBeNull();
  });

  it('opens a story of the author in the same site', async () => {
    const view = await render(<ShowcaseAuthorScreen />);
    await waitFor(() => expect(view.getByText('The Valley')).toBeTruthy());

    await fireEvent.press(view.getByTestId('showcase-story-S1'));

    expect(mockNavigate).toHaveBeenCalledWith('ShowcaseStory', {
      serverId: 'srv-1',
      guestOrigin: undefined,
      storyId: 'S1',
    });
  });

  it("offers the author's page in the browser, in the header and at the foot", async () => {
    const view = await render(<ShowcaseAuthorScreen />);
    await waitFor(() => expect(view.getByText('ana')).toBeTruthy());

    mockHeader.mock.calls.at(-1)![0].actions[0].onPress();
    await fireEvent.press(view.getByTestId('showcase-author-browser'));

    expect(openUrl).toHaveBeenCalledTimes(2);
    expect(openUrl).toHaveBeenCalledWith('https://keres.example/showcase/author/ana');
  });

  it('offers nothing to open in the browser before it knows whose site this is', async () => {
    mockGetServerById.mockReturnValue(new Promise(() => {}));
    await render(<ShowcaseAuthorScreen />);

    const action = mockHeader.mock.calls.at(-1)![0].actions[0];
    expect(action.visible).toBe(false);
    action.onPress();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('reads a server it only has a link to as a guest, with the way to register it', async () => {
    mockRoute.params = { guestOrigin: 'https://other.example', username: 'ana' };
    const view = await render(<ShowcaseAuthorScreen />);

    await waitFor(() => expect(view.getByTestId('showcase-guest-banner')).toBeTruthy());
    expect(mockGetAuthor).toHaveBeenCalledWith(
      { kind: 'guest', origin: 'https://other.example' },
      'ana',
    );

    await fireEvent.press(view.getByTestId('showcase-guest-register'));
    expect(mockParentNavigate).toHaveBeenCalledWith('ServerManagementDrawer', {
      screen: 'ServerRegistration',
      params: { address: 'https://other.example' },
    });
  });

  it.each([
    [{ response: { status: 404 } }, 'showcase_author_not_found'],
    [{ code: 'NO_RESPONSE' }, 'showcase_author_unreachable'],
    [new Error('boom'), 'showcase_author_failed'],
  ])('says so when the page cannot be shown (%#)', async (error, message) => {
    mockGetAuthor.mockRejectedValue(error);
    const view = await render(<ShowcaseAuthorScreen />);

    await waitFor(() => expect(view.getByText(message)).toBeTruthy());
    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('says when the registered server is gone, and while it loads', async () => {
    mockGetServerById.mockResolvedValue(undefined);
    const gone = await render(<ShowcaseAuthorScreen />);
    await waitFor(() => expect(gone.getByText('server_not_found')).toBeTruthy());
    await gone.unmount();

    mockGetServerById.mockReturnValue(new Promise(() => {}));
    const loading = await render(<ShowcaseAuthorScreen />);
    expect(loading.getByText('loading')).toBeTruthy();
  });
});

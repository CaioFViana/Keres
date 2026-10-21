import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import ShowcasePackScreen from '@/src/screens/showcase/ShowcasePackScreen';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';

const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockHeader = jest.fn();
const mockNotify = jest.fn();
const mockGetServerById = jest.fn();
const mockGetPack = jest.fn();
const mockListPacks = jest.fn();
const mockImportRemotePack = jest.fn();
const mockRoute: { params: Record<string, unknown> } = { params: {} };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
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
jest.mock('@/src/state/ui/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) => {
    const state = { showNotification: (...args: unknown[]) => mockNotify(...args) };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));
jest.mock('@/src/services/servers/ServerService', () => ({
  createServerService: () => ({
    getServerById: (...args: unknown[]) => mockGetServerById(...args),
  }),
}));
jest.mock('@/src/services/storymanagement/packs/PackService', () => ({
  createPackService: () => ({
    listPacks: (...args: unknown[]) => mockListPacks(...args),
    importRemotePack: (...args: unknown[]) => mockImportRemotePack(...args),
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
  showcaseApiService: { getPack: (...args: unknown[]) => mockGetPack(...args) },
}));

const server = { id: 'srv-1', name: 'Main', url: 'https://keres.example' };

const summary = {
  fieldCount: 2,
  suggestionCount: 0,
  tagCount: 4,
  statCount: 0,
  hasVocabulary: false,
  statSystem: false,
  statNotation: 'numeric',
  chapterCount: 0,
  sceneCount: 0,
  characterCount: 0,
  locationCount: 0,
  worldRuleCount: 0,
  noteCount: 0,
  boardCount: 0,
  locationMapCount: 0,
};

function pack(overrides: Record<string, unknown> = {}) {
  return {
    id: 'K1',
    name: 'Tabletop Starter',
    description: 'For a first campaign.',
    language: 'en',
    authorName: 'Ana Souza',
    version: 3,
    owner: { username: 'ana', tag: 'ana', avatarColor: null, avatarIcon: null },
    summary,
    updatedAt: '2026-10-01T10:00:00Z',
    content: { formatVersion: 2 },
    ...overrides,
  };
}

describe('ShowcasePackScreen', () => {
  let openUrl: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1', packId: 'K1' };
    mockGetServerById.mockResolvedValue(server);
    mockGetPack.mockResolvedValue(pack());
    mockListPacks.mockResolvedValue([]);
    mockImportRemotePack.mockResolvedValue(undefined);
    openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(async () => {
    openUrl.mockRestore();
    await cleanup();
  });

  it('shows what the pack is and what it brings', async () => {
    const view = await render(<ShowcasePackScreen />);

    await waitFor(() => expect(view.getByText('Tabletop Starter')).toBeTruthy());
    expect(mockGetPack).toHaveBeenCalledWith({ kind: 'server', server }, 'K1');
    expect(view.getByText('en · Ana Souza · packs_version')).toBeTruthy();
    expect(view.getByText('For a first campaign.')).toBeTruthy();
    expect(view.getByText('packs_chip_attributes:2')).toBeTruthy();
    expect(view.getByText('packs_chip_tags:4')).toBeTruthy();
    expect(view.getByText('showcase_pack_howto')).toBeTruthy();
    expect(view.queryByTestId('showcase-guest-banner')).toBeNull();
  });

  it('credits the account when the pack names no author, and says when it brings nothing', async () => {
    mockGetPack.mockResolvedValue(
      pack({
        authorName: null,
        description: null,
        summary: { ...summary, fieldCount: 0, tagCount: 0 },
      }),
    );
    const view = await render(<ShowcasePackScreen />);

    await waitFor(() => expect(view.getByText(/ana/)).toBeTruthy());
    expect(view.getByText('packs_chip_empty')).toBeTruthy();
  });

  it('keeps a copy on this device as a private pack under the id it had', async () => {
    const view = await render(<ShowcasePackScreen />);
    await waitFor(() => expect(view.getByTestId('showcase-pack-install')).toBeTruthy());
    expect(view.getByText('packs_download')).toBeTruthy();

    await fireEvent.press(view.getByTestId('showcase-pack-install'));

    await waitFor(() => expect(mockImportRemotePack).toHaveBeenCalled());
    expect(mockImportRemotePack).toHaveBeenCalledWith({
      id: 'K1',
      name: 'Tabletop Starter',
      description: 'For a first campaign.',
      language: 'en',
      authorName: 'Ana Souza',
      version: 3,
      visibility: 'private',
      content: { formatVersion: 2 },
    });
    expect(mockNotify).toHaveBeenCalledWith('packs_download_done', 'success');
    // Now it is there: the button offers to update it instead.
    await waitFor(() => expect(view.getByText('packs_download_again')).toBeTruthy());
  });

  it('says it is already on the device, when it is', async () => {
    mockListPacks.mockResolvedValue([{ id: 'other' }, { id: 'K1' }]);
    const view = await render(<ShowcasePackScreen />);

    await waitFor(() => expect(view.getByText('packs_download_again')).toBeTruthy());
  });

  it('survives not being able to list the local packs', async () => {
    mockListPacks.mockRejectedValue(new Error('db'));
    const view = await render(<ShowcasePackScreen />);

    await waitFor(() => expect(view.getByText('packs_download')).toBeTruthy());
  });

  it('says when the pack could not be installed', async () => {
    await withSilencedConsole(['error'], async () => {
      mockImportRemotePack.mockRejectedValue(new Error('disk'));
      const view = await render(<ShowcasePackScreen />);
      await waitFor(() => expect(view.getByTestId('showcase-pack-install')).toBeTruthy());

      await fireEvent.press(view.getByTestId('showcase-pack-install'));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('packs_download_failed', 'error'),
      );
      expect(view.getByText('packs_download')).toBeTruthy();
    });
  });

  it('reads a server it only has a link to as a guest, and installs from it all the same', async () => {
    mockRoute.params = { guestOrigin: 'https://other.example', packId: 'K1' };
    const view = await render(<ShowcasePackScreen />);

    await waitFor(() => expect(view.getByTestId('showcase-guest-banner')).toBeTruthy());
    expect(mockGetPack).toHaveBeenCalledWith(
      { kind: 'guest', origin: 'https://other.example' },
      'K1',
    );
    await fireEvent.press(view.getByTestId('showcase-guest-register'));
    expect(mockParentNavigate).toHaveBeenCalledWith('ServerManagementDrawer', {
      screen: 'ServerRegistration',
      params: { address: 'https://other.example' },
    });

    await fireEvent.press(view.getByTestId('showcase-pack-install'));
    await waitFor(() => expect(mockImportRemotePack).toHaveBeenCalled());
  });

  it("offers the pack's page in the browser from the header", async () => {
    const view = await render(<ShowcasePackScreen />);
    await waitFor(() => expect(view.getByText('Tabletop Starter')).toBeTruthy());

    mockHeader.mock.calls.at(-1)![0].actions[0].onPress();

    expect(openUrl).toHaveBeenCalledWith('https://keres.example/showcase/pack/K1');
  });

  it('offers nothing to open in the browser before it knows whose site this is', async () => {
    mockGetServerById.mockReturnValue(new Promise(() => {}));
    await render(<ShowcasePackScreen />);

    const action = mockHeader.mock.calls.at(-1)![0].actions[0];
    expect(action.visible).toBe(false);
    action.onPress();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it.each([
    [{ response: { status: 404 } }, 'showcase_pack_not_found'],
    [{ code: 'NO_RESPONSE' }, 'showcase_pack_unreachable'],
    [new Error('invalid pack'), 'showcase_pack_failed'],
  ])('says so when the pack cannot be shown (%#)', async (error, message) => {
    mockGetPack.mockRejectedValue(error);
    const view = await render(<ShowcasePackScreen />);

    await waitFor(() => expect(view.getByText(message)).toBeTruthy());
    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('says when the registered server is gone, and while it loads', async () => {
    mockGetServerById.mockResolvedValue(undefined);
    const gone = await render(<ShowcasePackScreen />);
    await waitFor(() => expect(gone.getByText('server_not_found')).toBeTruthy());
    await gone.unmount();

    mockGetServerById.mockReturnValue(new Promise(() => {}));
    const loading = await render(<ShowcasePackScreen />);
    expect(loading.getByText('loading')).toBeTruthy();
  });

  it('does not install while the pack is not there to install', async () => {
    mockGetPack.mockReturnValue(new Promise(() => {}));
    const view = await render(<ShowcasePackScreen />);

    expect(view.queryByTestId('showcase-pack-install')).toBeNull();
    expect(mockImportRemotePack).not.toHaveBeenCalled();
  });
});

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import ShowcaseBrowseScreen from '@/src/screens/showcase/ShowcaseBrowseScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockHeader = jest.fn();
const mockGetServerById = jest.fn();
const mockListStories = jest.fn();
const mockListAuthors = jest.fn();
const mockGetFacets = jest.fn();
const mockListPacks = jest.fn();
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
// The filters are a modal selector of their own; here only what is handed to it matters.
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    SingleSelectPill: (props: {
      placeholder?: string;
      options: { label: string; value: string }[];
      onValueChange: (value: string | null) => void;
      value: string | null;
    }) => (
      <Text
        testID={`pill-${props.placeholder}`}
        onPress={() => props.onValueChange(props.options[0]?.value ?? null)}
        onLongPress={() => props.onValueChange(null)}
        accessibilityHint={props.options.map((option) => option.label).join('|')}
      >
        {props.placeholder}:{props.value ?? '-'}
      </Text>
    ),
  };
});
jest.mock('@/src/components/layout/ResponsiveModal/ResponsiveModal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
const mockDb = {};
jest.mock('@/src/db', () => ({ useDrizzle: () => mockDb }));
jest.mock('@/src/services/servers/ServerService', () => ({
  createServerService: () => ({
    getServerById: (...args: unknown[]) => mockGetServerById(...args),
  }),
}));
jest.mock('@/src/services/api/apiClient', () => ({
  isNotFoundError: () => false,
  isOfflineError: () => false,
}));
jest.mock('@/src/services/api/ShowcaseApiService', () => ({
  showcaseSourceUrl: (source: { kind: string; origin?: string; server?: { url: string } }) =>
    source.kind === 'server' ? source.server!.url : source.origin,
  showcaseCoverUrl: (_source: unknown, storyId: string) => `cover://${storyId}`,
  showcaseApiService: {
    listStories: (...args: unknown[]) => mockListStories(...args),
    listAuthors: (...args: unknown[]) => mockListAuthors(...args),
    getFacets: (...args: unknown[]) => mockGetFacets(...args),
    listPacks: (...args: unknown[]) => mockListPacks(...args),
  },
}));

const server = { id: 'srv-1', name: 'Main', url: 'https://keres.example' };

const card = (id: string, overrides: Record<string, unknown> = {}) => ({
  storyId: id,
  isNsfw: false,
  hasCover: id === 'S1',
  snapshot: { title: `Story ${id}`, genre: 'Fantasy', type: 'linear' },
  owner: { username: 'ana', tag: 'ana', avatarColor: null, avatarIcon: null },
  versionCount: 2,
  ...overrides,
});
const packCard = (id: string, name: string) => ({
  id,
  name,
  description: `About ${name}`,
  language: 'en',
  authorName: 'Ana',
  version: 1,
  owner: { username: 'ana', tag: 'ana', avatarColor: null, avatarIcon: null },
  summary: {
    fieldCount: 1,
    suggestionCount: 0,
    tagCount: 0,
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
  },
  updatedAt: '2026-10-01T10:00:00Z',
});
const authorCard = (name: string) => ({
  owner: { username: name, tag: name, avatarColor: null, avatarIcon: null },
  storyCount: 3,
  updatedAt: '2026-10-01T10:00:00Z',
});

describe('ShowcaseBrowseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1' };
    mockGetServerById.mockResolvedValue(server);
    mockListStories.mockResolvedValue({ items: [card('S1'), card('S2')], total: 2 });
    mockListAuthors.mockResolvedValue({ items: [authorCard('ana'), authorCard('mei')], total: 2 });
    mockListPacks.mockResolvedValue([
      packCard('K1', 'Tabletop Starter'),
      packCard('K2', 'Comic Kit'),
    ]);
    mockGetFacets.mockResolvedValue({
      genres: [{ value: 'Fantasy', count: 2 }],
      languages: [{ value: 'en', count: 2 }],
      mediums: [{ value: 'comic', count: 1 }],
      types: [],
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("lists the server's stories newest first, titled with the server's name", async () => {
    const view = await render(<ShowcaseBrowseScreen />);

    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
    expect(view.getByText('Story S2')).toBeTruthy();
    expect(mockHeader).toHaveBeenCalledWith(expect.objectContaining({ title: 'Main' }));
    expect(mockListStories).toHaveBeenCalledWith(
      { kind: 'server', server },
      expect.objectContaining({ sort: 'recent', limit: 24, offset: 0 }),
    );
    expect(view.getByTestId('showcase-count')).toBeTruthy();
    // Only the story that has a cover asks for it.
    expect(view.getByTestId('showcase-cover-S1')).toBeTruthy();
    expect(view.queryByTestId('showcase-cover-S2')).toBeNull();
    expect(view.queryByTestId('showcase-guest-banner')).toBeNull();
  });

  it('opens a story, and an author, in the same site', async () => {
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());

    await fireEvent.press(view.getByTestId('showcase-story-S2'));
    expect(mockNavigate).toHaveBeenCalledWith('ShowcaseStory', {
      serverId: 'srv-1',
      guestOrigin: undefined,
      storyId: 'S2',
    });

    await fireEvent.press(view.getByTestId('showcase-tab-authors'));
    await waitFor(() => expect(view.getByTestId('showcase-author-mei')).toBeTruthy());
    await fireEvent.press(view.getByTestId('showcase-author-mei'));
    expect(mockNavigate).toHaveBeenCalledWith('ShowcaseAuthor', {
      serverId: 'srv-1',
      guestOrigin: undefined,
      username: 'mei',
    });
    expect(mockListAuthors).toHaveBeenCalledWith(
      { kind: 'server', server },
      { q: '', limit: 24, offset: 0 },
    );
  });

  describe('the packs', () => {
    it('lists them whole, and opens one in the same site', async () => {
      const view = await render(<ShowcaseBrowseScreen />);
      await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
      // Nobody asks for the packs until their tab is open.
      expect(mockListPacks).not.toHaveBeenCalled();

      await fireEvent.press(view.getByTestId('showcase-tab-packs'));
      await waitFor(() => expect(view.getByText('Tabletop Starter')).toBeTruthy());
      expect(view.getByText('Comic Kit')).toBeTruthy();
      expect(mockListPacks).toHaveBeenCalledWith({ kind: 'server', server });
      expect(view.queryByTestId('list-filters-button')).toBeNull();
      expect(view.queryByTestId('showcase-more')).toBeNull();

      await fireEvent.press(view.getByTestId('showcase-pack-K2'));
      expect(mockNavigate).toHaveBeenCalledWith('ShowcasePack', {
        serverId: 'srv-1',
        guestOrigin: undefined,
        packId: 'K2',
      });
    });

    it('opens on the packs when asked, and narrows them as the person types', async () => {
      mockRoute.params = { serverId: 'srv-1', tab: 'packs' };
      const view = await render(<ShowcaseBrowseScreen />);
      await waitFor(() => expect(view.getByText('Comic Kit')).toBeTruthy());
      expect(mockListStories).not.toHaveBeenCalled();

      await fireEvent.changeText(view.getByTestId('showcase-search'), 'comic');

      await waitFor(() => expect(view.queryByText('Tabletop Starter')).toBeNull());
      expect(view.getByText('Comic Kit')).toBeTruthy();
      expect(mockListPacks).toHaveBeenCalledTimes(1);

      await fireEvent.changeText(view.getByTestId('showcase-search'), 'zzz');
      await waitFor(() => expect(view.getByText('showcase_empty_filtered')).toBeTruthy());
    });

    it('says there is none, and when they could not be loaded', async () => {
      mockRoute.params = { serverId: 'srv-1', tab: 'packs' };
      mockListPacks.mockResolvedValueOnce([]);
      const view = await render(<ShowcaseBrowseScreen />);
      await waitFor(() => expect(view.getByText('showcase_empty_packs')).toBeTruthy());
      await view.unmount();

      mockListPacks.mockRejectedValueOnce(new Error('down'));
      const failing = await render(<ShowcaseBrowseScreen />);
      await waitFor(() => expect(failing.getByText('showcase_list_failed')).toBeTruthy());

      await fireEvent.press(failing.getByTestId('showcase-retry'));
      await waitFor(() => expect(failing.getByText('Comic Kit')).toBeTruthy());
    });
  });

  it('opens on the tab it was asked for', async () => {
    mockRoute.params = { serverId: 'srv-1', tab: 'authors' };
    const view = await render(<ShowcaseBrowseScreen />);

    await waitFor(() => expect(view.getByTestId('showcase-author-ana')).toBeTruthy());
    expect(mockListStories).not.toHaveBeenCalled();
  });

  it('searches as the person types, after a pause', async () => {
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());

    await fireEvent.changeText(view.getByTestId('showcase-search'), 'casa');

    await waitFor(() =>
      expect(mockListStories).toHaveBeenLastCalledWith(
        { kind: 'server', server },
        expect.objectContaining({ q: 'casa', offset: 0 }),
      ),
    );
  });

  it('narrows by what the server offers, and clears the filters', async () => {
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
    await waitFor(() => expect(mockGetFacets).toHaveBeenCalled());

    // The filters wait behind the Filters button, as the app's lists keep theirs.
    expect(view.queryByTestId('pill-showcase_filter_genre')).toBeNull();
    expect(view.queryByTestId('list-filters-count')).toBeNull();
    await fireEvent.press(view.getByTestId('list-filters-button'));
    await fireEvent.press(view.getByTestId('pill-showcase_filter_genre'));
    await waitFor(() =>
      expect(mockListStories).toHaveBeenLastCalledWith(
        { kind: 'server', server },
        expect.objectContaining({ genre: 'Fantasy' }),
      ),
    );
    expect(view.getByTestId('list-filters-count')).toHaveTextContent('1');

    await fireEvent.press(view.getByTestId('showcase-filters-clear'));
    await waitFor(() =>
      expect(mockListStories).toHaveBeenLastCalledWith(
        { kind: 'server', server },
        expect.objectContaining({ genre: undefined }),
      ),
    );
    expect(view.queryByTestId('showcase-filters-clear')).toBeNull();
    expect(view.queryByTestId('list-filters-count')).toBeNull();

    // Done closes the dialog on the result.
    await fireEvent.press(view.getByTestId('showcase-filters-done'));
    expect(view.queryByTestId('pill-showcase_filter_genre')).toBeNull();
  });

  it('keeps the order when the filters are cleared, and shows the order without opening them', async () => {
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());

    expect(view.getByTestId('pill-showcase_filter_sort')).toBeTruthy();
  });

  it('shows how many each facet has, and keeps a chosen value the server no longer offers', async () => {
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
    await fireEvent.press(view.getByTestId('list-filters-button'));
    await waitFor(() =>
      expect(view.getByTestId('pill-showcase_filter_genre').props.accessibilityHint).toBe(
        'Fantasy (2)',
      ),
    );
    expect(view.getByTestId('pill-showcase_filter_medium').props.accessibilityHint).toBe(
      'arc_medium_comic (1)',
    );
  });

  it('still lists when the facets could not be read', async () => {
    mockGetFacets.mockRejectedValue(new Error('down'));
    const view = await render(<ShowcaseBrowseScreen />);

    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
  });

  it('grows the page on request', async () => {
    mockListStories.mockResolvedValueOnce({
      items: Array.from({ length: 24 }, (_, at) => card(`P${at}`)),
      total: 25,
    });
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByTestId('showcase-more')).toBeTruthy());

    mockListStories.mockResolvedValueOnce({ items: [card('LAST')], total: 25 });
    await fireEvent.press(view.getByTestId('showcase-more'));

    // The list renders a window of its rows: what shows is that "more" went away and the next page was asked.
    await waitFor(() => expect(view.queryByTestId('showcase-more')).toBeNull());
    expect(mockListStories).toHaveBeenLastCalledWith(
      { kind: 'server', server },
      expect.objectContaining({ offset: 24 }),
    );
    expect(view.queryByTestId('showcase-more')).toBeNull();
  });

  it('says there is nothing, or nothing that matches', async () => {
    mockListStories.mockResolvedValue({ items: [], total: 0 });
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByText('showcase_empty_stories')).toBeTruthy());

    await fireEvent.changeText(view.getByTestId('showcase-search'), 'zzz');
    await waitFor(() => expect(view.getByText('showcase_empty_filtered')).toBeTruthy());

    mockListAuthors.mockResolvedValue({ items: [], total: 0 });
    await fireEvent.press(view.getByTestId('showcase-tab-authors'));
    await waitFor(() => expect(view.getByText('showcase_empty_filtered')).toBeTruthy());
  });

  it('says there is no author on show when it is so', async () => {
    mockRoute.params = { serverId: 'srv-1', tab: 'authors' };
    mockListAuthors.mockResolvedValue({ items: [], total: 0 });
    const view = await render(<ShowcaseBrowseScreen />);

    await waitFor(() => expect(view.getByText('showcase_empty_authors')).toBeTruthy());
  });

  it('says when a list could not be loaded, and reads it again', async () => {
    mockListStories.mockRejectedValueOnce(new Error('down'));
    const view = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(view.getByText('showcase_list_failed')).toBeTruthy());

    await fireEvent.press(view.getByTestId('showcase-retry'));

    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
  });

  it('reads a server it only has a link to as a guest, with the way to register it', async () => {
    mockRoute.params = { guestOrigin: 'https://other.example' };
    const view = await render(<ShowcaseBrowseScreen />);

    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
    expect(mockGetServerById).not.toHaveBeenCalled();
    expect(mockListStories).toHaveBeenCalledWith(
      { kind: 'guest', origin: 'https://other.example' },
      expect.any(Object),
    );
    expect(mockHeader).toHaveBeenCalledWith(expect.objectContaining({ title: 'other.example' }));

    await fireEvent.press(view.getByTestId('showcase-guest-register'));
    expect(mockParentNavigate).toHaveBeenCalledWith('ServerManagementDrawer', {
      screen: 'ServerRegistration',
      params: { address: 'https://other.example' },
    });
  });

  it('says when the registered server it was opened for is gone, and while it is loading', async () => {
    mockGetServerById.mockResolvedValue(undefined);
    const gone = await render(<ShowcaseBrowseScreen />);
    await waitFor(() => expect(gone.getByText('server_not_found')).toBeTruthy());
    await fireEvent.press(gone.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
    await gone.unmount();

    mockGetServerById.mockReturnValue(new Promise(() => {}));
    const loading = await render(<ShowcaseBrowseScreen />);
    expect(loading.getByText('loading')).toBeTruthy();
  });

  it('shows the server that has no name by its address', async () => {
    mockGetServerById.mockResolvedValue({ ...server, name: null });
    await render(<ShowcaseBrowseScreen />);

    await waitFor(() =>
      expect(mockHeader).toHaveBeenCalledWith(expect.objectContaining({ title: server.url })),
    );
  });

  it('keeps the answer to an old search out of the list', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mockListStories.mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)));
    const view = await render(<ShowcaseBrowseScreen />);

    await fireEvent.changeText(view.getByTestId('showcase-search'), 'new');
    await waitFor(() => expect(view.getByText('Story S1')).toBeTruthy());
    await act(async () => resolveFirst({ items: [card('STALE')], total: 1 }));

    expect(view.queryByText('Story STALE')).toBeNull();
  });
});

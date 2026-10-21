import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Linking, Platform } from 'react-native';
import ShowcaseHomeScreen from '@/src/screens/showcase/ShowcaseHomeScreen';

const mockNavigate = jest.fn();
const mockGetAllServers = jest.fn();
const mockGetConfig = jest.fn();
const mockHeader = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
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
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = callback();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, [callback]);
    },
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
    getAllServers: (...args: unknown[]) => mockGetAllServers(...args),
  }),
}));
jest.mock('@/src/services/api/ShowcaseApiService', () => ({
  showcaseApiService: { getConfig: (...args: unknown[]) => mockGetConfig(...args) },
}));

const registered = { id: 'srv-1', name: 'Main', url: 'https://keres.example' };

async function typeLink(view: Awaited<ReturnType<typeof render>>, text: string) {
  await fireEvent.changeText(view.getByTestId('showcase-link-input'), text);
}

describe('ShowcaseHomeScreen', () => {
  let openUrl: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllServers.mockResolvedValue([registered]);
    mockGetConfig.mockResolvedValue({ showcaseEnabled: true });
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('');
    openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(async () => {
    openUrl.mockRestore();
    await cleanup();
  });

  it('asks for a link and says what it is for', async () => {
    const view = await render(<ShowcaseHomeScreen />);

    expect(mockHeader).toHaveBeenCalledWith(expect.objectContaining({ title: 'showcase_title' }));
    expect(view.getByText('showcase_description')).toBeTruthy();
    expect(view.getByText('showcase_link_note')).toBeTruthy();
    expect(view.queryByTestId('showcase-link-status')).toBeNull();
  });

  it('says what is wrong with a text that is not a link, and does not open it', async () => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, 'hello');
    expect(view.getByText('showcase_link_problem_not_a_url')).toBeTruthy();
    await fireEvent.press(view.getByTestId('showcase-link-open'));
    expect(mockNavigate).not.toHaveBeenCalled();

    await typeLink(view, 'ftp://keres.example/showcase');
    expect(view.getByText('showcase_link_problem_unsupported_scheme')).toBeTruthy();
    await typeLink(view, 'http://keres.example/showcase');
    expect(view.getByText('showcase_link_problem_insecure_http')).toBeTruthy();
    // Plain http to the internet is not something to hand to the browser either.
    expect(view.queryByTestId('showcase-link-browser')).toBeNull();
  });

  it('offers the browser for an address that is fine but is not a showcase page', async () => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, 'https://keres.example/pricing');
    expect(view.getByText('showcase_link_problem_not_showcase')).toBeTruthy();
    await fireEvent.press(view.getByTestId('showcase-link-browser'));

    expect(openUrl).toHaveBeenCalledWith('https://keres.example/pricing');
  });

  it("opens a story of a registered server as the person's own", async () => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, 'https://keres.example/showcase/story/S1');
    await waitFor(() => expect(view.getByText('showcase_link_registered')).toBeTruthy());
    await fireEvent.press(view.getByTestId('showcase-link-open'));

    expect(mockNavigate).toHaveBeenCalledWith('ShowcaseStory', {
      serverId: 'srv-1',
      storyId: 'S1',
    });
    // A server they registered needs no asking: it is theirs.
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it('opens a link to a version of the reader at the story', async () => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, 'https://keres.example/showcase/story/S1/read/P1');
    await waitFor(() => expect(view.getByText('showcase_link_registered')).toBeTruthy());
    await fireEvent.press(view.getByTestId('showcase-link-open'));

    expect(mockNavigate).toHaveBeenCalledWith('ShowcaseStory', {
      serverId: 'srv-1',
      storyId: 'S1',
    });
  });

  it('opens a story of any other server as a guest, after asking whether it has a public site', async () => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, 'https://other.example/showcase/story/S9');
    expect(view.getByText('showcase_link_guest')).toBeTruthy();
    await fireEvent.press(view.getByTestId('showcase-link-open'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('ShowcaseStory', {
        guestOrigin: 'https://other.example',
        storyId: 'S9',
      }),
    );
    expect(mockGetConfig).toHaveBeenCalledWith({ kind: 'guest', origin: 'https://other.example' });
  });

  it('says when the other server cannot be reached, or has no public site', async () => {
    const view = await render(<ShowcaseHomeScreen />);
    await typeLink(view, 'https://other.example/showcase/story/S9');

    mockGetConfig.mockResolvedValueOnce(null);
    await fireEvent.press(view.getByTestId('showcase-link-open'));
    await waitFor(() => expect(view.getByText('showcase_link_unreachable')).toBeTruthy());

    mockGetConfig.mockResolvedValueOnce({ showcaseEnabled: false });
    await fireEvent.press(view.getByTestId('showcase-link-open'));
    await waitFor(() => expect(view.getByText('showcase_link_site_off')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();

    // Typing again clears the refusal: the text it was about is gone.
    await typeLink(view, 'https://other.example/showcase/story/S8');
    expect(view.queryByText('showcase_link_site_off')).toBeNull();
  });

  it.each([
    [
      'https://keres.example/showcase/author/ana',
      'ShowcaseAuthor',
      { serverId: 'srv-1', username: 'ana' },
    ],
    [
      'https://keres.example/showcase/authors',
      'ShowcaseBrowse',
      { serverId: 'srv-1', tab: 'authors' },
    ],
    ['https://keres.example/showcase', 'ShowcaseBrowse', { serverId: 'srv-1', tab: 'stories' }],
    ['https://keres.example', 'ShowcaseBrowse', { serverId: 'srv-1', tab: 'stories' }],
    [
      'https://other.example/showcase/author/mei',
      'ShowcaseAuthor',
      { guestOrigin: 'https://other.example', username: 'mei' },
    ],
  ])('opens %s inside the app', async (link, screen, params) => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, link);
    await fireEvent.press(view.getByTestId('showcase-link-open'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(screen, params));
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('sends the pages the app does not draw yet (packs) to the browser', async () => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, 'https://keres.example/showcase/pack/K1');
    await waitFor(() => expect(view.getByText('showcase_link_registered')).toBeTruthy());
    await fireEvent.press(view.getByTestId('showcase-link-open'));

    await waitFor(() =>
      expect(openUrl).toHaveBeenCalledWith('https://keres.example/showcase/pack/K1'),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("lists the person's servers, and browses the one that is tapped", async () => {
    mockGetAllServers.mockResolvedValue([
      registered,
      { id: 'srv-2', name: null, url: 'http://localhost:3187' },
    ]);
    const view = await render(<ShowcaseHomeScreen />);

    await waitFor(() => expect(view.getByText('Main')).toBeTruthy());
    // A server with no name is told by its address.
    expect(view.getAllByText('http://localhost:3187').length).toBeGreaterThan(0);
    expect(view.queryByTestId('showcase-servers-empty')).toBeNull();

    await fireEvent.press(view.getByTestId('showcase-server-srv-1'));
    expect(mockNavigate).toHaveBeenCalledWith('ShowcaseBrowse', { serverId: 'srv-1' });
  });

  it('says there is no server to browse yet', async () => {
    mockGetAllServers.mockResolvedValue([]);
    const view = await render(<ShowcaseHomeScreen />);

    await waitFor(() => expect(view.getByTestId('showcase-servers-empty')).toBeTruthy());
  });

  it('opens what is pasted from the clipboard at once', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
      'look: https://keres.example/showcase/story/S2',
    );
    const view = await render(<ShowcaseHomeScreen />);

    await fireEvent.press(view.getByTestId('showcase-link-paste'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('ShowcaseStory', {
        serverId: 'srv-1',
        storyId: 'S2',
      }),
    );
    expect(view.getByTestId('showcase-link-input').props.value).toContain('S2');
  });

  it('says why when what is pasted is no link, and survives an unreadable clipboard', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce('just words');
    const view = await render(<ShowcaseHomeScreen />);

    await fireEvent.press(view.getByTestId('showcase-link-paste'));
    await waitFor(() => expect(view.getByText('showcase_link_problem_not_a_url')).toBeTruthy());
    expect(mockNavigate).not.toHaveBeenCalled();

    (Clipboard.getStringAsync as jest.Mock).mockRejectedValueOnce(new Error('denied'));
    await fireEvent.press(view.getByTestId('showcase-link-paste'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('opens on the submit key of the field', async () => {
    const view = await render(<ShowcaseHomeScreen />);

    await typeLink(view, 'https://keres.example/showcase/story/S1');
    await waitFor(() => expect(view.getByText('showcase_link_registered')).toBeTruthy());
    await fireEvent(view.getByTestId('showcase-link-input'), 'submitEditing');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  describe('on the web, where a link can be pasted anywhere on the page', () => {
    const originalOs = Platform.OS;
    const originalDocument = (globalThis as { document?: unknown }).document;
    const listeners = new Map<string, (event: unknown) => void>();

    beforeEach(() => {
      listeners.clear();
      Platform.OS = 'web';
      (globalThis as { document?: unknown }).document = {
        addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
        removeEventListener: (name: string) => listeners.delete(name),
      };
    });

    afterEach(async () => {
      // Unmounted while the page still has its document: the screen takes its listener off it.
      await cleanup();
      Platform.OS = originalOs;
      (globalThis as { document?: unknown }).document = originalDocument;
    });

    it('takes Ctrl+V outside the field, and leaves the field to take its own', async () => {
      await render(<ShowcaseHomeScreen />);
      const paste = listeners.get('paste')!;
      expect(paste).toBeDefined();

      // Typing into a field pastes as typed: nothing opens by itself.
      paste({
        target: { tagName: 'INPUT' },
        clipboardData: { getData: () => 'https://keres.example/showcase/story/S1' },
      });
      expect(mockNavigate).not.toHaveBeenCalled();

      // Nothing on the clipboard that is text: nothing happens.
      paste({ target: { tagName: 'DIV' }, clipboardData: { getData: () => '' } });
      paste({ target: null, clipboardData: undefined });
      expect(mockNavigate).not.toHaveBeenCalled();

      await act(async () => {
        paste({
          target: { tagName: 'DIV' },
          clipboardData: { getData: () => 'https://keres.example/showcase/story/S1' },
        });
      });
      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith('ShowcaseStory', {
          serverId: 'srv-1',
          storyId: 'S1',
        }),
      );
    });

    it('stops listening when the screen goes', async () => {
      const view = await render(<ShowcaseHomeScreen />);
      expect(listeners.has('paste')).toBe(true);
      await view.unmount();
      expect(listeners.has('paste')).toBe(false);
    });
  });
});

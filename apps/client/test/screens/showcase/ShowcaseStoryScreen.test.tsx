import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';
import ShowcaseStoryScreen from '@/src/screens/showcase/ShowcaseStoryScreen';

const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockHeader = jest.fn();
const mockAlert = jest.fn();
const mockNotify = jest.fn();
const mockFetchStories = jest.fn();
const mockGetServerById = jest.fn();
const mockGetStory = jest.fn();
const mockUnlockStory = jest.fn();
const mockGetReaderUrl = jest.fn();
const mockDownloadPackage = jest.fn();
const mockDownloadManuscript = jest.fn();
const mockDeliverManuscript = jest.fn();
const mockImportZip = jest.fn();
const mockDeliver = jest.fn();
const mockRoute: { params: Record<string, unknown> } = { params: {} };
const mockUser: { userId: string | null } = { userId: 'user-1' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
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
jest.mock('@/src/state/ui/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('@/src/state/ui/notificationStore', () => ({
  useNotificationStore: () => ({ showNotification: (...args: unknown[]) => mockNotify(...args) }),
}));
jest.mock('@/src/state/story/storyListStore', () => ({
  useStoryListStore: () => ({ fetchStories: (...args: unknown[]) => mockFetchStories(...args) }),
}));
jest.mock('@/src/state/app/userSettingsStore', () => ({
  useUserSettingsStore: () => mockUser,
}));
jest.mock('@/src/services/servers/ServerService', () => ({
  createServerService: () => ({
    getServerById: (...args: unknown[]) => mockGetServerById(...args),
  }),
}));
jest.mock('@/src/services/storymanagement/story-lifecycle/StoryService', () => ({
  createStoryService: () => ({}),
}));
jest.mock('@/src/services/storymanagement/story-lifecycle/StoryImportService', () => ({
  importStoryZipBytes: (...args: unknown[]) => mockImportZip(...args),
}));
jest.mock('@/src/components/features/manuscript/export/manuscriptExport', () => ({
  deliverManuscriptBytes: (...args: unknown[]) => mockDeliverManuscript(...args),
}));
jest.mock('@/src/utils/io/storyTransfer', () => ({
  exportFileLanguage: (language: string) => (language === 'pt' ? 'pt' : 'en'),
  buildExportZipFileName: (title: string) => `${title}.zip`,
  deliverStoryZipExport: (...args: unknown[]) => mockDeliver(...args),
}));
jest.mock('@/src/services/api/apiClient', () => ({
  isNotFoundError: (error: { response?: { status?: number } } | null) =>
    error?.response?.status === 404,
  isOfflineError: (error: { code?: string } | null) => error?.code === 'NO_RESPONSE',
}));
jest.mock('@/src/services/api/ShowcaseApiService', () => {
  class ShowcaseUnlockError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    ShowcaseUnlockError,
    showcaseSourceUrl: (source: { kind: string; origin?: string; server?: { url: string } }) =>
      source.kind === 'server' ? source.server!.url : source.origin,
    showcaseApiService: {
      getStory: (...args: unknown[]) => mockGetStory(...args),
      unlockStory: (...args: unknown[]) => mockUnlockStory(...args),
      getReaderUrl: (...args: unknown[]) => mockGetReaderUrl(...args),
      downloadPackage: (...args: unknown[]) => mockDownloadPackage(...args),
      downloadManuscript: (...args: unknown[]) => mockDownloadManuscript(...args),
    },
  };
});

const server = { id: 'srv-1', name: 'Main', url: 'https://keres.example' };

function version(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    label: `label-${id}`,
    byteSize: 2048,
    mediaIncluded: 1,
    mediaTotal: 2,
    createdAt: '2026-10-01T10:00:00Z',
    packageIncluded: true,
    manuscript: null,
    reader: { byteSize: 10 },
    arc: null,
    ...overrides,
  };
}

function story(overrides: Record<string, unknown> = {}) {
  return {
    storyId: 'S1',
    snapshot: {
      title: 'Casa',
      description: 'A house.',
      genre: 'Fantasy',
      language: 'en',
      author: 'Ana Souza',
      type: 'linear',
      theme: null,
    },
    owner: { username: 'ana', tag: 'ana', avatarColor: null, avatarIcon: null },
    versions: [version('V2'), version('V1')],
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

async function openStory(view: Awaited<ReturnType<typeof render>>) {
  await waitFor(() => expect(view.getByText('Casa')).toBeTruthy());
}

describe('ShowcaseStoryScreen', () => {
  let openUrl: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1', storyId: 'S1' };
    mockUser.userId = 'user-1';
    mockGetServerById.mockResolvedValue(server);
    mockGetStory.mockResolvedValue(story());
    mockDownloadPackage.mockResolvedValue(new Uint8Array([80, 75]));
    mockImportZip.mockResolvedValue({ storyId: 'new', title: 'Casa' });
    mockDownloadManuscript.mockResolvedValue(new Uint8Array([37, 80]));
    mockDeliverManuscript.mockResolvedValue({ delivered: true, fileName: 'casa.pdf' });
    mockDeliver.mockResolvedValue({ delivered: true, fileName: 'Casa.zip' });
    openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(async () => {
    openUrl.mockRestore();
    await cleanup();
  });

  it('shows the story the way its page does, with its versions newest first', async () => {
    const view = await render(<ShowcaseStoryScreen />);
    await openStory(view);

    expect(mockGetStory).toHaveBeenCalledWith({ kind: 'server', server }, 'S1');
    expect(view.getByText(/showcase_published_by/)).toBeTruthy();
    expect(view.getByText('Fantasy · en · showcase_type_linear')).toBeTruthy();
    expect(view.getByText('A house.')).toBeTruthy();
    expect(view.getByText('label-V2')).toBeTruthy();
    expect(view.getByText('label-V1')).toBeTruthy();
    // The first of the list is the newest, and only that one says so.
    expect(view.getAllByText('showcase_version_newest')).toHaveLength(1);
    // Each of the two versions says how big its package is.
    expect(view.getAllByText(/2\.0 KB/)).toHaveLength(2);
    expect(view.queryByTestId('showcase-guest-banner')).toBeNull();
  });

  it('groups the versions of a work under its title, after those of the whole universe', async () => {
    const work = {
      id: 'W1',
      title: 'Volume One',
      description: null,
      author: null,
      medium: 'generic',
    };
    mockGetStory.mockResolvedValue(
      story({ versions: [version('A', { arc: work }), version('U')] }),
    );
    const view = await render(<ShowcaseStoryScreen />);
    await openStory(view);

    expect(view.getByText('Volume One')).toBeTruthy();
    expect(view.getByTestId('showcase-group-universe')).toBeTruthy();
    expect(view.getByTestId('showcase-group-W1')).toBeTruthy();
  });

  it('offers only what a version has: no reader, or no package', async () => {
    mockGetStory.mockResolvedValue(
      story({
        versions: [
          version('R', { packageIncluded: false }),
          version('P', { reader: null, mediaTotal: 0 }),
        ],
      }),
    );
    const view = await render(<ShowcaseStoryScreen />);
    await openStory(view);

    expect(view.getByTestId('showcase-read-R')).toBeTruthy();
    expect(view.queryByTestId('showcase-download-R')).toBeNull();
    expect(view.queryByTestId('showcase-import-R')).toBeNull();
    expect(view.queryByTestId('showcase-read-P')).toBeNull();
    expect(view.getByTestId('showcase-download-P')).toBeTruthy();
    expect(view.getByTestId('showcase-import-P')).toBeTruthy();
  });

  it("credits the story's author when it is not the account", async () => {
    mockGetStory.mockResolvedValue(
      story({ snapshot: { ...story().snapshot, author: null, genre: null, language: null } }),
    );
    const view = await render(<ShowcaseStoryScreen />);
    await openStory(view);

    expect(view.queryByText(/showcase_author_credit/)).toBeNull();
    expect(view.getByText('showcase_type_linear')).toBeTruthy();
  });

  describe('reading online', () => {
    it("opens the site's own reader page for a story anybody can open", async () => {
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-read-V1'));

      await waitFor(() =>
        expect(openUrl).toHaveBeenCalledWith('https://keres.example/showcase/story/S1/read/V1'),
      );
      expect(mockGetReaderUrl).not.toHaveBeenCalled();
    });

    it('opens the reader by an address of its own when the story is adults-only', async () => {
      mockGetStory.mockResolvedValue(story({ snapshot: { ...story().snapshot, isNsfw: true } }));
      mockGetReaderUrl.mockResolvedValue('https://keres.example/api/reader?access=a');
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-read-V1'));

      await waitFor(() =>
        expect(openUrl).toHaveBeenCalledWith('https://keres.example/api/reader?access=a'),
      );
      expect(mockGetReaderUrl).toHaveBeenCalledWith({ kind: 'server', server }, 'S1', 'V1', null);
    });

    it('says when the reader could not be opened', () =>
      withSilencedConsole(['error'], async () => {
        openUrl.mockRejectedValueOnce(new Error('no browser'));
        const view = await render(<ShowcaseStoryScreen />);
        await openStory(view);

        await fireEvent.press(view.getByTestId('showcase-read-V1'));

        await waitFor(() =>
          expect(mockNotify).toHaveBeenCalledWith('showcase_read_failed', 'error'),
        );
      }));
  });

  describe('taking the package as a file', () => {
    it('downloads it and hands it over, showing the progress meanwhile', async () => {
      let finish: (bytes: Uint8Array) => void = () => {};
      mockDownloadPackage.mockImplementation(
        (
          _s: unknown,
          _id: string,
          _v: string,
          _t: unknown,
          options: { onProgress: (f: number) => void },
        ) =>
          new Promise<Uint8Array>((resolve) => {
            options.onProgress(0.5);
            finish = resolve;
          }),
      );
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-download-V1'));

      await waitFor(() => expect(view.getByText('showcase_downloading 50%')).toBeTruthy());
      // While one version is being worked on, the others wait.
      expect(view.getByTestId('showcase-import-V2').props.accessibilityState?.disabled).toBe(true);

      await act(async () => finish(new Uint8Array([1, 2])));
      await waitFor(() =>
        expect(mockDeliver).toHaveBeenCalledWith(new Uint8Array([1, 2]), 'Casa label-V1.zip'),
      );
      expect(mockNotify).toHaveBeenCalledWith('showcase_download_done', 'success');
      await waitFor(() => expect(view.queryByText(/showcase_downloading/)).toBeNull());
    });

    it('says when the file was kept but cannot be shared from this device', async () => {
      mockDeliver.mockResolvedValue({ delivered: false, fileName: 'x.zip' });
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-download-V1'));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('showcase_download_no_share', 'info'),
      );
    });

    it('says when the download failed', () =>
      withSilencedConsole(['error'], async () => {
        mockDownloadPackage.mockRejectedValue(new Error('down'));
        const view = await render(<ShowcaseStoryScreen />);
        await openStory(view);

        await fireEvent.press(view.getByTestId('showcase-download-V1'));

        await waitFor(() =>
          expect(mockNotify).toHaveBeenCalledWith('showcase_download_failed', 'error'),
        );
        expect(mockDeliver).not.toHaveBeenCalled();
      }));
  });

  describe('taking the manuscript', () => {
    const withManuscript = () =>
      story({
        versions: [
          version('M', { manuscript: { format: 'pdf', byteSize: 1_500_000 } }),
          version('N'),
        ],
      });

    it('offers it only for a version that has one, saying its format and size', async () => {
      mockGetStory.mockResolvedValue(withManuscript());
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      expect(view.getByTestId('showcase-manuscript-M')).toBeTruthy();
      expect(view.queryByTestId('showcase-manuscript-N')).toBeNull();
      expect(view.getByText('showcase_download_manuscript')).toBeTruthy();
    });

    it('downloads it and hands it over under the story title, in its own format', async () => {
      mockGetStory.mockResolvedValue(withManuscript());
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-manuscript-M'));

      await waitFor(() =>
        expect(mockDeliverManuscript).toHaveBeenCalledWith({
          storyTitle: 'Casa',
          bytes: new Uint8Array([37, 80]),
          format: 'pdf',
          language: 'en',
        }),
      );
      expect(mockDownloadManuscript).toHaveBeenCalledWith(
        { kind: 'server', server },
        'S1',
        'M',
        null,
        expect.any(Object),
      );
      expect(mockNotify).toHaveBeenCalledWith('showcase_download_done', 'success');
    });

    it('says when the file was kept but cannot be shared from this device', async () => {
      mockGetStory.mockResolvedValue(withManuscript());
      mockDeliverManuscript.mockResolvedValue({ delivered: false, fileName: 'x.pdf' });
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-manuscript-M'));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('showcase_download_no_share', 'info'),
      );
    });

    it('says when the manuscript could not be downloaded', () =>
      withSilencedConsole(['error'], async () => {
        mockGetStory.mockResolvedValue(withManuscript());
        mockDownloadManuscript.mockRejectedValue(new Error('down'));
        const view = await render(<ShowcaseStoryScreen />);
        await openStory(view);

        await fireEvent.press(view.getByTestId('showcase-manuscript-M'));

        await waitFor(() =>
          expect(mockNotify).toHaveBeenCalledWith('showcase_manuscript_failed', 'error'),
        );
        expect(mockDeliverManuscript).not.toHaveBeenCalled();
      }));
  });

  describe('importing a copy', () => {
    const confirmImport = async (view: Awaited<ReturnType<typeof render>>) => {
      await fireEvent.press(view.getByTestId('showcase-import-V1'));
      const buttons = mockAlert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
      await act(async () =>
        buttons.find((button) => button.text === 'showcase_import')!.onPress!(),
      );
    };

    it('asks first, then downloads the package and makes a local story of it', async () => {
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-import-V1'));
      expect(mockAlert).toHaveBeenCalledWith(
        'showcase_import_confirm_title',
        'showcase_import_confirm_message',
        expect.any(Array),
      );
      expect(mockDownloadPackage).not.toHaveBeenCalled();

      const buttons = mockAlert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
      await act(async () =>
        buttons.find((button) => button.text === 'showcase_import')!.onPress!(),
      );

      await waitFor(() =>
        expect(mockImportZip).toHaveBeenCalledWith(
          {},
          'user-1',
          new Uint8Array([80, 75]),
          'Casa label-V1.zip',
        ),
      );
      expect(mockNotify).toHaveBeenCalledWith('import_story_success', 'success');
      expect(mockFetchStories).toHaveBeenCalled();
    });

    it('imports nothing when the person backs out', async () => {
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-import-V1'));
      const buttons = mockAlert.mock.calls.at(-1)![2] as { text: string; style?: string }[];
      expect(buttons.find((button) => button.style === 'cancel')).toBeTruthy();

      expect(mockImportZip).not.toHaveBeenCalled();
    });

    it("says why a package was refused, in the importer's own words", async () => {
      const { StoryImportError } = jest.requireActual('@/src/utils/io/StoryImportError');
      mockImportZip.mockRejectedValue(new StoryImportError('corrupt_content', 'bad'));
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await confirmImport(view);

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('import_story_corrupt_content', 'error'),
      );
    });

    it('says when it failed for any other reason', () =>
      withSilencedConsole(['error'], async () => {
        mockImportZip.mockRejectedValue(new Error('boom'));
        const view = await render(<ShowcaseStoryScreen />);
        await openStory(view);

        await confirmImport(view);

        await waitFor(() =>
          expect(mockNotify).toHaveBeenCalledWith('showcase_import_failed', 'error'),
        );
      }));

    it('needs an account of the app to own the copy', async () => {
      mockUser.userId = null;
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      await fireEvent.press(view.getByTestId('showcase-import-V1'));

      expect(mockNotify).toHaveBeenCalledWith('user_not_identified', 'error');
      expect(mockAlert).not.toHaveBeenCalled();
    });
  });

  describe('a server the person only has a link to', () => {
    beforeEach(() => {
      mockRoute.params = { guestOrigin: 'https://other.example', storyId: 'S1' };
    });

    it('is read as a guest, and says so, with the way to register it', async () => {
      const view = await render(<ShowcaseStoryScreen />);
      await openStory(view);

      expect(mockGetStory).toHaveBeenCalledWith(
        { kind: 'guest', origin: 'https://other.example' },
        'S1',
      );
      expect(mockGetServerById).not.toHaveBeenCalled();
      expect(view.getByTestId('showcase-guest-banner')).toBeTruthy();

      await fireEvent.press(view.getByTestId('showcase-guest-register'));
      expect(mockParentNavigate).toHaveBeenCalledWith('ServerManagementDrawer', {
        screen: 'ServerRegistration',
        params: { address: 'https://other.example' },
      });
    });
  });

  describe('a story behind a password', () => {
    beforeEach(() => {
      mockGetStory.mockResolvedValueOnce({ storyId: 'S1', protected: true });
    });

    it('shows only the gate, and says when the password is wrong', async () => {
      const { ShowcaseUnlockError } = jest.requireMock('@/src/services/api/ShowcaseApiService');
      const view = await render(<ShowcaseStoryScreen />);
      await waitFor(() => expect(view.getByTestId('showcase-password-gate')).toBeTruthy());
      expect(view.queryByText('Casa')).toBeNull();

      mockUnlockStory.mockRejectedValueOnce(new ShowcaseUnlockError('wrong'));
      await fireEvent.changeText(view.getByTestId('showcase-gate-input'), 'nope');
      await fireEvent.press(view.getByTestId('showcase-gate-submit'));

      await waitFor(() => expect(view.getByText('showcase_unlock_wrong')).toBeTruthy());
    });

    it('opens the story with the password, and sends its token with what it asks for next', async () => {
      mockUnlockStory.mockResolvedValue('tok');
      mockGetStory.mockResolvedValueOnce(story());
      mockGetReaderUrl.mockResolvedValue('https://keres.example/api/reader?access=a');
      const view = await render(<ShowcaseStoryScreen />);
      await waitFor(() => expect(view.getByTestId('showcase-password-gate')).toBeTruthy());

      await fireEvent.changeText(view.getByTestId('showcase-gate-input'), 'hunter2');
      await fireEvent.press(view.getByTestId('showcase-gate-submit'));
      await openStory(view);

      expect(mockUnlockStory).toHaveBeenCalledWith({ kind: 'server', server }, 'S1', 'hunter2');
      expect(view.queryByTestId('showcase-password-gate')).toBeNull();

      await fireEvent.press(view.getByTestId('showcase-read-V1'));
      await waitFor(() =>
        expect(mockGetReaderUrl).toHaveBeenCalledWith(
          { kind: 'server', server },
          'S1',
          'V1',
          'tok',
        ),
      );
      await fireEvent.press(view.getByTestId('showcase-download-V1'));
      await waitFor(() =>
        expect(mockDownloadPackage).toHaveBeenCalledWith(
          { kind: 'server', server },
          'S1',
          'V1',
          'tok',
          expect.any(Object),
        ),
      );
    });

    it('does not try an empty password', async () => {
      const view = await render(<ShowcaseStoryScreen />);
      await waitFor(() => expect(view.getByTestId('showcase-password-gate')).toBeTruthy());

      await fireEvent.press(view.getByTestId('showcase-gate-submit'));
      await fireEvent(view.getByTestId('showcase-gate-input'), 'submitEditing');

      expect(mockUnlockStory).not.toHaveBeenCalled();
    });
  });

  describe('when the story cannot be shown', () => {
    it.each([
      [{ response: { status: 404 } }, 'showcase_story_not_found'],
      [{ code: 'NO_RESPONSE' }, 'showcase_story_unreachable'],
      [new Error('boom'), 'showcase_story_failed'],
    ])('says so, and goes back (%#)', async (error, message) => {
      mockGetStory.mockReset();
      mockGetStory.mockRejectedValue(error);
      const view = await render(<ShowcaseStoryScreen />);

      await waitFor(() => expect(view.getByText(message)).toBeTruthy());
      await fireEvent.press(view.getByText('go_back'));
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('says when the registered server it was opened for is gone', async () => {
      mockGetServerById.mockResolvedValue(undefined);
      const view = await render(<ShowcaseStoryScreen />);

      await waitFor(() => expect(view.getByText('server_not_found')).toBeTruthy());
      expect(mockGetStory).not.toHaveBeenCalled();
    });

    it('shows the wait while it reads', async () => {
      mockGetStory.mockReturnValue(new Promise(() => {}));
      const view = await render(<ShowcaseStoryScreen />);

      await waitFor(() => expect(view.getByText('loading')).toBeTruthy());
    });
  });

  it("offers the story's page in the browser, in the header and at the foot", async () => {
    const view = await render(<ShowcaseStoryScreen />);
    await openStory(view);

    const header = mockHeader.mock.calls.at(-1)![0];
    expect(header.actions[0]).toMatchObject({ id: 'open-in-browser', visible: true });
    header.actions[0].onPress();
    await fireEvent.press(view.getByTestId('showcase-story-browser'));

    expect(openUrl).toHaveBeenCalledTimes(2);
    expect(openUrl).toHaveBeenCalledWith('https://keres.example/showcase/story/S1');
  });

  it('offers nothing to open in the browser before it knows whose site this is', async () => {
    mockGetServerById.mockReturnValue(new Promise(() => {}));
    await render(<ShowcaseStoryScreen />);

    const header = mockHeader.mock.calls.at(-1)![0];
    expect(header.actions[0].visible).toBe(false);
    header.actions[0].onPress();
    expect(openUrl).not.toHaveBeenCalled();
  });
});

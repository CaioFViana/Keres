import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SongSelect } from '../../../src/db/schema';
import SongListScreen, { songFactsLine } from '../../../src/screens/songs/SongListScreen';

const mockNavigate = jest.fn();
const mockCreateSong = jest.fn();
const mockShowNotification = jest.fn();
const mockPickTextFile = jest.fn();

let mockCanEdit = true;
let mockLoading = false;
let mockSongs: SongSelect[] = [];
let mockHeader: { actions?: { id: string; onPress: () => void; visible?: boolean }[] } | null =
  null;

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: (...args: unknown[]) => mockNavigate(...args) }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      onPrimary: '#fff',
      border: '#ccc',
      surface: '#fff',
      background: '#fff',
      error: '#f00',
    },
  }),
}));
jest.mock('../../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (args: typeof mockHeader) => {
    mockHeader = args;
  },
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/hooks/useSongs', () => ({
  __esModule: true,
  useSongs: () => ({ songs: mockSongs, loading: mockLoading, reload: jest.fn() }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: { id: 'story-1' } }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));
jest.mock('../../../src/services/storymanagement/SongService', () => ({
  __esModule: true,
  createSongService: () => ({ createSong: mockCreateSong }),
}));
jest.mock('../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  pickTextFile: () => mockPickTextFile(),
}));
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return { __esModule: true, ScreenLoading: () => <Text>loading</Text> };
});
jest.mock('../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return { __esModule: true, default: TextInput };
});
jest.mock('../../../src/components/features/songs/SongCreateModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { visible: boolean; onConfirm: (title: string) => void }) =>
      props.visible ? (
        <Text testID="create-confirm" onPress={() => props.onConfirm('The Lantern Song')}>
          create
        </Text>
      ) : null,
  };
});

const song = (id: string, title: string, rest: Partial<SongSelect> = {}): SongSelect =>
  ({ id, title, key: null, tempo: null, meter: null, lyrics: '', ...rest }) as SongSelect;

beforeEach(() => {
  mockCanEdit = true;
  mockLoading = false;
  mockHeader = null;
  mockSongs = [song('s1', 'Anthem', { key: 'G', tempo: 90, meter: '3/4' }), song('s2', 'Lullaby')];
  mockNavigate.mockReset();
  mockCreateSong.mockReset().mockResolvedValue({ id: 'new-song', title: 'The Lantern Song' });
  mockPickTextFile.mockReset();
  mockShowNotification.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('songFactsLine', () => {
  it('lists the facts a song states and leaves out the rest', () => {
    expect(songFactsLine({ key: 'G', tempo: 90, meter: '3/4' })).toBe('G · 90 · 3/4');
    expect(songFactsLine({ key: null, tempo: 120, meter: null })).toBe('120');
    expect(songFactsLine({ key: null, tempo: null, meter: null })).toBe('');
  });
});

describe('SongListScreen', () => {
  it('lists the songs with the facts they state', async () => {
    const view = await render(<SongListScreen />);

    expect(view.getByText('Anthem')).toBeTruthy();
    expect(view.getByText('G · 90 · 3/4')).toBeTruthy();
    expect(view.getByText('Lullaby')).toBeTruthy();
  });

  it('opens a song in its editor', async () => {
    const view = await render(<SongListScreen />);

    await fireEvent.press(view.getByTestId('song-row-s2'));

    expect(mockNavigate).toHaveBeenCalledWith('SongEditor', { songId: 's2' });
  });

  it('narrows the list by what is typed in the search', async () => {
    const view = await render(<SongListScreen />);

    await fireEvent.changeText(view.getByTestId('song-search'), 'lull');

    expect(view.queryByText('Anthem')).toBeNull();
    expect(view.getByText('Lullaby')).toBeTruthy();

    await fireEvent.changeText(view.getByTestId('song-search'), 'zzz');
    expect(view.getByText('songs_no_match')).toBeTruthy();
  });

  it('says so when there are no songs', async () => {
    mockSongs = [];
    const view = await render(<SongListScreen />);

    expect(view.getByText('songs_empty')).toBeTruthy();
  });

  it('shows a loading state while the songs load', async () => {
    mockLoading = true;
    const view = await render(<SongListScreen />);

    expect(view.getByText('loading')).toBeTruthy();
  });

  it('makes a song from its title and opens it', async () => {
    const view = await render(<SongListScreen />);

    await act(async () => mockHeader?.actions?.find((a) => a.id === 'add-song')?.onPress());
    await fireEvent.press(view.getByTestId('create-confirm'));

    await waitFor(() =>
      expect(mockCreateSong).toHaveBeenCalledWith('user-1', {
        storyId: 'story-1',
        title: 'The Lantern Song',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('SongEditor', { songId: 'new-song' });
  });

  it('brings a ChordPro file in as a song, with its facts, and opens it', async () => {
    mockPickTextFile.mockResolvedValue({
      name: 'old-hymn.cho',
      text: '{title: Old hymn}\n{key: Em}\n{tempo: 70}\n{time: 3/4}\n[Em]Sing',
    });
    await render(<SongListScreen />);

    await act(async () => mockHeader?.actions?.find((a) => a.id === 'import-song')?.onPress());

    await waitFor(() =>
      expect(mockCreateSong).toHaveBeenCalledWith('user-1', {
        storyId: 'story-1',
        title: 'Old hymn',
        lyrics: '[Em]Sing',
        key: 'Em',
        tempo: 70,
        meter: '3/4',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('SongEditor', { songId: 'new-song' });
  });

  it('names an imported song after its file when the file gives it no title', async () => {
    mockPickTextFile.mockResolvedValue({ name: 'tavern.cho', text: '[C]Hi' });
    await render(<SongListScreen />);

    await act(async () => mockHeader?.actions?.find((a) => a.id === 'import-song')?.onPress());

    await waitFor(() => expect(mockCreateSong).toHaveBeenCalled());
    expect(mockCreateSong.mock.calls[0][1].title).toBe('tavern');
  });

  it('does nothing when no file is picked, and says so when it cannot be read as a song', async () => {
    mockPickTextFile.mockResolvedValueOnce(null);
    await render(<SongListScreen />);
    await act(async () => mockHeader?.actions?.find((a) => a.id === 'import-song')?.onPress());
    expect(mockCreateSong).not.toHaveBeenCalled();

    mockPickTextFile.mockResolvedValueOnce({ name: 'x.cho', text: 'words' });
    mockCreateSong.mockRejectedValueOnce(new Error('boom'));
    await act(async () => mockHeader?.actions?.find((a) => a.id === 'import-song')?.onPress());

    expect(mockShowNotification).toHaveBeenCalledWith('song_import_failed', 'error');
  });

  it('offers no way to add to someone who cannot edit', async () => {
    mockCanEdit = false;
    await render(<SongListScreen />);

    expect(mockHeader?.actions?.every((action) => action.visible === false)).toBe(true);
  });
});

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { SongSelect } from '../../../src/db/schema';
import SongEditorScreen, { songFileName } from '../../../src/screens/songs/SongEditorScreen';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockUpdateSong = jest.fn();
const mockDeleteSong = jest.fn();
const mockConfirmDelete = jest.fn();
const mockDeliverFile = jest.fn();
const mockShowNotification = jest.fn();
const mockPlay = jest.fn();
const mockStop = jest.fn();
const mockPlayTone = jest.fn();
let mockPlayback = {
  phase: 'idle',
  progress: 0,
  problem: null,
  active: null as { sectionIndex: number; sourceIndex: number; text: string } | null,
};

let mockCanEdit = true;
let mockSong: SongSelect | null | undefined;
let mockUses: { sceneId: string; sceneName: string }[] = [];
let mockHeader: {
  title: string;
  actions?: { id: string; onPress: () => void; visible?: boolean }[];
} | null = null;

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@react-navigation/native', () => {
  const route = { params: { songId: 'song-1' } };
  const navigation = {
    goBack: () => mockGoBack(),
    navigate: (...args: unknown[]) => mockNavigate(...args),
  };
  return { __esModule: true, useNavigation: () => navigation, useRoute: () => route };
});
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
jest.mock('../../../src/theme/commonStyles', () => ({
  __esModule: true,
  getCommonContainerStyles: () => ({ container: {} }),
}));
jest.mock('../../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  __esModule: true,
  useFormScrollBottomPadding: () => 0,
}));
jest.mock('../../../src/hooks/useOpenGalleryMediaViewer', () => ({
  __esModule: true,
  useOpenGalleryMediaViewer: () => jest.fn(),
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
jest.mock('../../../src/hooks/useConfirmDelete', () => ({
  __esModule: true,
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../src/hooks/useSongs', () => ({
  __esModule: true,
  useSong: () => mockSong,
  useSongUses: () => mockUses,
}));
jest.mock('../../../src/hooks/useSongPlayback', () => ({
  __esModule: true,
  useSongPlayback: () => ({
    ...mockPlayback,
    play: mockPlay,
    stop: mockStop,
    playTone: mockPlayTone,
  }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector?: (state: { userId: string }) => unknown) =>
    selector ? selector({ userId: 'user-1' }) : { userId: 'user-1' },
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));
jest.mock('../../../src/services/storymanagement/SongService', () => ({
  __esModule: true,
  createSongService: () => ({ updateSong: mockUpdateSong, deleteSong: mockDeleteSong }),
}));
jest.mock('../../../src/utils/storyTransfer', () => ({
  __esModule: true,
  deliverFile: (...args: unknown[]) => mockDeliverFile(...args),
}));
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: () => <Text>loading</Text>,
    ScreenError: ({ message }: { message: string }) => <Text testID="screen-error">{message}</Text>,
  };
});
jest.mock('../../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('../../../src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return { __esModule: true, default: TextInput };
});
jest.mock('../../../src/components/features/gallery/GalleryManager/EntityGalleryManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ ownerType }: { ownerType: string }) => (
      <Text testID="gallery-manager">{ownerType}</Text>
    ),
  };
});

const baseSong = {
  id: 'song-1',
  storyId: 'story-1',
  title: 'The Lantern Song',
  notes: 'Sung at the gate',
  lyrics: '{start_of_verse: Verse 1}\n[G]Light the [Em]lantern\n{end_of_verse}',
  lyricsTranslation: 'Acende o lampião',
  melody: null,
  key: 'G',
  tempo: 90,
  meter: '3/4',
} as unknown as SongSelect;

beforeEach(() => {
  mockCanEdit = true;
  mockSong = baseSong;
  mockUses = [];
  mockHeader = null;
  mockGoBack.mockReset();
  mockNavigate.mockReset();
  mockUpdateSong.mockReset().mockResolvedValue(undefined);
  mockDeleteSong.mockReset().mockResolvedValue(undefined);
  mockConfirmDelete.mockReset();
  mockDeliverFile.mockReset().mockResolvedValue({ delivered: true, fileName: 'x.cho' });
  mockShowNotification.mockReset();
  mockPlay.mockReset();
  mockStop.mockReset();
  mockPlayTone.mockReset();
  mockPlayback = { phase: 'idle', progress: 0, problem: null, active: null };
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('songFileName', () => {
  it('makes a file name of the letters and digits of a title', () => {
    expect(songFileName('The Lantern Song')).toBe('The-Lantern-Song.cho');
    expect(songFileName('  Canção, do Farol! ')).toBe('Canção-do-Farol.cho');
    expect(songFileName('???')).toBe('song.cho');
  });
});

describe('SongEditorScreen', () => {
  it('shows the song as it is saved', async () => {
    const view = await render(<SongEditorScreen />);

    expect(view.getByTestId('song-title').props.value).toBe('The Lantern Song');
    expect(view.getByTestId('song-key').props.value).toBe('G');
    expect(view.getByTestId('song-tempo').props.value).toBe('90');
    expect(view.getByTestId('song-lyrics').props.value).toContain('[G]Light the [Em]lantern');
    expect(view.getByTestId('song-translation').props.value).toBe('Acende o lampião');
    expect(view.getByTestId('song-notes').props.value).toBe('Sung at the gate');
    expect(mockHeader?.title).toBe('The Lantern Song');
    expect(view.getByTestId('gallery-manager').props.children).toBe('Song');
  });

  it('writes what is typed once the field is left, and only the field that changed', async () => {
    const view = await render(<SongEditorScreen />);

    await fireEvent.changeText(view.getByTestId('song-title'), 'The Lantern Hymn');
    expect(mockUpdateSong).not.toHaveBeenCalled();
    await fireEvent(view.getByTestId('song-title'), 'blur');

    await waitFor(() =>
      expect(mockUpdateSong).toHaveBeenCalledWith('user-1', 'song-1', {
        title: 'The Lantern Hymn',
      }),
    );
  });

  it('moves the chords and the key together when transposed', async () => {
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('song-transpose-up'));
    await act(async () => mockHeader?.actions?.find((a) => a.id === 'export-song')?.onPress());

    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    const changes = mockUpdateSong.mock.calls[0][2];
    // G up a semitone is written Ab, the way that key is: the chords follow its spelling.
    expect(changes.key).toBe('Ab');
    expect(changes.lyrics).toContain('[Ab]Light the [Fm]lantern');
  });

  it('spells a song moved down in the flats of its new key', async () => {
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('song-transpose-down'));
    await fireEvent.press(view.getByTestId('song-transpose-down'));
    await act(async () => mockHeader?.actions?.find((a) => a.id === 'export-song')?.onPress());

    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    const changes = mockUpdateSong.mock.calls[0][2];
    expect(changes.key).toBe('F');
    expect(changes.lyrics).toContain('[F]Light the [Dm]lantern');
  });

  it('hands the song over as a ChordPro file named after its title', async () => {
    await render(<SongEditorScreen />);

    await act(async () => mockHeader?.actions?.find((a) => a.id === 'export-song')?.onPress());

    await waitFor(() => expect(mockDeliverFile).toHaveBeenCalledTimes(1));
    const [contents, fileName, mimeType] = mockDeliverFile.mock.calls[0];
    expect(fileName).toBe('The-Lantern-Song.cho');
    expect(mimeType).toBe('text/plain');
    expect(contents).toContain('{title: The Lantern Song}');
    expect(contents).toContain('{key: G}');
    expect(contents).toContain('{time: 3/4}');
    expect(contents).toContain('[G]Light the [Em]lantern');
  });

  it('says where the file is when there is nothing to share it with', async () => {
    mockDeliverFile.mockResolvedValue({
      delivered: false,
      uri: 'file:///cache/x.cho',
      fileName: 'x',
    });
    await render(<SongEditorScreen />);

    await act(async () => mockHeader?.actions?.find((a) => a.id === 'export-song')?.onPress());

    await waitFor(() =>
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.stringContaining('export_story_no_share_target'),
        'warning',
      ),
    );
  });

  it('shows the tune, and writes it once the field is left', async () => {
    mockSong = { ...baseSong, melody: 'C D E' } as unknown as SongSelect;
    const view = await render(<SongEditorScreen />);

    expect(view.getByTestId('song-melody').props.value).toBe('C D E');
    await fireEvent.changeText(view.getByTestId('song-melody'), 'C D E F');
    await fireEvent(view.getByTestId('song-melody'), 'blur');

    await waitFor(() =>
      expect(mockUpdateSong).toHaveBeenCalledWith('user-1', 'song-1', { melody: 'C D E F' }),
    );
  });

  it('moves the tune with the chords when transposed', async () => {
    mockSong = { ...baseSong, melody: 'P:Verse 1\nC D E2' } as unknown as SongSelect;
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('song-transpose-up'));
    await act(async () => mockHeader?.actions?.find((a) => a.id === 'export-song')?.onPress());

    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    // G up a semitone is Ab: the notes are spelled in its flats, and keep their lengths.
    expect(mockUpdateSong.mock.calls[0][2].melody).toBe('P:Verse 1\n_D _E F2');
  });

  it('leaves an empty tune empty when transposed', async () => {
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('song-transpose-up'));
    await act(async () => mockHeader?.actions?.find((a) => a.id === 'export-song')?.onPress());

    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    expect('melody' in mockUpdateSong.mock.calls[0][2]).toBe(false);
  });

  it('hands the tune over as a MIDI file named after the title', async () => {
    mockSong = { ...baseSong, melody: 'G A B c' } as unknown as SongSelect;
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('melody-export-midi'));

    await waitFor(() => expect(mockDeliverFile).toHaveBeenCalledTimes(1));
    const [contents, fileName, mimeType] = mockDeliverFile.mock.calls[0];
    expect(fileName).toBe('The-Lantern-Song.mid');
    expect(mimeType).toBe('audio/midi');
    expect(String.fromCharCode(...(contents as Uint8Array).slice(0, 4))).toBe('MThd');
  });

  it('hands the tune over as an ABC file with the words under the notes', async () => {
    mockSong = { ...baseSong, melody: 'G A B c' } as unknown as SongSelect;
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('melody-export-abc'));

    await waitFor(() => expect(mockDeliverFile).toHaveBeenCalledTimes(1));
    const [contents, fileName, mimeType] = mockDeliverFile.mock.calls[0];
    expect(fileName).toBe('The-Lantern-Song.abc');
    expect(mimeType).toBe('text/vnd.abc');
    expect(contents).toContain('T:The Lantern Song');
    expect(contents).toContain('M:3/4');
    expect(contents).toContain('K:G');
    expect(contents).toContain('w: Light the lantern');
  });

  it('plays the song from the start, hummed, when play is pressed', async () => {
    mockSong = { ...baseSong, melody: 'G A B c' } as unknown as SongSelect;
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('melody-play'));

    expect(mockPlay).toHaveBeenCalledWith(
      { kind: 'song' },
      {
        timbre: 'hum',
        click: false,
        instrument: null,
        feel: 'auto',
      },
    );
  });

  it('stops what plays when the button is pressed again', async () => {
    mockPlayback = { ...mockPlayback, phase: 'playing' };
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('melody-play'));

    expect(mockStop).toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('asks the player to sound a key and writes the note it plays', async () => {
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByTestId('piano-key-64'));

    expect(mockPlayTone).toHaveBeenCalledWith(64, 'hum');
    await fireEvent(view.getByTestId('song-melody'), 'blur');
    await waitFor(() =>
      expect(mockUpdateSong).toHaveBeenCalledWith('user-1', 'song-1', {
        melody: 'P:Verse 1\nE',
      }),
    );
  });

  it('asks before deleting, and goes back once the song is gone', async () => {
    await render(<SongEditorScreen />);

    await act(async () => mockHeader?.actions?.find((a) => a.id === 'delete-song')?.onPress());
    const options = mockConfirmDelete.mock.calls[0][0];
    expect(options.titleKey).toBe('song_delete_title');
    expect(mockDeleteSong).not.toHaveBeenCalled();
    await act(async () => options.onConfirm());

    expect(mockDeleteSong).toHaveBeenCalledWith('user-1', 'song-1');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('lists the scenes that sing it, and opens one', async () => {
    mockUses = [{ sceneId: 'scene-9', sceneName: 'The tavern' }];
    const view = await render(<SongEditorScreen />);

    await fireEvent.press(view.getByText('The tavern'));

    expect(mockNavigate).toHaveBeenCalledWith('NarrativeElementsStack', {
      screen: 'SceneDetail',
      params: { sceneId: 'scene-9' },
    });
  });

  it('says so when no scene sings it', async () => {
    const view = await render(<SongEditorScreen />);

    expect(view.getByText('song_scenes_none')).toBeTruthy();
  });

  it('shows a loading state while the song loads, and an error for one that is gone', async () => {
    mockSong = undefined;
    const loading = await render(<SongEditorScreen />);
    expect(loading.getByText('loading')).toBeTruthy();
    await loading.unmount();

    mockSong = null;
    const gone = await render(<SongEditorScreen />);
    expect(gone.getByTestId('screen-error').props.children).toBe('song_not_found');
  });

  it('is read-only for someone who cannot edit', async () => {
    mockCanEdit = false;
    const view = await render(<SongEditorScreen />);

    expect(view.getByTestId('song-title').props.editable).toBe(false);
    expect(view.getByTestId('song-notes').props.editable).toBe(false);
    expect(mockHeader?.actions?.find((action) => action.id === 'delete-song')?.visible).toBe(false);
  });
});

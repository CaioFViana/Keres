import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { SceneMusicView } from '../../../../src/hooks/useSceneMusic';
import SceneMusicScreen from '../../../../src/screens/narrative-elements/scenes/SceneMusicScreen';

const mockGoBack = jest.fn();
const mockAddMusic = jest.fn();
const mockUpdateMusic = jest.fn();
const mockRetarget = jest.fn();
const mockMoveMusic = jest.fn();
const mockDeleteMusic = jest.fn();
const mockConfirmDelete = jest.fn();
const mockShowNotification = jest.fn();
const mockGetScene = jest.fn();
const mockGetSong = jest.fn();
const mockNavigate = jest.fn();
const mockOpenMedia = jest.fn();
const mockAlert = jest.fn();
const mockPlay = jest.fn();
const mockStop = jest.fn();
let mockPlayback: { phase: string; tag: string | null; problem: string | null } = {
  phase: 'idle',
  tag: null,
  problem: null,
};

let mockCanEdit = true;
let mockMedium: string | null = 'comic';
let mockViews: SceneMusicView[] = [];
let mockHeader: { title: string; actions?: { id: string; onPress: () => void }[] } | null = null;

jest.mock('@react-navigation/native', () => {
  const route = { params: { sceneId: 'scene-1' } };
  const navigation = {
    goBack: () => mockGoBack(),
    navigate: (...args: unknown[]) => mockNavigate(...args),
  };
  return { __esModule: true, useNavigation: () => navigation, useRoute: () => route };
});
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      primary: '#00f',
      onPrimary: '#fff',
      text: '#111',
      textSecondary: '#555',
      border: '#ccc',
      surface: '#fff',
      error: '#f00',
      background: '#fff',
    },
  }),
}));
jest.mock('../../../../src/theme/commonStyles', () => ({
  __esModule: true,
  getCommonContainerStyles: () => ({ container: {} }),
}));
jest.mock('../../../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../../src/hooks/useFormScrollBottomPadding', () => ({
  __esModule: true,
  useFormScrollBottomPadding: () => 0,
}));
jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (args: typeof mockHeader) => {
    mockHeader = args;
  },
}));
jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../../src/hooks/useSceneArcMedium', () => ({
  __esModule: true,
  useSceneArcMedium: () => mockMedium,
}));
jest.mock('../../../../src/hooks/useSceneMusic', () => ({
  __esModule: true,
  useSceneMusic: () => ({ views: mockViews, loading: false, reload: jest.fn() }),
}));
jest.mock('../../../../src/hooks/useSongPlayback', () => ({
  __esModule: true,
  useSongPlayback: () => ({ ...mockPlayback, play: mockPlay, stop: mockStop }),
}));
jest.mock('../../../../src/hooks/useOpenGalleryMediaViewer', () => ({
  __esModule: true,
  useOpenGalleryMediaViewer: () => mockOpenMedia,
}));
jest.mock('../../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../../src/services/storymanagement/SongService', () => ({
  __esModule: true,
  createSongService: () => ({ getById: mockGetSong }),
}));
jest.mock('../../../../src/hooks/useConfirmDelete', () => ({
  __esModule: true,
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));
jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getById: mockGetScene }),
}));
jest.mock('../../../../src/services/storymanagement/SceneMusicService', () => ({
  __esModule: true,
  createSceneMusicService: () => ({
    addMusic: mockAddMusic,
    updateMusic: mockUpdateMusic,
    retarget: mockRetarget,
    moveMusic: mockMoveMusic,
    deleteMusic: mockDeleteMusic,
  }),
}));
jest.mock('../../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: () => <Text>loading</Text>,
    ScreenError: ({ message }: { message: string }) => <Text testID="screen-error">{message}</Text>,
  };
});
jest.mock('../../../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('../../../../src/components/features/scenes/SceneMusic/SceneMusicTargetPicker', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { visible: boolean; onPick: (target: { galleryId: string }) => void }) =>
      props.visible ? (
        <>
          <Text testID="picker-open">open</Text>
          <Text testID="pick-medium" onPress={() => props.onPick({ galleryId: 'g-9' })}>
            medium
          </Text>
        </>
      ) : null,
  };
});
jest.mock('../../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return { __esModule: true, default: TextInput };
});
jest.mock('../../../../src/components/common/controls/Button/Button', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  };
});

const view = (id: string, overrides: Partial<SceneMusicView> = {}): SceneMusicView => ({
  music: {
    id,
    storyId: 'story-1',
    sceneId: 'scene-1',
    rank: id,
    songId: null,
    galleryId: 'g',
    role: 'score',
    cue: `cue ${id}`,
    sections: null,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  targetKind: 'audio',
  targetName: `${id}.mp3`,
  targetGone: false,
  songSections: [],
  missingSections: [],
  songFacts: null,
  ...overrides,
});

/** Opens the menu of a piece and presses one of its buttons, as a person would. */
const pressInMenu = async (
  screen: Awaited<ReturnType<typeof render>>,
  id: string,
  text: string,
) => {
  await fireEvent.press(screen.getByTestId(`scene-music-menu-${id}`));
  const buttons = mockAlert.mock.calls[mockAlert.mock.calls.length - 1][2] as {
    text: string;
    onPress?: () => void;
  }[];
  const button = buttons.find((item) => item.text === text);
  expect(button).toBeDefined();
  await act(async () => button?.onPress?.());
};

const renderScreen = async () => {
  const utils = await render(<SceneMusicScreen />);
  await waitFor(() => expect(utils.queryByText('loading')).toBeNull());
  return utils;
};

beforeEach(() => {
  mockCanEdit = true;
  mockMedium = 'comic';
  mockViews = [view('m1'), view('m2'), view('m3')];
  mockHeader = null;
  mockGetScene.mockResolvedValue({
    id: 'scene-1',
    storyId: 'story-1',
    name: 'Tavern fight',
    isDeleted: false,
  });
  for (const mock of [
    mockAddMusic,
    mockUpdateMusic,
    mockRetarget,
    mockMoveMusic,
    mockDeleteMusic,
  ]) {
    mock.mockReset().mockResolvedValue(undefined);
  }
  mockConfirmDelete.mockReset();
  mockShowNotification.mockReset();
  mockNavigate.mockReset();
  mockOpenMedia.mockReset();
  mockAlert.mockReset();
  mockPlay.mockReset().mockResolvedValue(undefined);
  mockStop.mockReset();
  mockPlayback = { phase: 'idle', tag: null, problem: null };
  mockGetSong.mockReset().mockResolvedValue({
    id: 's-1',
    isDeleted: false,
    lyrics: '{sov: Verse 1}\nOne two\n{eov}\n{soc: Chorus}\nLa la\n{eoc}',
    melody: null,
    tempo: 100,
    meter: '4/4',
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('SceneMusicScreen', () => {
  it('shows the scene, the notice and each piece of music, under the word of the work', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('Tavern fight')).toBeTruthy();
    expect(screen.getByText('scene_music_notice')).toBeTruthy();
    expect(screen.getByText('m1.mp3')).toBeTruthy();
    expect(screen.getByText('m3.mp3')).toBeTruthy();
    expect(mockHeader?.title).toBe('scene_music_word_soundtrack');
  });

  it('says so when there is no music yet', async () => {
    mockViews = [];
    const screen = await renderScreen();

    expect(screen.getByText('scene_music_empty')).toBeTruthy();
    // The one button to add is in the empty state; with music there is the one in the header.
    expect(screen.getAllByText('scene_music_add')).toHaveLength(1);
  });

  it('adds music from the picker, at the end of the scene', async () => {
    const screen = await renderScreen();

    await act(async () => mockHeader?.actions?.[0].onPress());
    expect(screen.getByTestId('picker-open')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pick-medium'));

    expect(mockAddMusic).toHaveBeenCalledWith('user-1', {
      storyId: 'story-1',
      sceneId: 'scene-1',
      target: { galleryId: 'g-9' },
    });
    expect(screen.queryByTestId('picker-open')).toBeNull();
  });

  it('moves a piece from its menu, and offers no move past either end', async () => {
    const screen = await renderScreen();

    await pressInMenu(screen, 'm1', 'scene_music_move_down');
    expect(mockMoveMusic).toHaveBeenCalledWith('user-1', 'm1', 1);

    await pressInMenu(screen, 'm3', 'scene_music_move_up');
    expect(mockMoveMusic).toHaveBeenLastCalledWith('user-1', 'm3', 1);

    const texts = (id: string) => {
      const call = mockAlert.mock.calls.find(
        (item) => (item[2] as { text: string }[]).length > 0 && item[0] === `${id}.mp3`,
      );
      return (call?.[2] as { text: string }[]).map((item) => item.text);
    };
    expect(texts('m1')).not.toContain('scene_music_move_up');
    expect(texts('m3')).not.toContain('scene_music_move_down');
  });

  it('saves the cue when the field is left, and only if it changed', async () => {
    const screen = await renderScreen();
    const field = screen.getAllByLabelText('scene_music_cue_label')[0];

    await fireEvent(field, 'blur');
    expect(mockUpdateMusic).not.toHaveBeenCalled();

    await fireEvent.changeText(field, 'as she opens the door');
    await fireEvent(field, 'blur');
    expect(mockUpdateMusic).toHaveBeenCalledWith('user-1', 'm1', { cue: 'as she opens the door' });
  });

  it('changes whether the people in the story hear it', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('scene-music-role-m2-in-world'));

    expect(mockUpdateMusic).toHaveBeenCalledWith('user-1', 'm2', { role: 'in-world' });
  });

  it('asks before deleting, and deletes once confirmed', async () => {
    const screen = await renderScreen();

    await pressInMenu(screen, 'm2', 'delete');
    const options = mockConfirmDelete.mock.calls[0][0];
    expect(options.titleKey).toBe('scene_music_delete_title');
    expect(mockDeleteMusic).not.toHaveBeenCalled();
    await act(async () => options.onConfirm());
    expect(mockDeleteMusic).toHaveBeenCalledWith('user-1', 'm2');
  });

  it('shows "removed" on music whose target is gone and points it at another from the picker', async () => {
    mockViews = [view('m1', { targetGone: true, targetKind: null, targetName: null })];
    const screen = await renderScreen();

    expect(screen.getByText('scene_music_removed')).toBeTruthy();
    await fireEvent.press(screen.getByText('scene_music_removed_hint'));
    await fireEvent.press(screen.getByTestId('pick-medium'));

    expect(mockRetarget).toHaveBeenCalledWith('user-1', 'm1', { galleryId: 'g-9' });
    expect(mockAddMusic).not.toHaveBeenCalled();
  });

  describe('a song', () => {
    const songView = (sections: string[] | null, missing: string[] = []) =>
      view('m1', {
        targetKind: 'song',
        targetName: 'Tavern song',
        songSections: ['Verse 1', 'Chorus'],
        missingSections: missing,
        music: { ...view('m1').music, songId: 's-1', galleryId: null, role: 'in-world', sections },
      });

    it('offers the sections of the song, and sings the whole of it unless some are chosen', async () => {
      mockViews = [songView(null)];
      const screen = await renderScreen();

      expect(
        screen.getByTestId('scene-music-section-whole').props.accessibilityState.selected,
      ).toBe(true);
      await fireEvent.press(screen.getByTestId('scene-music-section-Chorus'));

      expect(mockUpdateMusic).toHaveBeenCalledWith('user-1', 'm1', { sections: ['Chorus'] });
    });

    it('adds a section to the ones chosen, takes one away, and goes back to the whole song with none', async () => {
      mockViews = [songView(['Chorus'])];
      const screen = await renderScreen();

      await fireEvent.press(screen.getByTestId('scene-music-section-Verse 1'));
      expect(mockUpdateMusic).toHaveBeenLastCalledWith('user-1', 'm1', {
        sections: ['Chorus', 'Verse 1'],
      });

      await fireEvent.press(screen.getByTestId('scene-music-section-Chorus'));
      expect(mockUpdateMusic).toHaveBeenLastCalledWith('user-1', 'm1', { sections: null });

      await fireEvent.press(screen.getByTestId('scene-music-section-whole'));
      expect(mockUpdateMusic).toHaveBeenLastCalledWith('user-1', 'm1', { sections: null });
    });

    it('says which of the sections it names are no longer in the lyrics', async () => {
      mockViews = [songView(['Coro', 'Chorus'], ['Coro'])];
      const screen = await renderScreen();

      expect(screen.getByTestId('scene-music-missing-m1')).toBeTruthy();
    });

    it('plays the parts the scene sings, hummed, from the button on the piece', async () => {
      mockViews = [songView(['Chorus'])];
      const screen = await renderScreen();

      await fireEvent.press(screen.getByTestId('scene-music-listen-m1'));

      await waitFor(() => expect(mockPlay).toHaveBeenCalledTimes(1));
      const [scope, voice, options] = mockPlay.mock.calls[0];
      expect(scope).toEqual({ kind: 'parts', labels: ['Chorus'] });
      // A song with chords or words and no tune yet is heard on a piano.
      expect(voice).toEqual({ timbre: 'hum', click: false, instrument: 'piano' });
      expect(options.tag).toBe('m1');
      expect(options.input).toMatchObject({ tempo: 100, meter: '4/4', language: 'en', melody: '' });
    });

    it('hums the tune alone when the song has one', async () => {
      mockGetSong.mockResolvedValue({
        id: 's-1',
        isDeleted: false,
        lyrics: '{sov: Verse 1}\nOne two\n{eov}',
        melody: 'C D',
        tempo: null,
        meter: null,
      });
      mockViews = [songView(null)];
      const screen = await renderScreen();

      await fireEvent.press(screen.getByTestId('scene-music-listen-m1'));

      await waitFor(() => expect(mockPlay).toHaveBeenCalled());
      expect(mockPlay.mock.calls[0][0]).toEqual({ kind: 'parts', labels: null });
      expect(mockPlay.mock.calls[0][1].instrument).toBeNull();
    });

    it('stops when the piece that plays is pressed again, and shows it plays', async () => {
      mockViews = [songView(null)];
      mockPlayback = { phase: 'playing', tag: 'm1', problem: null };
      const screen = await renderScreen();

      await fireEvent.press(screen.getByTestId('scene-music-listen-m1'));

      expect(mockStop).toHaveBeenCalled();
      expect(mockPlay).not.toHaveBeenCalled();
    });

    it('says when there is nothing to play, and when playing fails', async () => {
      mockViews = [songView(null)];
      mockPlayback = { phase: 'idle', tag: null, problem: 'no-tune' };
      const none = await renderScreen();
      expect(none.getByTestId('scene-music-listen-problem').props.children).toBe(
        'scene_music_listen_none',
      );
      await none.unmount();

      mockPlayback = { phase: 'idle', tag: null, problem: null };
      mockGetSong.mockRejectedValue(new Error('gone'));
      const failed = await renderScreen();
      await fireEvent.press(failed.getByTestId('scene-music-listen-m1'));
      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith('melody_play_failed', 'error'),
      );
    });

    it('opens the song to edit when its name is pressed', async () => {
      mockViews = [songView(null)];
      const screen = await renderScreen();

      await fireEvent.press(screen.getByTestId('scene-music-open-m1'));

      expect(mockNavigate).toHaveBeenCalledWith('SongStack', {
        screen: 'SongEditor',
        params: { songId: 's-1' },
      });
    });

    it('says what the song states in a line under its name', async () => {
      mockViews = [{ ...songView(['Chorus']), songFacts: 'G · 90 · 3/4' }];
      const screen = await renderScreen();

      expect(screen.getByText('G · 90 · 3/4 · Chorus')).toBeTruthy();
    });

    it('offers no sections for music that is not a song', async () => {
      const screen = await renderScreen();

      expect(screen.queryByTestId('scene-music-sections-m1')).toBeNull();
    });
  });

  it('looks at a medium of the Gallery when its name is pressed, and has nothing to hear', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('scene-music-open-m1'));

    expect(mockOpenMedia).toHaveBeenCalledWith('g');
    expect(screen.queryByTestId('scene-music-listen-m1')).toBeNull();
  });

  it('does not open music whose target is gone', async () => {
    mockViews = [view('m1', { targetGone: true, targetKind: null, targetName: null })];
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('scene-music-open-m1'));

    expect(mockOpenMedia).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('is read-only for someone who cannot edit', async () => {
    mockCanEdit = false;
    const screen = await renderScreen();

    expect(screen.queryByTestId('scene-music-menu-m1')).toBeNull();
    expect(screen.queryByText('scene_music_add')).toBeNull();
    expect(mockHeader?.actions?.[0]).toMatchObject({ visible: false });
  });

  it('tells the person when a service call fails', async () => {
    mockMoveMusic.mockRejectedValue(new Error('boom'));
    const screen = await renderScreen();

    await pressInMenu(screen, 'm1', 'scene_music_move_down');

    expect(mockShowNotification).toHaveBeenCalledWith('scene_music_save_failed', 'error');
  });

  it('shows an error for a scene that is gone', async () => {
    mockGetScene.mockResolvedValue(undefined);
    const screen = await render(<SceneMusicScreen />);

    await waitFor(() => expect(screen.getByTestId('screen-error')).toBeTruthy());
  });
});

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

let mockCanEdit = true;
let mockMedium: string | null = 'comic';
let mockViews: SceneMusicView[] = [];
let mockHeader: { title: string; actions?: { id: string; onPress: () => void }[] } | null = null;

jest.mock('@react-navigation/native', () => {
  const route = { params: { sceneId: 'scene-1' } };
  const navigation = { goBack: () => mockGoBack() };
  return { __esModule: true, useNavigation: () => navigation, useRoute: () => route };
});
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
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
  ...overrides,
});

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

  it('moves a piece to the place it lands on, and offers no move past either end', async () => {
    const screen = await renderScreen();

    const down = screen.getAllByLabelText('scene_music_move_down');
    await fireEvent.press(down[0]);
    expect(mockMoveMusic).toHaveBeenCalledWith('user-1', 'm1', 1);

    const up = screen.getAllByLabelText('scene_music_move_up');
    await fireEvent.press(up[2]);
    expect(mockMoveMusic).toHaveBeenLastCalledWith('user-1', 'm3', 1);
    expect(up[0].props.accessibilityState?.disabled).toBe(true);
    expect(down[2].props.accessibilityState?.disabled).toBe(true);
  });

  it('saves the cue when the field is left, and only if it changed', async () => {
    const screen = await renderScreen();
    const field = screen.getAllByLabelText('scene_music_cue_placeholder')[0];

    await fireEvent(field, 'blur');
    expect(mockUpdateMusic).not.toHaveBeenCalled();

    await fireEvent.changeText(field, 'as she opens the door');
    await fireEvent(field, 'blur');
    expect(mockUpdateMusic).toHaveBeenCalledWith('user-1', 'm1', { cue: 'as she opens the door' });
  });

  it('changes whether the people in the story hear it', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getAllByText('scene_music_role_in_world')[1]);

    expect(mockUpdateMusic).toHaveBeenCalledWith('user-1', 'm2', { role: 'in-world' });
  });

  it('asks before deleting, and deletes once confirmed', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getAllByLabelText('delete')[1]);
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

  it('is read-only for someone who cannot edit', async () => {
    mockCanEdit = false;
    const screen = await renderScreen();

    expect(screen.queryAllByLabelText('delete')).toHaveLength(0);
    expect(screen.queryAllByLabelText('scene_music_move_up')).toHaveLength(0);
    expect(screen.queryByText('scene_music_add')).toBeNull();
    expect(mockHeader?.actions?.[0]).toMatchObject({ visible: false });
  });

  it('tells the person when a service call fails', async () => {
    mockMoveMusic.mockRejectedValue(new Error('boom'));
    const screen = await renderScreen();

    await fireEvent.press(screen.getAllByLabelText('scene_music_move_down')[0]);

    expect(mockShowNotification).toHaveBeenCalledWith('scene_music_save_failed', 'error');
  });

  it('shows an error for a scene that is gone', async () => {
    mockGetScene.mockResolvedValue(undefined);
    const screen = await render(<SceneMusicScreen />);

    await waitFor(() => expect(screen.getByTestId('screen-error')).toBeTruthy());
  });
});

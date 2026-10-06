import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { ScenePageView } from '../../../../src/hooks/useScenePages';
import ScenePagesScreen from '../../../../src/screens/narrative-elements/scenes/ScenePagesScreen';

const mockGoBack = jest.fn();
const mockCreatePage = jest.fn();
const mockUpdatePage = jest.fn();
const mockReplaceMedia = jest.fn();
const mockMovePage = jest.fn();
const mockDeletePage = jest.fn();
const mockConfirmDelete = jest.fn();
const mockShowNotification = jest.fn();
const mockGetScene = jest.fn();

let mockCanEdit = true;
let mockMedium: string | null = 'comic';
let mockViews: ScenePageView[] = [];
let mockHeader: { title: string; actions?: { id: string; onPress: () => void }[] } | null = null;
let mockPickerProps: {
  visible: boolean;
  onPick: (media: { sketchId: string } | { galleryId: string }) => void;
} | null = null;

jest.mock('@react-navigation/native', () => {
  const route = { params: { sceneId: 'scene-1' } };
  const navigation = { goBack: () => mockGoBack() };
  return { __esModule: true, useNavigation: () => navigation, useRoute: () => route };
});
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: { index?: number; count?: number }) =>
      options?.index ? `${key}:${options.index}` : key,
  }),
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
jest.mock('../../../../src/hooks/useScenePages', () => ({
  __esModule: true,
  useScenePages: () => ({ pages: mockViews, loading: false, reload: jest.fn() }),
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
jest.mock('../../../../src/services/storymanagement/ScenePageService', () => ({
  __esModule: true,
  createScenePageService: () => ({
    createPage: mockCreatePage,
    updatePage: mockUpdatePage,
    replaceMedia: mockReplaceMedia,
    movePage: mockMovePage,
    deletePage: mockDeletePage,
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
jest.mock('../../../../src/components/features/scenes/ScenePages/ScenePageThumb', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../../src/components/features/scenes/ScenePages/ScenePageMediaPicker', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: NonNullable<typeof mockPickerProps>) => {
      mockPickerProps = props;
      return props.visible ? (
        <>
          <Text testID="picker-open">open</Text>
          <Text testID="pick-sketch" onPress={() => props.onPick({ sketchId: 'sk-1' })}>
            sketch
          </Text>
        </>
      ) : null;
    },
  };
});
jest.mock('../../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return { __esModule: true, default: TextInput };
});

const view = (id: string, overrides: Partial<ScenePageView> = {}): ScenePageView => ({
  page: {
    id,
    storyId: 'story-1',
    sceneId: 'scene-1',
    rank: id,
    sketchId: null,
    galleryId: 'g',
    fit: 'contain',
    text: `text ${id}`,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  thumbGalleryId: 'g',
  mediaName: 'image.png',
  isSketch: false,
  mediaGone: false,
  ...overrides,
});

const renderScreen = async () => {
  const utils = await render(<ScenePagesScreen />);
  await waitFor(() => expect(utils.queryByText('loading')).toBeNull());
  return utils;
};

beforeEach(() => {
  mockCanEdit = true;
  mockMedium = 'comic';
  mockViews = [view('p1'), view('p2'), view('p3')];
  mockHeader = null;
  mockPickerProps = null;
  mockGetScene.mockResolvedValue({
    id: 'scene-1',
    storyId: 'story-1',
    name: 'Standoff',
    isDeleted: false,
  });
  for (const mock of [
    mockCreatePage,
    mockUpdatePage,
    mockReplaceMedia,
    mockMovePage,
    mockDeletePage,
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

describe('ScenePagesScreen', () => {
  it('shows the scene, the sketch-only notice and each page numbered, in a comic', async () => {
    const screen = await renderScreen();

    expect(screen.getByText('Standoff')).toBeTruthy();
    expect(screen.getByText('scene_pages_notice')).toBeTruthy();
    expect(screen.getByText('scene_pages_label_page:1')).toBeTruthy();
    expect(screen.getByText('scene_pages_label_page:3')).toBeTruthy();
    expect(mockHeader?.title).toBe('scene_pages');
  });

  it('calls them frames in a storyboard', async () => {
    mockMedium = 'storyboard';
    const screen = await renderScreen();

    expect(screen.getByText('scene_pages_label_frame:1')).toBeTruthy();
    expect(mockHeader?.title).toBe('scene_frames');
  });

  it('says so when there are no pages yet', async () => {
    mockViews = [];
    const screen = await renderScreen();

    expect(screen.getByText('scene_pages_empty_page')).toBeTruthy();
  });

  it('adds a page from the picker, at the end of the scene', async () => {
    const screen = await renderScreen();

    await act(async () => mockHeader?.actions?.[0].onPress());
    expect(screen.getByTestId('picker-open')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pick-sketch'));

    expect(mockCreatePage).toHaveBeenCalledWith('user-1', {
      storyId: 'story-1',
      sceneId: 'scene-1',
      media: { sketchId: 'sk-1' },
    });
    expect(screen.queryByTestId('picker-open')).toBeNull();
  });

  it('moves a page to the place it lands on, and offers no move past either end', async () => {
    const screen = await renderScreen();

    const down = screen.getAllByLabelText('scene_pages_move_down');
    await fireEvent.press(down[0]);
    expect(mockMovePage).toHaveBeenCalledWith('user-1', 'p1', 1);

    const up = screen.getAllByLabelText('scene_pages_move_up');
    await fireEvent.press(up[2]);
    expect(mockMovePage).toHaveBeenLastCalledWith('user-1', 'p3', 1);
    expect(up[0].props.accessibilityState?.disabled).toBe(true);
    expect(down[2].props.accessibilityState?.disabled).toBe(true);
  });

  it('saves the text when the field is left, and only if it changed', async () => {
    const screen = await renderScreen();
    const field = screen.getAllByLabelText(/scene_pages_text_placeholder/)[0];

    await fireEvent(field, 'blur');
    expect(mockUpdatePage).not.toHaveBeenCalled();

    await fireEvent.changeText(field, 'new words');
    await fireEvent(field, 'blur');
    expect(mockUpdatePage).toHaveBeenCalledWith('user-1', 'p1', { text: 'new words' });
  });

  it('changes how the image fits', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getAllByText('scene_pages_fit_cover')[1]);

    expect(mockUpdatePage).toHaveBeenCalledWith('user-1', 'p2', { fit: 'cover' });
  });

  it('asks before deleting a page, and deletes it once confirmed', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getAllByLabelText('delete')[1]);
    const options = mockConfirmDelete.mock.calls[0][0];
    expect(options.titleKey).toBe('scene_pages_delete_title');
    expect(mockDeletePage).not.toHaveBeenCalled();
    await act(async () => options.onConfirm());
    expect(mockDeletePage).toHaveBeenCalledWith('user-1', 'p2');
  });

  it('shows "media removed" on a page whose image is gone and replaces it from the picker', async () => {
    mockViews = [view('p1', { mediaGone: true, thumbGalleryId: null, mediaName: null })];
    const screen = await renderScreen();

    expect(screen.getByText('scene_pages_media_removed')).toBeTruthy();
    await fireEvent.press(screen.getByText('scene_pages_media_removed'));
    await fireEvent.press(screen.getByTestId('pick-sketch'));

    expect(mockReplaceMedia).toHaveBeenCalledWith('user-1', 'p1', { sketchId: 'sk-1' });
    expect(mockCreatePage).not.toHaveBeenCalled();
  });

  it('is read-only for someone who cannot edit', async () => {
    mockCanEdit = false;
    const screen = await renderScreen();

    expect(screen.queryAllByLabelText('delete')).toHaveLength(0);
    expect(screen.queryAllByLabelText('scene_pages_move_up')).toHaveLength(0);
    expect(screen.queryByText('scene_pages_add_page')).toBeNull();
    expect(mockHeader?.actions?.[0]).toMatchObject({ visible: false });
  });

  it('tells the person when a service call fails', async () => {
    mockMovePage.mockRejectedValue(new Error('boom'));
    const screen = await renderScreen();

    await fireEvent.press(screen.getAllByLabelText('scene_pages_move_down')[0]);

    expect(mockShowNotification).toHaveBeenCalledWith('scene_pages_save_failed', 'error');
  });

  it('shows an error for a scene that is gone', async () => {
    mockGetScene.mockResolvedValue(undefined);
    const screen = await render(<ScenePagesScreen />);

    await waitFor(() => expect(screen.getByTestId('screen-error')).toBeTruthy());
  });
});

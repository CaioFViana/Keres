import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import SceneMusicTargetPicker from '../../../../src/components/features/scenes/SceneMusic/SceneMusicTargetPicker';

const mockUseSongs = jest.fn();
const mockUseGalleryMedia = jest.fn();
const onPick = jest.fn();
const onOpenSongs = jest.fn();

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
      onPrimary: '#fff',
      border: '#ccc',
      surface: '#fff',
    },
  }),
}));
jest.mock('../../../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});
jest.mock('../../../../src/hooks/useSongs', () => ({
  __esModule: true,
  useSongs: (...args: unknown[]) => mockUseSongs(...args),
}));
jest.mock('../../../../src/hooks/useGalleryMedia', () => ({
  __esModule: true,
  useGalleryMedia: (...args: unknown[]) => mockUseGalleryMedia(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSongs.mockReturnValue({
    songs: [{ id: 's1', title: 'Tavern song' }],
    loading: false,
  });
  mockUseGalleryMedia.mockReturnValue({
    media: [
      { id: 'g1', title: 'Playlist', fileName: 'p', mediaType: 'link' },
      { id: 'g2', title: null, fileName: 'theme.mp3', mediaType: 'audio' },
    ],
    loading: false,
  });
});

afterEach(() => {
  cleanup();
});

const renderPicker = (props: { onOpenSongs?: () => void; visible?: boolean } = {}) =>
  render(
    <SceneMusicTargetPicker
      visible={props.visible ?? true}
      storyId="story-1"
      onClose={jest.fn()}
      onPick={onPick}
      onOpenSongs={props.onOpenSongs}
    />,
  );

describe('SceneMusicTargetPicker', () => {
  it('tells two songs apart by what each states, when it states anything', async () => {
    mockUseSongs.mockReturnValue({
      songs: [
        { id: 's1', title: 'Tavern song', key: 'G', tempo: 90, meter: '3/4' },
        { id: 's2', title: 'Lullaby', key: null, tempo: null, meter: null },
      ],
      loading: false,
    });
    const view = await renderPicker();

    expect(view.getByText('G · 90 · 3/4')).toBeTruthy();
    expect(view.getByText('Lullaby')).toBeTruthy();
    expect(view.queryAllByText(/·/)).toHaveLength(1);
  });

  it('opens on the songs of the story and picks one', async () => {
    const view = await renderPicker();

    await fireEvent.press(view.getByLabelText('Tavern song'));

    expect(onPick).toHaveBeenCalledWith({ songId: 's1' });
  });

  it('reads the songs only while their tab is in view, and the Gallery only on its own', async () => {
    const view = await renderPicker();
    expect(mockUseSongs).toHaveBeenLastCalledWith('story-1');
    expect(mockUseGalleryMedia).toHaveBeenLastCalledWith('story-1', false, ['audio', 'link']);

    await fireEvent.press(view.getByTestId('scene-music-tab-gallery'));

    expect(mockUseSongs).toHaveBeenLastCalledWith(undefined);
    expect(mockUseGalleryMedia).toHaveBeenLastCalledWith('story-1', true, ['audio', 'link']);
  });

  it('picks an audio file or a link of the Gallery by its name', async () => {
    const view = await renderPicker();
    await fireEvent.press(view.getByTestId('scene-music-tab-gallery'));

    await fireEvent.press(view.getByLabelText('Playlist'));
    await fireEvent.press(view.getByLabelText('theme.mp3'));

    expect(onPick.mock.calls).toEqual([[{ galleryId: 'g1' }], [{ galleryId: 'g2' }]]);
  });

  it('says so when there are no songs, and when the Gallery has no audio or link', async () => {
    mockUseSongs.mockReturnValue({ songs: [], loading: false });
    mockUseGalleryMedia.mockReturnValue({ media: [], loading: false });
    const view = await renderPicker();

    expect(view.getByText('scene_music_pick_no_songs')).toBeTruthy();
    await fireEvent.press(view.getByTestId('scene-music-tab-gallery'));
    expect(view.getByText('scene_music_pick_none')).toBeTruthy();
  });

  it('offers to open the songs only when the screen lets it', async () => {
    const without = await renderPicker();
    expect(without.queryByTestId('scene-music-open-songs')).toBeNull();
    await without.unmount();

    const view = await renderPicker({ onOpenSongs });
    await fireEvent.press(view.getByTestId('scene-music-open-songs'));
    expect(onOpenSongs).toHaveBeenCalledTimes(1);
  });

  it('draws nothing while closed', async () => {
    const view = await renderPicker({ visible: false });

    expect(view.queryByTestId('scene-music-tab-songs')).toBeNull();
  });
});

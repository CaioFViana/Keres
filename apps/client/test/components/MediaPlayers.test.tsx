import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Image, PanResponder } from 'react-native';
import AudioPreviewPlayer from '../../src/components/features/media/MediaPlayer/AudioPreviewPlayer';
import ImageZoomViewer from '../../src/components/features/media/MediaPlayer/ImageZoomViewer';
import VideoPreviewPlayer from '../../src/components/features/media/MediaPlayer/VideoPreviewPlayer';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

// The RN jest preset already renders `Modal` children while visible and null while hidden.
jest.mock('@expo/vector-icons', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement(Text, { testID: `icon-${name}` }, name),
  };
});

const mockAudioPlayer = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn() };
let mockAudioStatus = { playing: false, isLoaded: true, duration: 120, currentTime: 30 };
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockAudioPlayer,
  useAudioPlayerStatus: () => mockAudioStatus,
}));

const mockVideo = {
  player: { loop: true },
  source: null as unknown,
  viewProps: null as Record<string, unknown> | null,
};
jest.mock('expo-video', () => {
  const ReactActual = require('react');
  const { View: RNView } = jest.requireActual('react-native');
  return {
    useVideoPlayer: (source: unknown, setup?: (player: unknown) => void) => {
      mockVideo.source = source;
      if (setup) setup(mockVideo.player);
      return mockVideo.player;
    },
    VideoView: (props: Record<string, unknown>) => {
      mockVideo.viewProps = props;
      return ReactActual.createElement(RNView, { testID: 'video-view' });
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAudioPlayer.play.mockClear();
  mockAudioPlayer.pause.mockClear();
  mockAudioPlayer.seekTo.mockClear();
  mockAudioStatus = { playing: false, isLoaded: true, duration: 120, currentTime: 30 };
  mockVideo.player = { loop: true };
  mockVideo.source = null;
  mockVideo.viewProps = null;
});

describe('AudioPreviewPlayer', () => {
  it('shows the elapsed and total time as m:ss', async () => {
    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);

    expect(screen.getByText('0:30')).toBeTruthy();
    expect(screen.getByText('2:00')).toBeTruthy();
  });

  it('falls back to 0:00 for times that are not finite', async () => {
    mockAudioStatus = { playing: false, isLoaded: true, duration: NaN, currentTime: NaN };

    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);

    expect(screen.getAllByText('0:00')).toHaveLength(2);
  });

  it('plays when paused and pauses when playing', async () => {
    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);
    await fireEvent.press(screen.getByTestId('icon-play').parent!);
    expect(mockAudioPlayer.play).toHaveBeenCalledTimes(1);

    mockAudioStatus = { ...mockAudioStatus, playing: true };
    await screen.rerender(<AudioPreviewPlayer uri="file://song.mp3" />);
    await fireEvent.press(screen.getByTestId('icon-pause').parent!);

    expect(mockAudioPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('rewinds to the start when played again after the end', async () => {
    mockAudioStatus = { playing: false, isLoaded: true, duration: 120, currentTime: 120 };
    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);

    await fireEvent.press(screen.getByTestId('icon-play').parent!);

    expect(mockAudioPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockAudioPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('ignores taps until the track is loaded', async () => {
    mockAudioStatus = { playing: false, isLoaded: false, duration: 0, currentTime: 0 };
    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);

    await fireEvent.press(screen.getByTestId('icon-play').parent!);

    expect(mockAudioPlayer.play).not.toHaveBeenCalled();
    expect(mockAudioPlayer.pause).not.toHaveBeenCalled();
  });

  // The tappable track is the only host node measuring itself.
  const trackOf = (screen: Awaited<ReturnType<typeof render>>) => {
    const tracks = screen.container.queryAll((node) => typeof node.props.onLayout === 'function');
    expect(tracks).toHaveLength(1);
    return tracks[0];
  };

  it('seeks proportionally to where the track is tapped', async () => {
    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);
    const track = trackOf(screen);
    await fireEvent(track, 'layout', { nativeEvent: { layout: { width: 200 } } });

    await fireEvent.press(track, { nativeEvent: { locationX: 50 } });

    expect(mockAudioPlayer.seekTo).toHaveBeenCalledWith(30);
  });

  it('clamps the seek ratio to the track instead of overshooting', async () => {
    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);
    const track = trackOf(screen);
    await fireEvent(track, 'layout', { nativeEvent: { layout: { width: 200 } } });

    await fireEvent.press(track, { nativeEvent: { locationX: 9999 } });

    expect(mockAudioPlayer.seekTo).toHaveBeenCalledWith(120);
  });

  it('ignores taps while the width or the duration is unknown', async () => {
    const screen = await render(<AudioPreviewPlayer uri="file://song.mp3" />);
    const track = trackOf(screen);

    // No onLayout yet, so the width is zero.
    await fireEvent.press(track, { nativeEvent: { locationX: 50 } });
    expect(mockAudioPlayer.seekTo).not.toHaveBeenCalled();

    await fireEvent(track, 'layout', { nativeEvent: { layout: { width: 200 } } });
    mockAudioStatus = { ...mockAudioStatus, isLoaded: false };
    await screen.rerender(<AudioPreviewPlayer uri="file://song.mp3" />);
    await fireEvent.press(trackOf(screen), { nativeEvent: { locationX: 50 } });
    expect(mockAudioPlayer.seekTo).not.toHaveBeenCalled();
  });
});

describe('VideoPreviewPlayer', () => {
  it('plays the given file once, with the native controls', async () => {
    const screen = await render(<VideoPreviewPlayer uri="file://clip.mp4" />);

    expect(screen.getByTestId('video-view')).toBeTruthy();
    expect(mockVideo.source).toEqual({ uri: 'file://clip.mp4' });
    expect(mockVideo.player.loop).toBe(false);
    expect(mockVideo.viewProps).toMatchObject({
      player: mockVideo.player,
      nativeControls: true,
      contentFit: 'contain',
      allowsFullscreen: true,
      allowsPictureInPicture: true,
    });
  });

  it('layers a custom style over the default video frame', async () => {
    await render(<VideoPreviewPlayer uri="file://clip.mp4" style={{ opacity: 0.5 }} />);

    expect(mockVideo.viewProps?.style).toEqual([
      expect.objectContaining({ width: '100%', height: '100%' }),
      { opacity: 0.5 },
    ]);
  });
});

describe('ImageZoomViewer', () => {
  const renderViewer = (props: Partial<React.ComponentProps<typeof ImageZoomViewer>> = {}) =>
    render(<ImageZoomViewer visible uri="file://photo.jpg" onClose={jest.fn()} {...props} />);

  beforeEach(() => {
    jest.spyOn(Image, 'getSize').mockImplementation(((
      uri: string,
      success: (w: number, h: number) => void,
    ) => {
      success(800, 600);
    }) as typeof Image.getSize);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing while hidden', async () => {
    const screen = await renderViewer({ visible: false });

    expect(screen.toJSON()).toBeNull();
    expect(Image.getSize).not.toHaveBeenCalled();
  });

  it('fits the image once its natural size is known', async () => {
    const screen = await renderViewer();

    expect(Image.getSize).toHaveBeenCalledWith(
      'file://photo.jpg',
      expect.any(Function),
      expect.any(Function),
    );
    await act(async () => undefined);
    expect(
      screen.container.queryAll((node) => node.props.source?.uri === 'file://photo.jpg'),
    ).toHaveLength(1);
  });

  it('falls back to the viewport when the size cannot be read', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation(((
      uri: string,
      success,
      failure?: () => void,
    ) => {
      failure?.();
    }) as typeof Image.getSize);

    const screen = await renderViewer();
    await act(async () => undefined);

    expect(
      screen.container.queryAll((node) => node.props.source?.uri === 'file://photo.jpg'),
    ).toHaveLength(1);
  });

  it('closes from the close button', async () => {
    const onClose = jest.fn();
    const screen = await renderViewer({ onClose });

    await fireEvent.press(screen.getByTestId('icon-close').parent!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('treats two quick taps as a double tap without crashing', async () => {
    const createSpy = jest.spyOn(PanResponder, 'create');
    const screen = await renderViewer();
    await act(async () => undefined);
    // The backdrop is the only host that takes over moves; the close button's touchable
    // host carries responder props too.
    const backdrops = screen.container.queryAll(
      (node) => typeof node.props.onMoveShouldSetResponder === 'function',
    );
    expect(backdrops).toHaveLength(1);

    // `panHandlers` funnels through the native touch bank, which does not exist in Jest; the
    // captured config is the component's real gesture logic, driven here with synthetic touches.
    const config = createSpy.mock.calls[0][0];
    await act(async () => {
      const tap = { nativeEvent: { touches: [{ pageX: 100, pageY: 100 }] } };
      config.onPanResponderGrant?.(tap as never, {} as never);
      config.onPanResponderRelease?.(tap as never, {} as never);
      config.onPanResponderGrant?.(tap as never, {} as never);
      config.onPanResponderRelease?.(tap as never, {} as never);
    });

    expect(
      screen.container.queryAll((node) => node.props.source?.uri === 'file://photo.jpg'),
    ).toHaveLength(1);
  });

  it('handles pinch and drag gestures without crashing', async () => {
    const createSpy = jest.spyOn(PanResponder, 'create');
    const screen = await renderViewer();
    await act(async () => undefined);
    const backdrops = screen.container.queryAll(
      (node) => typeof node.props.onMoveShouldSetResponder === 'function',
    );
    expect(backdrops).toHaveLength(1);

    const config = createSpy.mock.calls[0][0];
    await act(async () => {
      config.onPanResponderGrant?.(
        { nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] } } as never,
        {} as never,
      );
      // A pinch that starts and then spreads, to walk the zoom branch.
      config.onPanResponderMove?.(
        {
          nativeEvent: {
            touches: [
              { pageX: 0, pageY: 0 },
              { pageX: 10, pageY: 0 },
            ],
          },
        } as never,
        { dx: 0, dy: 0 } as never,
      );
      config.onPanResponderMove?.(
        {
          nativeEvent: {
            touches: [
              { pageX: 0, pageY: 0 },
              { pageX: 60, pageY: 0 },
            ],
          },
        } as never,
        { dx: 0, dy: 0 } as never,
      );
      // A single-finger drag while zoomed in, to walk the pan branch.
      config.onPanResponderMove?.(
        { nativeEvent: { touches: [{ pageX: 0, pageY: 0 }] } } as never,
        { dx: 30, dy: 12 } as never,
      );
      config.onPanResponderTerminate?.({} as never, {} as never);
    });

    expect(
      screen.container.queryAll((node) => node.props.source?.uri === 'file://photo.jpg'),
    ).toHaveLength(1);
  });
});

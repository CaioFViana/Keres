import { emptySketchContent } from '@keres/shared';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useSketchPreviewUri } from '../../src/hooks/useSketchPreviewUri';

const mockEnsure = jest.fn();

jest.mock('../../src/services/storymanagement/SketchPreviewService', () => ({
  __esModule: true,
  sketchPreviewKey: (content: unknown, look: unknown) =>
    `key-${JSON.stringify(content).length}-${JSON.stringify(look).length}`,
  createSketchPreviewService: () => ({
    ensure: (...args: unknown[]) => mockEnsure(...args),
    peek: jest.fn(),
    readBytes: jest.fn(),
  }),
}));

const mockThemeColors = {
  background: '#fff',
  surface: '#f4f4f4',
  text: '#111',
  textSecondary: '#555',
  border: '#ddd',
  primary: '#00f',
};
jest.mock('@/src/theme', () => ({
  __esModule: true,
  // Stable across renders, like the app provider.
  useTheme: () => ({ isDarkMode: false, colors: mockThemeColors }),
}));

const sketch = (name = 'Throne room') => ({
  name,
  content: emptySketchContent('AAAAAAAA', 'Layer 1', { width: 200, height: 200, preset: null }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsure.mockImplementation(async () => ({
    uri: 'file:///preview.png',
    bytes: null,
    cached: false,
  }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('useSketchPreviewUri', () => {
  it('draws the preview under the current theme and shows its address', async () => {
    const { result } = await renderHook(() => useSketchPreviewUri(sketch()));

    await waitFor(() => expect(result.current).toBe('file:///preview.png'));
    const [, , look] = mockEnsure.mock.calls[0];
    expect(look).toEqual({
      colors: {
        background: '#fff',
        surface: '#f4f4f4',
        text: '#111',
        textSecondary: '#555',
        border: '#ddd',
        primary: '#00f',
      },
      paper: '#f4f4f4',
    });
  });

  it('draws again when the theme changes, and stays quiet without a sketch', async () => {
    const { result, rerender } = await renderHook(
      ({ current }: { current: { name: string; content: unknown } | null }) =>
        useSketchPreviewUri(current),
      { initialProps: { current: sketch() } },
    );

    await waitFor(() => expect(result.current).toBe('file:///preview.png'));
    expect(mockEnsure).toHaveBeenCalledTimes(1);

    mockThemeColors.surface = '#000000';
    await rerender({ current: sketch() });
    await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(2));

    mockThemeColors.surface = '#f4f4f4';
    await rerender({ current: null });
    expect(result.current).toBeNull();
  });

  it('shows no preview when the drawing cannot be made', async () => {
    mockEnsure.mockRejectedValueOnce(new Error('no raster host'));

    const { result } = await renderHook(() => useSketchPreviewUri(sketch()));

    await waitFor(() => expect(mockEnsure).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

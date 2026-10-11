import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useScenePages } from '../../src/hooks/useScenePages';

const mockGetPages = jest.fn();
const mockGetSketch = jest.fn();
const mockGetGallery = jest.fn();
const mockPeek = jest.fn();
const mockEnsure = jest.fn();

jest.mock('../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
const mockThemeColors = {
  background: '#fff',
  surface: '#fff',
  text: '#111',
  textSecondary: '#555',
  border: '#ddd',
  primary: '#00f',
};
jest.mock('@/src/theme', () => ({
  __esModule: true,
  // Stable across renders, like the app provider: a fresh object per call would reload forever.
  useTheme: () => ({ isDarkMode: false, colors: mockThemeColors }),
}));
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: () => ({ getById: (...args: unknown[]) => mockGetGallery(...args) }),
}));
jest.mock('../../src/services/storymanagement/ScenePageService', () => ({
  __esModule: true,
  createScenePageService: () => ({
    getPagesForScene: (...args: unknown[]) => mockGetPages(...args),
  }),
}));
jest.mock('../../src/services/storymanagement/SketchService', () => ({
  __esModule: true,
  createSketchService: () => ({ getById: (...args: unknown[]) => mockGetSketch(...args) }),
}));
jest.mock('../../src/services/storymanagement/SketchPreviewService', () => ({
  __esModule: true,
  createSketchPreviewService: () => ({
    peek: (...args: unknown[]) => mockPeek(...args),
    ensure: (...args: unknown[]) => mockEnsure(...args),
  }),
}));

const sketchPage = (id: string, sketchId: string) => ({
  id,
  sceneId: 'scene-1',
  storyId: 'story-1',
  galleryId: null,
  sketchId,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSketch.mockImplementation(async (id: string) => ({
    id,
    name: id,
    isDeleted: false,
    content: { page: { width: 10, height: 10 }, layers: [], overlays: [] },
  }));
  mockPeek.mockResolvedValue(null);
  mockEnsure.mockImplementation(async (name: string) => ({
    uri: `preview://${name}.png`,
    bytes: null,
    cached: false,
  }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('a page drawn as a Sketch', () => {
  it('has its preview drawn again, once each, when the person may edit', async () => {
    mockGetPages.mockResolvedValue([
      sketchPage('p1', 'sk-1'),
      sketchPage('p2', 'sk-1'),
      sketchPage('p3', 'sk-2'),
    ]);

    await renderHook(() => useScenePages('scene-1', 'story-1', { redrawFor: 'user-1' }));

    await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(2));
    expect(mockEnsure.mock.calls.map((call) => call[0])).toEqual(['sk-1', 'sk-2']);
  });

  it('draws nothing into the Gallery when redrawing', async () => {
    mockGetPages.mockResolvedValue([sketchPage('p1', 'sk-1')]);

    await renderHook(() => useScenePages('scene-1', 'story-1', { redrawFor: 'user-1' }));

    await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(1));
    expect(mockGetGallery).not.toHaveBeenCalled();
  });

  it('is left alone for someone who may not edit, and by the places that only count pages', async () => {
    mockGetPages.mockResolvedValue([sketchPage('p1', 'sk-1')]);

    const reader = await renderHook(() => useScenePages('scene-1', 'story-1', { redrawFor: null }));
    const counter = await renderHook(() => useScenePages('scene-1', 'story-1'));

    await waitFor(() => expect(reader.result.current.pages).toHaveLength(1));
    await waitFor(() => expect(counter.result.current.pages).toHaveLength(1));
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('shows the new preview once the drawing was made again', async () => {
    mockGetPages.mockResolvedValue([sketchPage('p1', 'sk-1')]);
    mockPeek.mockResolvedValue('preview://sk-1.png');

    const { result } = await renderHook(() =>
      useScenePages('scene-1', 'story-1', { redrawFor: 'user-1' }),
    );

    await waitFor(() => expect(result.current.pages[0]?.thumbPreviewUri).toBe('preview://sk-1.png'));
    expect(result.current.pages[0]).toMatchObject({ thumbGalleryId: null, isSketch: true });
  });

  it('keeps going when a drawing cannot be made', async () => {
    mockGetPages.mockResolvedValue([sketchPage('p1', 'sk-1'), sketchPage('p2', 'sk-2')]);
    mockEnsure.mockRejectedValueOnce(new Error('svg raster: snapshot produced no bytes'));

    const { result } = await renderHook(() =>
      useScenePages('scene-1', 'story-1', { redrawFor: 'user-1' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toHaveLength(2);
  });
});

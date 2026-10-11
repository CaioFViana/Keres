import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import { useScenePages } from '../../src/hooks/useScenePages';

const mockGetPages = jest.fn();
const mockGetSketch = jest.fn();
const mockEnsure = jest.fn();

jest.mock('../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: () => ({ getById: jest.fn() }),
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
jest.mock('../../src/services/storymanagement/SketchSnapshotService', () => ({
  __esModule: true,
  ensureSketchSnapshot: (...args: unknown[]) => mockEnsure(...args),
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
    coverGalleryId: null,
  }));
  mockEnsure.mockResolvedValue({ galleryId: 'g1', regenerated: false });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('a page drawn as a Sketch', () => {
  it('has its Sketch drawn again, once each, when the person may edit', async () => {
    mockGetPages.mockResolvedValue([
      sketchPage('p1', 'sk-1'),
      sketchPage('p2', 'sk-1'),
      sketchPage('p3', 'sk-2'),
    ]);

    await renderHook(() => useScenePages('scene-1', 'story-1', { redrawFor: 'user-1' }));

    await waitFor(() => expect(mockEnsure).toHaveBeenCalledTimes(2));
    expect(mockEnsure.mock.calls.map((call) => call[2])).toEqual(['sk-1', 'sk-2']);
    expect(mockEnsure.mock.calls[0][1]).toBe('user-1');
  });

  it('is left alone for someone who may not edit, and by the places that only count pages', async () => {
    mockGetPages.mockResolvedValue([sketchPage('p1', 'sk-1')]);

    const reader = await renderHook(() => useScenePages('scene-1', 'story-1', { redrawFor: null }));
    const counter = await renderHook(() => useScenePages('scene-1', 'story-1'));

    await waitFor(() => expect(reader.result.current.pages).toHaveLength(1));
    await waitFor(() => expect(counter.result.current.pages).toHaveLength(1));
    expect(mockEnsure).not.toHaveBeenCalled();
  });

  it('shows the new picture once the drawing was made again', async () => {
    mockGetPages.mockResolvedValue([sketchPage('p1', 'sk-1')]);
    const sketchWith = (coverGalleryId: string | null) => ({
      id: 'sk-1',
      name: 'sk-1',
      isDeleted: false,
      coverGalleryId,
    });
    mockGetSketch.mockResolvedValueOnce(sketchWith(null)).mockResolvedValue(sketchWith('g9'));
    mockEnsure.mockResolvedValue({ galleryId: 'g9', regenerated: true });

    const { result } = await renderHook(() =>
      useScenePages('scene-1', 'story-1', { redrawFor: 'user-1' }),
    );

    await waitFor(() => expect(result.current.pages[0]?.thumbGalleryId).toBe('g9'));
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

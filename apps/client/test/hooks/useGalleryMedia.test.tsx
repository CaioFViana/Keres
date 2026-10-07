import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import {
  useGalleryImages,
  useGalleryRow,
  useScenePageChoices,
} from '../../src/hooks/useGalleryMedia';

const mockGetById = jest.fn();
const mockGetImages = jest.fn();
const mockGetSketches = jest.fn();

jest.mock('../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: () => ({
    getById: (...args: unknown[]) => mockGetById(...args),
    getGalleriesByStoryId: (...args: unknown[]) => mockGetImages(...args),
  }),
}));
jest.mock('../../src/services/storymanagement/SketchService', () => ({
  __esModule: true,
  createSketchService: () => ({
    getSketchesForStory: (...args: unknown[]) => mockGetSketches(...args),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetById.mockResolvedValue({ id: 'g1', isDeleted: false });
  mockGetImages.mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);
  mockGetSketches.mockResolvedValue([{ id: 's1' }]);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => cleanup());
  jest.restoreAllMocks();
});

describe('useGalleryRow', () => {
  it('finds a medium, and nothing for no id', async () => {
    const found = await renderHook(() => useGalleryRow('g1'));
    await waitFor(() => expect(found.result.current).toMatchObject({ id: 'g1' }));

    const none = await renderHook(() => useGalleryRow(null));
    expect(none.result.current).toBeNull();
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });

  it('shows nothing for a deleted medium or a failed read', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'g1', isDeleted: true });
    const deleted = await renderHook(() => useGalleryRow('g1'));
    await act(async () => {});
    expect(deleted.result.current).toBeNull();

    mockGetById.mockRejectedValueOnce(new Error('boom'));
    const failed = await renderHook(() => useGalleryRow('g1'));
    await act(async () => {});
    expect(failed.result.current).toBeNull();
  });

  it('never shows a row kept from another id', async () => {
    const { result, rerender } = await renderHook(
      ({ id }: { id: string | null }) => useGalleryRow(id),
      { initialProps: { id: 'g1' as string | null } },
    );
    await waitFor(() => expect(result.current?.id).toBe('g1'));

    mockGetById.mockResolvedValue({ id: 'g9', isDeleted: false });
    await rerender({ id: 'g9' });
    expect(result.current === null || result.current.id === 'g9').toBe(true);
    await rerender({ id: null });
    expect(result.current).toBeNull();
  });
});

describe('useGalleryImages', () => {
  it('reads the images only once enabled', async () => {
    const { result, rerender } = await renderHook(
      ({ on }: { on: boolean }) => useGalleryImages('story-1', on),
      { initialProps: { on: false } },
    );
    expect(mockGetImages).not.toHaveBeenCalled();

    await rerender({ on: true });
    await waitFor(() => expect(result.current.images).toHaveLength(2));
    expect(mockGetImages).toHaveBeenCalledWith('story-1', { mediaTypes: ['image'] });
    expect(result.current.loading).toBe(false);
  });

  it('comes back empty when the read fails', async () => {
    mockGetImages.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useGalleryImages('story-1', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.images).toEqual([]);
  });
});

describe('useScenePageChoices', () => {
  it('brings the sketches and the images of the story', async () => {
    const { result } = await renderHook(() => useScenePageChoices('story-1', true));

    await waitFor(() => expect(result.current.sketches).toHaveLength(1));
    expect(result.current.images).toHaveLength(2);
  });

  it('reads nothing while closed', async () => {
    await renderHook(() => useScenePageChoices('story-1', false));

    expect(mockGetSketches).not.toHaveBeenCalled();
    expect(mockGetImages).not.toHaveBeenCalled();
  });
});

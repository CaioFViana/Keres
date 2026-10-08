const mockCreateSketch = jest.fn();
const mockPickImages = jest.fn();
const mockImport = jest.fn();
const mockGalleryService = {};
const mockT = (key: string) => key;
const mockTranslation = { t: mockT };

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => mockTranslation,
}));
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../src/services/storymanagement/SketchService', () => ({
  __esModule: true,
  createSketchService: () => ({ createSketch: mockCreateSketch }),
}));
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: () => mockGalleryService,
}));
jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { pickImages: (...args: unknown[]) => mockPickImages(...args) },
}));
jest.mock('../../src/services/galleryMediaImport', () => ({
  __esModule: true,
  importPickedMediaAssets: (...args: unknown[]) => mockImport(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useAddScenePages } from '../../src/hooks/useAddScenePages';

const setup = (overrides: Partial<Parameters<typeof useAddScenePages>[0]> = {}) =>
  renderHook(() =>
    useAddScenePages({
      storyId: 'story-1',
      userId: 'user-1',
      pageFormat: 'comic-us',
      ...overrides,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateSketch.mockResolvedValue({ id: 'sk-1' });
});

describe('useAddScenePages', () => {
  it('draws a blank sketch the shape of the work’s page', async () => {
    const { result } = await setup();

    await expect(result.current.drawNewPage('Standoff · Page 1')).resolves.toBe('sk-1');

    const [, data] = mockCreateSketch.mock.calls[0];
    expect(data).toMatchObject({
      storyId: 'story-1',
      name: 'Standoff · Page 1',
      description: null,
    });
    expect(data.content.page).toMatchObject({
      width: 800,
      height: 1238,
      preset: null,
      background: 'paper',
    });
  });

  it('draws on A5 when the work has not said', async () => {
    const { result } = await setup({ pageFormat: null });

    await result.current.drawNewPage('p');

    expect(mockCreateSketch.mock.calls[0][1].content.page).toMatchObject({
      width: 559,
      height: 794,
    });
  });

  it('keeps a long name inside what a sketch title can be', async () => {
    const { result } = await setup();

    await result.current.drawNewPage('x'.repeat(500));

    expect(mockCreateSketch.mock.calls[0][1].name.length).toBeLessThan(500);
  });

  it('draws nothing without a person', async () => {
    const { result } = await setup({ userId: null });

    await expect(result.current.drawNewPage('p')).resolves.toBeNull();
    expect(mockCreateSketch).not.toHaveBeenCalled();
  });

  it('brings the chosen pictures into the Gallery and hands back their media, in order', async () => {
    const assets = [{ name: 'a.png' }, { name: 'b.png' }];
    mockPickImages.mockResolvedValue(assets);
    mockImport.mockResolvedValue({
      added: 2,
      duplicates: 0,
      rejected: 1,
      galleryIds: ['g1', 'g2'],
    });
    const { result } = await setup();

    await expect(result.current.uploadPictures()).resolves.toEqual({
      galleryIds: ['g1', 'g2'],
      rejected: 1,
      cancelled: false,
    });
    expect(mockImport).toHaveBeenCalledWith(mockGalleryService, 'story-1', 'user-1', assets);
  });

  it('says it was cancelled when the picker is closed, and imports nothing', async () => {
    mockPickImages.mockResolvedValue(null);
    const { result } = await setup();

    await expect(result.current.uploadPictures()).resolves.toEqual({
      galleryIds: [],
      rejected: 0,
      cancelled: true,
    });
    expect(mockImport).not.toHaveBeenCalled();
  });
});

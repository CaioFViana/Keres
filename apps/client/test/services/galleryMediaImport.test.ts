/**
 * @jest-environment node
 */
jest.mock('../../src/services/MediaFileService', () => {
  class MockUnsupportedMediaError extends Error {}
  return {
    mediaFileService: { exists: jest.fn(), importAsset: jest.fn() },
    UnsupportedMediaError: MockUnsupportedMediaError,
  };
});

import { mediaFileService, UnsupportedMediaError } from '../../src/services/MediaFileService';
import { importPickedMediaAssets } from '../../src/services/galleryMediaImport';

const mockMediaFileService = mediaFileService as jest.Mocked<typeof mediaFileService>;

const imported = {
  mediaType: 'image' as const,
  mimeType: 'image/png',
  fileName: 'mapa.png',
  hash: 'hash-new',
  sizeBytes: 10,
  localPath: 'desktop-media:media/story/hash-new.png',
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('creates new media, reuses duplicates, restores a missing local file, and counts rejected assets', async () => {
  const galleryService = {
    getByHash: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'existing-gallery',
      localPath: null,
      thumbnailPath: null,
    }),
    createGallery: jest.fn().mockResolvedValue({ id: 'new-gallery' }),
    setLocalFileState: jest.fn(),
  } as any;
  mockMediaFileService.importAsset
    .mockResolvedValueOnce(imported)
    .mockResolvedValueOnce({ ...imported, hash: 'hash-existing' })
    .mockRejectedValueOnce(new UnsupportedMediaError(undefined, 'unsupported.bin'));
  mockMediaFileService.exists.mockReturnValue(false);

  const result = await importPickedMediaAssets(galleryService, 'story', 'user', [
    {} as any,
    {} as any,
    {} as any,
  ]);

  expect(result).toEqual({
    added: 1,
    duplicates: 1,
    rejected: 1,
    galleryIds: ['new-gallery', 'existing-gallery'],
  });
  expect(galleryService.createGallery).toHaveBeenCalledWith(
    'user',
    expect.objectContaining({ storyId: 'story', hash: 'hash-new' }),
  );
  expect(galleryService.setLocalFileState).toHaveBeenCalledWith('existing-gallery', {
    localPath: imported.localPath,
    downloadState: 'downloaded',
    thumbnailPath: null,
  });
});

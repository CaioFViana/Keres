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
  jest.spyOn(console, 'log').mockImplementation(() => {});
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
  // Even a genuinely unsupported file logs its context: the interface reports every rejection
  // as "unsupported format", so the log is what tells a bad file from a failed import.
  expect(console.log).toHaveBeenCalledWith(
    'Failed to import media asset:',
    expect.objectContaining({ mimeType: null, reason: expect.any(String) }),
  );
  (console.log as jest.Mock).mockRestore();
});

it('logs an unexpected import failure with the asset context and counts it as rejected', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const galleryService = { getByHash: jest.fn(), createGallery: jest.fn() } as any;
  mockMediaFileService.importAsset.mockRejectedValueOnce(new Error('disk gone'));

  const result = await importPickedMediaAssets(galleryService, 'story', 'user', [
    { name: 'clip.mp4', mimeType: 'video/mp4', uri: 'file://picked/clip.mp4', size: 8 } as any,
  ]);

  expect(result).toEqual({ added: 0, duplicates: 0, rejected: 1, galleryIds: [] });
  expect(console.log).toHaveBeenCalledWith('Failed to import media asset:', {
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    uri: 'file://picked/clip.mp4',
    size: 8,
    reason: 'disk gone',
  });
  (console.log as jest.Mock).mockRestore();
});

/**
 * @jest-environment node
 */
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  Directory: class {},
  File: class {},
  Paths: { document: 'file://documents' },
}));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn() }));
jest.mock('expo-video-thumbnails', () => ({ getThumbnailAsync: jest.fn() }));
jest.mock('../../src/services/webMediaStore', () => ({
  DESKTOP_MEDIA_URI_PREFIX: 'desktop-media:',
  deleteDirectory: jest.fn(),
  deleteFile: jest.fn(),
  existsSync: jest.fn(),
  readBytes: jest.fn(),
  writeBytes: jest.fn(),
}));

import { mediaFileService } from '../../src/services/MediaFileService';
import * as webMediaStore from '../../src/services/webMediaStore';

const store = webMediaStore as jest.Mocked<typeof webMediaStore>;

beforeEach(() => {
  jest.clearAllMocks();
  delete (globalThis as { window?: Window }).window;
});

it('uses desktop-media paths and delegates web file operations through the Electron bridge store', async () => {
  store.existsSync.mockReturnValue(true);
  store.readBytes.mockResolvedValue(new Uint8Array([1, 2]));
  store.writeBytes.mockResolvedValue(undefined);
  store.deleteFile.mockResolvedValue(undefined);
  store.deleteDirectory.mockResolvedValue(undefined);

  const mediaPath = mediaFileService.localPathFor('story', 'hash', 'image/png');
  expect(mediaPath).toBe('desktop-media:media/story/hash.png');
  expect(mediaFileService.thumbnailPathFor('story', 'hash')).toBe(
    'desktop-media:media/story/hash_thumb.jpg',
  );
  expect(mediaFileService.exists(mediaPath)).toBe(true);
  await expect(
    mediaFileService.writeDownloaded('story', 'hash', 'image/png', new Uint8Array([3])),
  ).resolves.toBe(mediaPath);
  await expect(mediaFileService.readBytes(mediaPath)).resolves.toEqual(new Uint8Array([1, 2]));
  await expect(mediaFileService.readBytes('file://not-web')).rejects.toThrow(
    'Not a web media path',
  );

  mediaFileService.deleteLocal(mediaPath);
  mediaFileService.deleteStoryMedia('story');
  (globalThis as { window?: Window }).window = { keresMedia: {} } as Window;
  await mediaFileService.deleteAllMedia();
  await Promise.resolve();

  expect(store.writeBytes).toHaveBeenCalledWith('media/story/hash.png', new Uint8Array([3]));
  expect(store.readBytes).toHaveBeenCalledWith('media/story/hash.png');
  expect(store.deleteFile).toHaveBeenCalledWith('media/story/hash.png');
  expect(store.deleteDirectory).toHaveBeenCalledWith('media/story');
  expect(store.deleteDirectory).toHaveBeenCalledWith('media');
});

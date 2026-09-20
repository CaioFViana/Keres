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
jest.mock('expo-video', () => ({ createVideoPlayer: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('../../src/services/webMediaStore', () => ({
  DESKTOP_MEDIA_URI_PREFIX: 'desktop-media:',
  deleteDirectory: jest.fn(),
  deleteFile: jest.fn(),
  existsSync: jest.fn(),
  md5Hex: jest.fn(),
  readBytes: jest.fn(),
  resolveBlobUri: jest.fn(),
  writeBytes: jest.fn(),
}));
// The `<video>` capture itself is covered by webVideoThumbnail.test.ts; here only the wiring.
jest.mock('../../src/services/webVideoThumbnail', () => ({ captureVideoThumbnail: jest.fn() }));

import { ImageManipulator } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';
import { mediaFileService, UnsupportedMediaError } from '../../src/services/MediaFileService';
import * as webMediaStore from '../../src/services/webMediaStore';
import { captureVideoThumbnail } from '../../src/services/webVideoThumbnail';

const store = webMediaStore as jest.Mocked<typeof webMediaStore>;

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  delete (globalThis as { window?: Window }).window;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

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

it('imports a picked blob once, skips the rewrite when the hash is already stored', async () => {
  store.md5Hex.mockReturnValue('web-hash');
  store.existsSync.mockReturnValue(false);
  const file = new File(['hello'], 'map.png', { type: 'image/png' });

  const imported = await mediaFileService.importAsset('story', {
    name: 'map.png',
    uri: 'blob:picked',
    mimeType: 'image/png',
    size: 5,
    file,
  } as any);

  expect(imported).toMatchObject({
    mediaType: 'image',
    mimeType: 'image/png',
    hash: 'web-hash',
    localPath: 'desktop-media:media/story/web-hash.png',
  });
  expect(store.writeBytes).toHaveBeenCalledTimes(1);

  store.existsSync.mockReturnValue(true);
  await mediaFileService.importAsset('story', {
    name: 'map.png',
    uri: 'blob:picked',
    mimeType: 'image/png',
    size: 5,
    file,
  } as any);
  // Same bytes by definition of the addressing: no rewrite.
  expect(store.writeBytes).toHaveBeenCalledTimes(1);
});

it('refuses a web import without blob data or without a recognizable type', async () => {
  store.md5Hex.mockReturnValue('web-hash');

  await expect(
    mediaFileService.importAsset('story', {
      name: 'map.png',
      uri: 'blob:picked',
      mimeType: 'image/png',
    } as any),
  ).rejects.toThrow('No file data available');
  await expect(
    mediaFileService.importAsset('story', {
      name: 'notes.sav',
      uri: 'blob:picked',
      file: new File(['x'], 'notes.sav'),
    } as any),
  ).rejects.toBeInstanceOf(UnsupportedMediaError);
});

it('writes a captured web frame beside the video without touching the native chain', async () => {
  store.md5Hex.mockReturnValue('web-hash');
  store.existsSync.mockReturnValue(false);
  store.resolveBlobUri.mockResolvedValue('blob:video');
  (captureVideoThumbnail as jest.Mock).mockResolvedValue(new Uint8Array([9]));

  const imported = await mediaFileService.importAsset('story', {
    name: 'intro.mp4',
    uri: 'blob:picked',
    mimeType: 'video/mp4',
    file: new File(['x'], 'intro.mp4', { type: 'video/mp4' }),
  } as any);

  expect(imported.thumbnailPath).toBe('desktop-media:media/story/web-hash_thumb.jpg');
  expect(store.resolveBlobUri).toHaveBeenCalledWith('desktop-media:media/story/web-hash.mp4');
  expect(captureVideoThumbnail).toHaveBeenCalledWith('blob:video');
  expect(store.writeBytes).toHaveBeenCalledWith(
    'media/story/web-hash_thumb.jpg',
    new Uint8Array([9]),
  );
  expect(createVideoPlayer).not.toHaveBeenCalled();
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
});

it('leaves web videos without a thumbnail when no frame is captured and logs cleanup failures instead of throwing', async () => {
  store.md5Hex.mockReturnValue('web-hash');
  store.existsSync.mockReturnValue(true);
  store.resolveBlobUri.mockResolvedValue('blob:video');
  (captureVideoThumbnail as jest.Mock).mockResolvedValue(undefined);
  store.deleteFile.mockRejectedValue(new Error('locked'));
  store.deleteDirectory.mockRejectedValue(new Error('locked'));

  const imported = await mediaFileService.importAsset('story', {
    name: 'intro.mp4',
    uri: 'blob:picked',
    mimeType: 'video/mp4',
    file: new File(['x'], 'intro.mp4', { type: 'video/mp4' }),
  } as any);

  expect(imported.thumbnailPath).toBeUndefined();
  expect(store.writeBytes).not.toHaveBeenCalled();
  expect(createVideoPlayer).not.toHaveBeenCalled();
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
  mediaFileService.deleteLocal('desktop-media:media/story/web-hash.mp4');
  mediaFileService.deleteLocal('file://not-web');
  mediaFileService.deleteStoryMedia('story');
  await flush();

  expect(console.warn).toHaveBeenCalledWith(
    'Could not delete local media file:',
    expect.any(String),
    expect.any(Error),
  );
  expect(console.warn).toHaveBeenCalledWith(
    'Could not delete media directory for story:',
    'story',
    expect.any(Error),
  );
});

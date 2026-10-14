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
  md5OfBlob: jest.fn(),
  readBlob: jest.fn(),
  readBytes: jest.fn(),
  resolveBlobUri: jest.fn(),
  writeBlob: jest.fn(),
  writeBytes: jest.fn(),
}));
// The `<video>` capture itself is covered by webVideoThumbnail.test.ts; here only the wiring.
jest.mock('../../src/services/webVideoThumbnail', () => ({ captureVideoThumbnail: jest.fn() }));
// Likewise the picture capture (webImageThumbnail.test.ts); the size rule stays the real one.
jest.mock('../../src/services/webImageThumbnail', () => ({
  ...jest.requireActual('../../src/services/webImageThumbnail'),
  captureImageThumbnail: jest.fn(),
}));

import { ImageManipulator } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';
import { mediaFileService, UnsupportedMediaError } from '../../src/services/MediaFileService';
import * as webMediaStore from '../../src/services/webMediaStore';
import { captureImageThumbnail } from '../../src/services/webImageThumbnail';
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

it('hashes a stored web file for verification, or answers null when unreadable', async () => {
  const stored = new Blob(['ab']);
  store.readBlob.mockResolvedValue(stored);
  store.md5OfBlob.mockResolvedValue('web-hash');

  await expect(mediaFileService.md5OfLocalFile('desktop-media:media/story/hash.png')).resolves.toBe(
    'web-hash',
  );
  expect(store.readBlob).toHaveBeenCalledWith('media/story/hash.png');
  expect(store.md5OfBlob).toHaveBeenCalledWith(stored);
  // Never the whole file in memory.
  expect(store.readBytes).not.toHaveBeenCalled();

  store.readBlob.mockRejectedValueOnce(new Error('gone'));
  await expect(mediaFileService.md5OfLocalFile('desktop-media:media/story/hash.png')).resolves.toBe(
    null,
  );
  await expect(mediaFileService.md5OfLocalFile('file://not-web')).resolves.toBe(null);
});

it('imports a picked blob once, skips the rewrite when the hash is already stored', async () => {
  store.md5OfBlob.mockResolvedValue('web-hash');
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
  // Stored as the Blob that was picked: the bytes never pass through the heap.
  expect(store.writeBlob).toHaveBeenCalledTimes(1);
  expect(store.writeBlob).toHaveBeenCalledWith('media/story/web-hash.png', file);
  expect(store.md5OfBlob).toHaveBeenCalledWith(file);
  expect(store.writeBytes).not.toHaveBeenCalled();

  store.existsSync.mockReturnValue(true);
  await mediaFileService.importAsset('story', {
    name: 'map.png',
    uri: 'blob:picked',
    mimeType: 'image/png',
    size: 5,
    file,
  } as any);
  // Same bytes by definition of the addressing: no rewrite.
  expect(store.writeBlob).toHaveBeenCalledTimes(1);
});

it('refuses a web import without blob data or without a recognizable type', async () => {
  store.md5OfBlob.mockResolvedValue('web-hash');

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
  store.md5OfBlob.mockResolvedValue('web-hash');
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

it('identifies an extensionless web asset from its bytes when the picker says nothing', async () => {
  store.md5OfBlob.mockResolvedValue('sniffed-hash');
  store.existsSync.mockReturnValue(false);

  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const imported = await mediaFileService.importAsset('story', {
    name: 'noext',
    uri: 'blob:picked',
    mimeType: null,
    file: new File([jpegHeader as BlobPart], 'noext'),
  } as any);

  expect(imported).toMatchObject({
    mediaType: 'image',
    mimeType: 'image/jpeg',
    localPath: 'desktop-media:media/story/sniffed-hash.jpg',
  });
});

it('leaves web videos without a thumbnail when no frame is captured and logs cleanup failures instead of throwing', async () => {
  store.md5OfBlob.mockResolvedValue('web-hash');
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
  expect(store.writeBlob).not.toHaveBeenCalled();
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

describe('picture thumbnails on web', () => {
  const big = () => new File([new Uint8Array(300 * 1024)], 'photo.jpg', { type: 'image/jpeg' });

  it('makes a thumbnail beside a big picture when it is imported', async () => {
    store.md5OfBlob.mockResolvedValue('photo-hash');
    store.existsSync.mockReturnValue(false);
    (captureImageThumbnail as jest.Mock).mockResolvedValue(new Uint8Array([7]));
    const file = big();

    const imported = await mediaFileService.importAsset('story', {
      name: 'photo.jpg',
      uri: 'blob:picked',
      mimeType: 'image/jpeg',
      file,
    } as any);

    expect(captureImageThumbnail).toHaveBeenCalledWith(file);
    expect(imported.thumbnailPath).toBe('desktop-media:media/story/photo-hash_thumb.jpg');
    expect(imported.sizeBytes).toBe(file.size);
    expect(store.writeBytes).toHaveBeenCalledWith(
      'media/story/photo-hash_thumb.jpg',
      new Uint8Array([7]),
    );
  });

  it('makes none for a small picture, and the import still succeeds when the browser cannot', async () => {
    store.md5OfBlob.mockResolvedValue('small-hash');
    store.existsSync.mockReturnValue(false);

    const small = await mediaFileService.importAsset('story', {
      name: 'icon.png',
      uri: 'blob:picked',
      mimeType: 'image/png',
      file: new File(['tiny'], 'icon.png', { type: 'image/png' }),
    } as any);
    expect(captureImageThumbnail).not.toHaveBeenCalled();
    expect(small.thumbnailPath).toBeUndefined();

    (captureImageThumbnail as jest.Mock).mockResolvedValue(undefined);
    const unreadable = await mediaFileService.importAsset('story', {
      name: 'photo.jpg',
      uri: 'blob:picked',
      mimeType: 'image/jpeg',
      file: big(),
    } as any);
    expect(unreadable.thumbnailPath).toBeUndefined();
    expect(store.writeBytes).not.toHaveBeenCalled();
  });

  it('backfills the thumbnail of a stored picture, once, and remembers one that needs none', async () => {
    store.existsSync.mockReturnValue(false);
    store.readBlob.mockResolvedValue(new Blob([new Uint8Array(300 * 1024)]));
    (captureImageThumbnail as jest.Mock).mockResolvedValue(new Uint8Array([5]));
    const path = 'desktop-media:media/story/old.jpg';

    await expect(
      mediaFileService.ensureImageThumbnail('story', 'old', path, 'image/jpeg'),
    ).resolves.toBe('desktop-media:media/story/old_thumb.jpg');
    expect(store.writeBytes).toHaveBeenCalledWith('media/story/old_thumb.jpg', new Uint8Array([5]));

    // Already there: answered at once, nothing read.
    store.readBlob.mockClear();
    store.existsSync.mockReturnValue(true);
    await expect(
      mediaFileService.ensureImageThumbnail('story', 'old', path, 'image/jpeg'),
    ).resolves.toBe('desktop-media:media/story/old_thumb.jpg');
    expect(store.readBlob).not.toHaveBeenCalled();

    // A small picture has none to make, and is not looked at again.
    store.existsSync.mockReturnValue(false);
    store.readBlob.mockResolvedValue(new Blob(['tiny']));
    const smallPath = 'desktop-media:media/story/small.png';
    await expect(
      mediaFileService.ensureImageThumbnail('story', 'small', smallPath, 'image/png'),
    ).resolves.toBeUndefined();
    store.readBlob.mockClear();
    await expect(
      mediaFileService.ensureImageThumbnail('story', 'small', smallPath, 'image/png'),
    ).resolves.toBeUndefined();
    expect(store.readBlob).not.toHaveBeenCalled();
  });

  it('makes one thumbnail at a time, so a grid does not hold many full decodes together', async () => {
    store.existsSync.mockReturnValue(false);
    store.readBlob.mockResolvedValue(new Blob([new Uint8Array(300 * 1024)]));
    let running = 0;
    let peak = 0;
    (captureImageThumbnail as jest.Mock).mockImplementation(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await flush();
      running -= 1;
      return new Uint8Array([1]);
    });

    await Promise.all(
      ['a', 'b', 'c', 'd'].map((hash) =>
        mediaFileService.ensureImageThumbnail(
          'story',
          hash,
          `desktop-media:media/story/${hash}.jpg`,
          'image/jpeg',
        ),
      ),
    );

    expect(captureImageThumbnail).toHaveBeenCalledTimes(4);
    expect(peak).toBe(1);
  });

  it('does nothing for a path that is not a web media path, nor off the web', async () => {
    await expect(
      mediaFileService.ensureImageThumbnail('story', 'x', 'file://native/x.jpg', 'image/jpeg'),
    ).resolves.toBeUndefined();
    expect(store.readBlob).not.toHaveBeenCalled();
  });

  it('deletes the thumbnail of a picture with the picture, and only when there is one', async () => {
    store.deleteFile.mockResolvedValue(undefined);
    store.existsSync.mockImplementation((path: string) => path === 'media/story/with_thumb.jpg');

    mediaFileService.deleteLocal('desktop-media:media/story/with.jpg');
    mediaFileService.deleteLocal('desktop-media:media/story/without.jpg');
    await flush();

    expect(store.deleteFile).toHaveBeenCalledWith('media/story/with.jpg');
    expect(store.deleteFile).toHaveBeenCalledWith('media/story/with_thumb.jpg');
    expect(store.deleteFile).toHaveBeenCalledWith('media/story/without.jpg');
    expect(store.deleteFile).not.toHaveBeenCalledWith('media/story/without_thumb.jpg');
  });
});

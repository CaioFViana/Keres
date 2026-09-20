/**
 * @jest-environment node
 */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => {
  type MockFileData = { exists?: boolean; md5?: string; size?: number; bytes?: Uint8Array };
  type MockPathPart = string | { uri: string };
  const files = new Map<string, MockFileData>();
  const directories = new Map<string, boolean>();
  const calls: {
    copied: [string, string][];
    createdFiles: string[];
    written: [string, Uint8Array][];
    deletedFiles: string[];
    deletedDirectories: string[];
  } = {
    copied: [],
    createdFiles: [],
    written: [],
    deletedFiles: [],
    deletedDirectories: [],
  };

  class Directory {
    uri: string;

    constructor(...parts: MockPathPart[]) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .join('/')
        .replace(/([^:]\/)\/+/, '$1');
    }

    get exists() {
      return directories.get(this.uri) === true;
    }

    create() {
      directories.set(this.uri, true);
    }

    delete() {
      calls.deletedDirectories.push(this.uri);
      directories.delete(this.uri);
    }
  }

  class File {
    uri: string;
    name: string;

    constructor(parentOrUri: string | Directory, name?: string) {
      const parentDirectory = parentOrUri as Directory;
      this.uri = name === undefined ? parentOrUri.toString() : `${parentDirectory.uri}/${name}`;
      this.name = this.uri.split('/').pop() ?? '';
    }

    get exists() {
      return files.get(this.uri)?.exists === true;
    }

    get md5() {
      return files.get(this.uri)?.md5;
    }

    get size() {
      return files.get(this.uri)?.size;
    }

    copy(destination: File) {
      calls.copied.push([this.uri, destination.uri]);
      const source = files.get(this.uri) || {};
      files.set(destination.uri, { ...source, exists: true });
    }

    create() {
      calls.createdFiles.push(this.uri);
      files.set(this.uri, { ...(files.get(this.uri) || {}), exists: true });
    }

    write(bytes: Uint8Array) {
      calls.written.push([this.uri, bytes]);
    }

    delete() {
      calls.deletedFiles.push(this.uri);
      files.delete(this.uri);
    }

    bytes() {
      return Promise.resolve(files.get(this.uri)?.bytes || new Uint8Array());
    }
  }

  return {
    Directory,
    File,
    Paths: { document: 'file://documents' },
    __mock: { calls, directories, files },
  };
});
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn() }));
jest.mock('expo-video', () => ({ createVideoPlayer: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ImageManipulator } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';
import { mediaFileService, UnsupportedMediaError } from '../../src/services/MediaFileService';

/** Wires the `createVideoPlayer -> generateThumbnailsAsync -> manipulate -> saveAsync` chain. */
function mockThumbnailChain(frameUri = 'file://cache/frame.jpg') {
  const release = jest.fn();
  const generateThumbnailsAsync = jest.fn().mockResolvedValue([{ requestedTime: 1 }]);
  (createVideoPlayer as jest.Mock).mockReturnValue({ generateThumbnailsAsync, release });
  const saveAsync = jest.fn().mockResolvedValue({ uri: frameUri });
  const renderAsync = jest.fn().mockResolvedValue({ saveAsync });
  (ImageManipulator.manipulate as jest.Mock).mockReturnValue({ renderAsync });
  return { generateThumbnailsAsync, release, renderAsync, saveAsync };
}

const fsMock = (
  FileSystem as unknown as {
    __mock: {
      calls: {
        copied: [string, string][];
        createdFiles: string[];
        written: [string, Uint8Array][];
        deletedFiles: string[];
        deletedDirectories: string[];
      };
      directories: Map<string, boolean>;
      files: Map<string, { exists?: boolean; md5?: string; size?: number; bytes?: Uint8Array }>;
    };
  }
).__mock;

beforeEach(() => {
  jest.clearAllMocks();
  fsMock.files.clear();
  fsMock.directories.clear();
  Object.values(fsMock.calls).forEach((calls) => calls.splice(0));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('MediaFileService on native storage', () => {
  it('imports an image by extension, copies it once, and rejects unsupported content', async () => {
    fsMock.files.set('file://picked/map.png', { exists: true, md5: 'image-hash', size: 40 });

    const imported = await mediaFileService.importAsset('story', {
      name: 'map.png',
      uri: 'file://picked/map.png',
      mimeType: null,
      size: 40,
    } as any);

    expect(imported).toMatchObject({
      mediaType: 'image',
      mimeType: 'image/png',
      hash: 'image-hash',
      localPath: 'file://documents/media/story/image-hash.png',
    });
    expect(fsMock.calls.copied).toEqual([
      ['file://picked/map.png', 'file://documents/media/story/image-hash.png'],
    ]);
    /*
     * An extension the app knows nothing about. This used to be `notes.pdf`, which stopped being a
     * rejection when the gallery started accepting documents - the assertion kept passing for the
     * wrong reason until it did not, because the import got far enough to fail on a missing file
     * and threw a plain `Error` instead.
     */
    await expect(
      mediaFileService.importAsset('story', {
        name: 'notes.sav',
        uri: 'file://picked/notes.sav',
      } as any),
    ).rejects.toBeInstanceOf(UnsupportedMediaError);
  });

  it('imports matroska video by extension with the shared video type', async () => {
    fsMock.files.set('file://picked/clip.mkv', { exists: true, md5: 'mkv-hash', size: 200 });
    mockThumbnailChain();

    const imported = await mediaFileService.importAsset('story', {
      name: 'clip.mkv',
      uri: 'file://picked/clip.mkv',
      mimeType: null,
      size: 200,
    } as any);

    expect(imported).toMatchObject({
      mediaType: 'video',
      mimeType: 'video/x-matroska',
      hash: 'mkv-hash',
      localPath: 'file://documents/media/story/mkv-hash.mkv',
    });
  });

  it('creates a persistent video thumbnail beside the imported file', async () => {
    fsMock.files.set('file://picked/intro.mp4', { exists: true, md5: 'video-hash', size: 100 });
    const chain = mockThumbnailChain();

    const imported = await mediaFileService.importAsset('story', {
      name: 'intro.mp4',
      uri: 'file://picked/intro.mp4',
      mimeType: 'video/mp4',
      size: 100,
    } as any);

    expect(imported.thumbnailPath).toBe('file://documents/media/story/video-hash_thumb.jpg');
    expect(createVideoPlayer).toHaveBeenCalledWith('file://documents/media/story/video-hash.mp4');
    expect(chain.generateThumbnailsAsync).toHaveBeenCalledWith(1, { maxWidth: 480 });
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith({ requestedTime: 1 });
    expect(chain.saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.6 });
    expect(fsMock.calls.copied).toContainEqual([
      'file://cache/frame.jpg',
      'file://documents/media/story/video-hash_thumb.jpg',
    ]);
    expect(chain.release).toHaveBeenCalledTimes(1);
  });

  it('addresses media by content hash and checks presence without throwing', async () => {
    const path = 'file://documents/media/story/image-hash.png';
    fsMock.files.set(path, { exists: true, bytes: new Uint8Array([1]) });

    expect(mediaFileService.localPathFor('story', 'image-hash', 'image/png')).toBe(path);
    expect(mediaFileService.thumbnailPathFor('story', 'image-hash')).toBe(
      'file://documents/media/story/image-hash_thumb.jpg',
    );
    // The same hash from the picker and from the server must land on the same file.
    expect(mediaFileService.destinationFor('story', 'image-hash', 'image/png').uri).toBe(path);

    expect(mediaFileService.exists(path)).toBe(true);
    expect(mediaFileService.exists('file://documents/media/story/absent.png')).toBe(false);
    expect(mediaFileService.exists(null)).toBe(false);
    // A path written by an earlier installation may not even be valid today: absence, not a crash.
    expect(mediaFileService.exists(Object.create(null) as unknown as string)).toBe(false);
    await expect(mediaFileService.readBytes(path)).resolves.toEqual(new Uint8Array([1]));
  });

  it('refuses an asset without a name to guess from and one without a hash', async () => {
    await expect(
      mediaFileService.importAsset('story', { name: '', uri: 'file://picked/nameless' } as any),
    ).rejects.toBeInstanceOf(UnsupportedMediaError);

    fsMock.files.set('file://picked/hashless.png', { exists: true, size: 10 });
    await expect(
      mediaFileService.importAsset('story', {
        name: 'hashless.png',
        uri: 'file://picked/hashless.png',
        mimeType: 'image/png',
      } as any),
    ).rejects.toThrow('Could not compute a content hash');
  });

  it('replaces a stale thumbnail and survives a thumbnail failure', async () => {
    const thumb = 'file://documents/media/story/video-hash_thumb.jpg';
    fsMock.files.set(thumb, { exists: true });
    const chain = mockThumbnailChain();

    await expect(
      mediaFileService.generateVideoThumbnail(
        'story',
        'video-hash',
        'file://documents/media/story/video-hash.mp4',
      ),
    ).resolves.toBe(thumb);
    expect(fsMock.calls.deletedFiles).toContain(thumb);

    chain.generateThumbnailsAsync.mockRejectedValue(new Error('no codec'));
    await expect(
      mediaFileService.generateVideoThumbnail('story', 'video-hash', 'file://picked/intro.mp4'),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      'Could not generate video thumbnail:',
      expect.any(Error),
    );
    // The player is released even when extraction fails, and the import still succeeds.
    expect(chain.release).toHaveBeenCalledTimes(2);
  });

  it('treats an empty thumbnail list as a missing thumbnail without warning', async () => {
    const chain = mockThumbnailChain();
    chain.generateThumbnailsAsync.mockResolvedValue([]);

    await expect(
      mediaFileService.generateVideoThumbnail('story', 'video-hash', 'file://picked/intro.mp4'),
    ).resolves.toBeUndefined();
    expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalledWith(
      'Could not generate video thumbnail:',
      expect.anything(),
    );
    expect(chain.release).toHaveBeenCalledTimes(1);
  });

  it('never lets a filesystem cleanup failure escape', async () => {
    mediaFileService.deleteLocal(null);
    mediaFileService.deleteLocal(Object.create(null) as unknown as string);
    (LegacyFileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));

    await mediaFileService.deleteAllMedia();

    expect(console.warn).toHaveBeenCalledWith(
      'Could not delete local media file:',
      expect.anything(),
      expect.any(Error),
    );
    expect(console.warn).toHaveBeenCalledWith(
      'Could not remove every local media file during app reset:',
      expect.any(Error),
    );
  });

  it('overwrites downloaded bytes and performs all native cleanup operations safely', async () => {
    const path = 'file://documents/media/story/download-hash.mp3';
    fsMock.files.set(path, { exists: true, bytes: new Uint8Array([1, 2]) });
    fsMock.directories.set('file://documents/media/story', true);

    await expect(
      mediaFileService.writeDownloaded('story', 'download-hash', 'audio/mpeg', new Uint8Array([3])),
    ).resolves.toBe(path);
    mediaFileService.deleteLocal(path);
    mediaFileService.deleteStoryMedia('story');
    await mediaFileService.deleteAllMedia();

    expect(fsMock.calls.deletedFiles).toContain(path);
    expect(fsMock.calls.createdFiles).toContain(path);
    expect(fsMock.calls.written).toContainEqual([path, new Uint8Array([3])]);
    expect(fsMock.calls.deletedDirectories).toContain('file://documents/media/story');
    expect(LegacyFileSystem.deleteAsync).toHaveBeenCalledWith('file://documents/media', {
      idempotent: true,
    });
  });
});

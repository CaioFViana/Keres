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
jest.mock('expo-video-thumbnails', () => ({ getThumbnailAsync: jest.fn() }));

import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { mediaFileService, UnsupportedMediaError } from '../../src/services/MediaFileService';

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

  it('creates a persistent video thumbnail beside the imported file', async () => {
    fsMock.files.set('file://picked/intro.mp4', { exists: true, md5: 'video-hash', size: 100 });
    (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValue({
      uri: 'file://cache/frame.jpg',
    });

    const imported = await mediaFileService.importAsset('story', {
      name: 'intro.mp4',
      uri: 'file://picked/intro.mp4',
      mimeType: 'video/mp4',
      size: 100,
    } as any);

    expect(imported.thumbnailPath).toBe('file://documents/media/story/video-hash_thumb.jpg');
    expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith(
      'file://documents/media/story/video-hash.mp4',
      { time: 1000, quality: 0.5 },
    );
    expect(fsMock.calls.copied).toContainEqual([
      'file://cache/frame.jpg',
      'file://documents/media/story/video-hash_thumb.jpg',
    ]);
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

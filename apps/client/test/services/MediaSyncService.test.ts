/**
 * @jest-environment node
 */
/**
 * The factories below build everything internally, without referencing the file's variables.
 *
 * `jest.mock` is hoisted above the `const` declarations, and a factory that *reads* the variable at that
 * moment (`mediaFileService: mockMediaFileService`) captures `undefined`, because the module is required
 * by the import of the file under test before the `const` line runs. Only a factory that defers the
 * read into a function escapes that. The references to the `jest.fn`s are picked up
 * after the imports, through the mocked module itself.
 */
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: jest.fn(),
}));

jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: {
    exists: jest.fn(),
    md5OfLocalFile: jest.fn(),
    localPathFor: jest.fn(),
    destinationFor: jest.fn(),
    thumbnailPathFor: jest.fn(),
    generateVideoThumbnail: jest.fn(),
    readBytes: jest.fn(),
    writeDownloaded: jest.fn(),
    deleteLocal: jest.fn(),
  },
}));

jest.mock('expo-file-system', () => ({
  __esModule: true,
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: '/cache' },
}));

import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { mediaFileService } from '../../src/services/MediaFileService';
import { createMediaSyncService } from '../../src/services/MediaSyncService';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';

const mockGalleryService = {
  getPendingUploads: jest.fn(async () => [] as any[]),
  getPendingDownloads: jest.fn(async () => [] as any[]),
  setLocalFileState: jest.fn(async () => undefined),
  getDeletedMediaWithLocalFiles: jest.fn(async () => [] as any[]),
  getLiveMediaLocalPaths: jest.fn(async () => [] as string[]),
};
(createGalleryService as jest.Mock).mockReturnValue(mockGalleryService);

const mockMediaFileService = mediaFileService as unknown as Record<string, jest.Mock>;
const mockDownloadFileAsync = File.downloadFileAsync as unknown as jest.Mock;

const STORY_ID = 'story-1';
const SERVER = { id: 'server-1', url: 'http://servidor' } as never;
const db = {} as never;

const media = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  hash: `hash-${id}`,
  mimeType: 'image/png',
  mediaType: 'image',
  fileName: `${id}.png`,
  localPath: `/local/${id}.png`,
  thumbnailPath: null,
  ...overrides,
});

/** A fake axios client: it only needs `post`, `get` and the baseURL. */
function fakeClient(overrides: Record<string, any> = {}) {
  return {
    defaults: { baseURL: 'http://servidor/api' },
    post: jest.fn(async () => ({ data: { present: [], missing: [] } })),
    get: jest.fn(async () => ({ data: new ArrayBuffer(3) })),
    ...overrides,
  } as never;
}

const offlineError = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
const originalOS = Platform.OS;

const service = () => createMediaSyncService(db);

beforeEach(() => {
  jest.clearAllMocks();
  (createGalleryService as jest.Mock).mockReturnValue(mockGalleryService);
  mockGalleryService.getPendingUploads.mockResolvedValue([]);
  mockGalleryService.getPendingDownloads.mockResolvedValue([]);
  mockGalleryService.setLocalFileState.mockResolvedValue(undefined);
  mockGalleryService.getDeletedMediaWithLocalFiles.mockResolvedValue([]);
  mockGalleryService.getLiveMediaLocalPaths.mockResolvedValue([]);
  mockMediaFileService.exists.mockReturnValue(false);
  // Paths in this file end with the hash, like the real content addresses.
  mockMediaFileService.md5OfLocalFile.mockImplementation(async (path: string) =>
    path.split('/').pop(),
  );
  mockMediaFileService.localPathFor.mockImplementation(
    (storyId: string, hash: string) => `/media/${storyId}/${hash}`,
  );
  mockMediaFileService.destinationFor.mockImplementation(
    (storyId: string, hash: string) => `/media/${storyId}/${hash}`,
  );
  mockMediaFileService.thumbnailPathFor.mockImplementation(
    (storyId: string, hash: string) => `/media/${storyId}/${hash}.thumb`,
  );
  mockMediaFileService.readBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mockMediaFileService.generateVideoThumbnail.mockResolvedValue('/media/story-1/thumb.jpg');
  mockMediaFileService.writeDownloaded.mockImplementation(
    async (storyId: string, hash: string) => `/media/${storyId}/${hash}`,
  );
  mockDownloadFileAsync.mockImplementation(async (url: string) => ({
    uri: `/media/${String(url).split('/').pop()}`,
  }));
  setPlatform('ios');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  setPlatform(originalOS);
  jest.restoreAllMocks();
});

/**
 * Media reconciliation can never throw: one large video failing must not bring down the
 * text synchronization of a whole story. Media that did not upload stays pending and is
 * retried on the following cycle.
 */
describe('nothing to do', () => {
  it('reports an empty summary when there is no pending media', async () => {
    const summary = await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(summary).toEqual({ uploaded: 0, downloaded: 0, failed: 0, offline: false });
  });

  it('does not ask the server about blobs it has nothing to send', async () => {
    const client = fakeClient();

    await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect((client as any).post).not.toHaveBeenCalled();
  });
});

describe('uploading', () => {
  beforeEach(() => {
    mockMediaFileService.exists.mockReturnValue(true);
  });

  it('asks which hashes the server already has before sending anything', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    const client = fakeClient();

    await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect((client as any).post).toHaveBeenCalledWith(`/media/${STORY_ID}/blobs/status`, {
      hashes: ['hash-a'],
    });
  });

  /** Global deduplication: the same file uploaded by somebody else is already enough. */
  it('marks as uploaded, without sending, what the server already has', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    const client = fakeClient({
      post: jest.fn(async () => ({ data: { present: ['hash-a'], missing: [] } })),
    });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith('a', {
      uploadState: 'uploaded',
    });
    expect(summary.uploaded).toBe(0);
    expect((client as any).post).toHaveBeenCalledTimes(1);
  });

  it('uploads a blob the server is missing and counts it', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    const post = jest
      .fn()
      .mockResolvedValueOnce({ data: { present: [], missing: ['hash-a'] } })
      .mockResolvedValueOnce({ data: {} });
    const client = fakeClient({ post });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(post.mock.calls[1][0]).toBe(`/media/${STORY_ID}/blobs/hash-a`);
    expect(summary.uploaded).toBe(1);
    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith('a', {
      uploadState: 'uploaded',
    });
  });

  /** A record with no file (a system cleanup, a reinstall) becomes a download case. */
  it('turns a missing local file into a download instead of a failure', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockMediaFileService.exists.mockReturnValue(false);
    const client = fakeClient({
      post: jest.fn(async () => ({ data: { present: [], missing: ['hash-a'] } })),
    });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith('a', {
      localPath: null,
      uploadState: 'uploaded',
      downloadState: 'pending',
    });
    expect(summary.failed).toBe(0);
  });

  it('marks a failed upload and carries on with the cycle', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    const post = jest
      .fn()
      .mockResolvedValueOnce({ data: { present: [], missing: ['hash-a'] } })
      .mockRejectedValueOnce(new Error('415 Unsupported'));
    const client = fakeClient({ post });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith('a', {
      uploadState: 'failed',
    });
    expect(summary).toMatchObject({ failed: 1, uploaded: 0, offline: false });
  });

  /** An unreachable server is not the medium's fault: nothing is marked as `failed`. */
  it('reports offline without giving up on the media', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    const post = jest
      .fn()
      .mockResolvedValueOnce({ data: { present: [], missing: ['hash-a'] } })
      .mockRejectedValueOnce(offlineError());
    const client = fakeClient({ post });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(summary.offline).toBe(true);
    expect(summary.failed).toBe(0);
    expect(mockGalleryService.setLocalFileState).not.toHaveBeenCalledWith('a', {
      uploadState: 'failed',
    });
  });

  it('does not try to upload a link because a URL has no blob', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([
      media('link', { mediaType: 'link', mimeType: 'text/uri-list' }),
    ]);
    const client = fakeClient();
    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);
    expect(summary.uploaded).toBe(0);
    expect((client as any).post).not.toHaveBeenCalled();
  });

  it('caps how many blobs it sends in a single cycle', async () => {
    const pending = Array.from({ length: 9 }, (_, index) => media(`m${index}`));
    mockGalleryService.getPendingUploads.mockResolvedValue(pending);
    const post = jest.fn(async (url: string) =>
      url.endsWith('/status')
        ? { data: { present: [], missing: pending.map((m) => m.hash) } }
        : { data: {} },
    );
    const client = fakeClient({ post });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(summary.uploaded).toBe(5);
  });

  it('uploads a genuine Blob on web, where the native file reference does not exist', async () => {
    setPlatform('web');
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockMediaFileService.exists.mockReturnValue(true);
    const post = jest
      .fn()
      .mockResolvedValueOnce({ data: { present: [], missing: ['hash-a'] } })
      .mockResolvedValueOnce({ data: {} });
    const client = fakeClient({ post });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(post.mock.calls[1][0]).toBe(`/media/${STORY_ID}/blobs/hash-a`);
    const form = post.mock.calls[1][1] as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('file')).toBeInstanceOf(Blob);
    expect(summary.uploaded).toBe(1);
  });

  it('skips re-sending an upload the server deterministically refused', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockMediaFileService.exists.mockReturnValue(true);
    const refused = Object.assign(new Error('413'), { response: { status: 413 } });
    const post = jest.fn(async (url: string) => {
      if (url.endsWith('/status')) return { data: { present: [], missing: ['hash-a'] } };
      throw refused;
    });
    const client = fakeClient({ post });
    const sync = service();

    const first = await sync.syncStoryMedia(client, SERVER, STORY_ID);
    expect(first.failed).toBe(1);
    expect(post).toHaveBeenCalledTimes(2); // status + the one doomed send

    post.mockClear();
    mockGalleryService.setLocalFileState.mockClear();
    const second = await sync.syncStoryMedia(client, SERVER, STORY_ID);

    // Skipped before even the status call: the bytes did not move and the verdict cannot change.
    expect(post).not.toHaveBeenCalled();
    expect(mockGalleryService.setLocalFileState).not.toHaveBeenCalled();
    expect(second).toMatchObject({ failed: 0, uploaded: 0 });
  });

  it('gives a deterministically refused upload another attempt once the skip expires', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockMediaFileService.exists.mockReturnValue(true);
    const refused = Object.assign(new Error('415'), { response: { status: 415 } });
    const post = jest.fn(async (url: string) => {
      if (url.endsWith('/status')) return { data: { present: [], missing: ['hash-a'] } };
      throw refused;
    });
    const client = fakeClient({ post });
    const sync = service();
    const sends = () => post.mock.calls.filter(([url]) => !(url as string).endsWith('/status'));

    for (let cycle = 0; cycle < 11; cycle++) {
      await sync.syncStoryMedia(client, SERVER, STORY_ID);
    }

    // Attempted on the 1st cycle, skipped for the next 9, attempted again on the 11th - the
    // server's ceiling may have been raised since, so the skip must never stick forever.
    expect(sends()).toHaveLength(2);
  });

  it('keeps retrying every cycle a failure that may heal', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockMediaFileService.exists.mockReturnValue(true);
    const transient = Object.assign(new Error('500'), { response: { status: 500 } });
    const post = jest.fn(async (url: string) => {
      if (url.endsWith('/status')) return { data: { present: [], missing: ['hash-a'] } };
      throw transient;
    });
    const client = fakeClient({ post });
    const sync = service();

    for (let cycle = 0; cycle < 3; cycle++) {
      await sync.syncStoryMedia(client, SERVER, STORY_ID);
    }

    expect(post.mock.calls.filter(([url]) => !(url as string).endsWith('/status'))).toHaveLength(3);
  });

  it('sends each hash once, even when two entries share the same content', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([
      media('a'),
      media('b', { hash: 'hash-a' }),
    ]);
    const client = fakeClient();

    await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect((client as any).post).toHaveBeenCalledWith(`/media/${STORY_ID}/blobs/status`, {
      hashes: ['hash-a'],
    });
  });
});

describe('downloading', () => {
  it('adopts a file already on disk instead of downloading it again', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);
    mockMediaFileService.exists.mockReturnValue(true);

    const summary = await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
    expect(summary.downloaded).toBe(1);
  });

  it('downloads straight to disk on native, never through the JS heap', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);

    const summary = await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      `http://servidor/api/media/${STORY_ID}/blobs/hash-a`,
      expect.any(String),
      expect.objectContaining({ idempotent: true }),
    );
    expect(summary.downloaded).toBe(1);
  });

  it('records where the file landed', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);

    await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ localPath: '/media/hash-a', downloadState: 'downloaded' }),
    );
  });

  it('goes through axios on web, where there is no download-to-disk', async () => {
    setPlatform('web');
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);
    const client = fakeClient();

    await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect((client as any).get).toHaveBeenCalledWith(
      `/media/${STORY_ID}/blobs/hash-a`,
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
    expect(mockMediaFileService.writeDownloaded).toHaveBeenCalled();
  });

  it('marks a failed download and keeps going', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);
    mockDownloadFileAsync.mockRejectedValueOnce(new Error('404'));

    const summary = await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith('a', {
      downloadState: 'failed',
    });
    expect(summary.failed).toBe(1);
  });

  it('caps how many blobs it fetches in a single cycle', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => media(`m${index}`, { localPath: null })),
    );

    const summary = await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(summary.downloaded).toBe(5);
  });

  it('does nothing when the client has no base URL yet', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);
    const client = fakeClient({ defaults: { baseURL: undefined } });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
    expect(summary.downloaded).toBe(0);
  });

  it('extracts a thumbnail for a downloaded video exactly once', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([
      media('v', { localPath: null, mediaType: 'video', mimeType: 'video/mp4' }),
    ]);

    await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockMediaFileService.generateVideoThumbnail).toHaveBeenCalledWith(
      STORY_ID,
      'hash-v',
      '/media/hash-v',
    );
    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith(
      'v',
      expect.objectContaining({ thumbnailPath: '/media/story-1/thumb.jpg' }),
    );
  });

  it('reuses a thumbnail that already exists instead of extracting it again', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([
      media('v', {
        localPath: null,
        mediaType: 'video',
        mimeType: 'video/mp4',
        thumbnailPath: '/media/old-thumb.jpg',
      }),
    ]);
    // The video bytes are missing but the thumbnail survived: only the thumbnail check passes.
    mockMediaFileService.exists.mockImplementation(
      (path: string) => path === '/media/old-thumb.jpg',
    );

    await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockMediaFileService.generateVideoThumbnail).not.toHaveBeenCalled();
    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith(
      'v',
      expect.objectContaining({ thumbnailPath: '/media/old-thumb.jpg' }),
    );
  });

  it('rejects a download whose bytes do not match the hash', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);
    mockMediaFileService.md5OfLocalFile.mockResolvedValueOnce('not-these-bytes');

    const summary = await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    // Never marked: through the content address, bad bytes would be shared by every
    // same-hash medium. It stays failed and retries on the following cycle.
    expect(mockMediaFileService.deleteLocal).toHaveBeenCalledWith('/media/hash-a');
    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith('a', {
      downloadState: 'failed',
    });
    expect(summary).toMatchObject({ failed: 1, downloaded: 0 });
  });

  it('re-downloads a file on disk whose bytes do not match instead of adopting it', async () => {
    // On Android a failed download leaves a truncated file at the destination; without the
    // check the next cycle would adopt it as complete.
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);
    mockMediaFileService.exists.mockReturnValue(true);
    mockMediaFileService.md5OfLocalFile.mockResolvedValueOnce('truncated-bytes');

    const summary = await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockMediaFileService.deleteLocal).toHaveBeenCalledWith('/media/story-1/hash-a');
    expect(mockDownloadFileAsync).toHaveBeenCalled();
    expect(summary.downloaded).toBe(1);
  });

  it('leaves non-video media without a thumbnail', async () => {
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('a', { localPath: null })]);

    await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockMediaFileService.generateVideoThumbnail).not.toHaveBeenCalled();
    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ thumbnailPath: undefined }),
    );
  });
});

describe('resilience', () => {
  it('never throws, whatever the gallery layer does', async () => {
    mockGalleryService.getPendingUploads.mockRejectedValue(new Error('banco fora'));

    await expect(service().syncStoryMedia(fakeClient(), SERVER, STORY_ID)).resolves.toMatchObject({
      failed: 0,
    });
  });

  it('flags offline when the very first call cannot reach the server', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockMediaFileService.exists.mockReturnValue(true);
    const client = fakeClient({ post: jest.fn().mockRejectedValue(offlineError()) });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(summary.offline).toBe(true);
  });

  it('does not attempt downloads once the server proved unreachable', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockGalleryService.getPendingDownloads.mockResolvedValue([media('b', { localPath: null })]);
    mockMediaFileService.exists.mockReturnValue(true);
    const client = fakeClient({ post: jest.fn().mockRejectedValue(offlineError()) });

    await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
  });
});

describe('collecting files of deleted media', () => {
  it('deletes the files of tombstones and marks them pending again', async () => {
    mockGalleryService.getDeletedMediaWithLocalFiles.mockResolvedValue([
      media('gone', {
        isDeleted: true,
        localPath: '/local/gone.png',
        thumbnailPath: '/local/gone.thumb',
        downloadState: 'downloaded',
      }),
    ]);

    await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockMediaFileService.deleteLocal).toHaveBeenCalledWith('/local/gone.png');
    expect(mockMediaFileService.deleteLocal).toHaveBeenCalledWith('/local/gone.thumb');
    // Clearing the path is not enough: a restore later must re-download, and downloads are
    // driven by `downloadState`, not by the path being null.
    expect(mockGalleryService.setLocalFileState).toHaveBeenCalledWith('gone', {
      localPath: null,
      thumbnailPath: null,
      downloadState: 'pending',
    });
  });

  it('keeps a tombstone file that live media still references', async () => {
    mockGalleryService.getDeletedMediaWithLocalFiles.mockResolvedValue([
      media('gone', { isDeleted: true, localPath: '/local/shared.png' }),
    ]);
    mockGalleryService.getLiveMediaLocalPaths.mockResolvedValue(['/local/shared.png']);

    await service().syncStoryMedia(fakeClient(), SERVER, STORY_ID);

    expect(mockMediaFileService.deleteLocal).not.toHaveBeenCalled();
    expect(mockGalleryService.setLocalFileState).not.toHaveBeenCalledWith(
      'gone',
      expect.anything(),
    );
  });

  it('collects even when the transfers cannot reach the server', async () => {
    mockGalleryService.getPendingUploads.mockResolvedValue([media('a')]);
    mockGalleryService.getDeletedMediaWithLocalFiles.mockResolvedValue([
      media('gone', { isDeleted: true, localPath: '/local/gone.png' }),
    ]);
    mockMediaFileService.exists.mockReturnValue(true);
    const client = fakeClient({ post: jest.fn().mockRejectedValue(offlineError()) });

    const summary = await service().syncStoryMedia(client, SERVER, STORY_ID);

    expect(summary.offline).toBe(true);
    expect(mockMediaFileService.deleteLocal).toHaveBeenCalledWith('/local/gone.png');
  });
});

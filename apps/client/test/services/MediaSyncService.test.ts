/**
 * @jest-environment node
 */
/**
 * Os factories abaixo constroem tudo por dentro, sem referenciar variáveis do arquivo.
 *
 * `jest.mock` é içado acima das declarações `const`, e um factory que *lê* a variável na hora
 * (`mediaFileService: mockMediaFileService`) captura `undefined`, porque o módulo é requerido
 * pelo import do arquivo sob teste antes de a linha do `const` rodar. Só um factory que adia a
 * leitura para dentro de uma função escapa disso. As referências aos `jest.fn` são pegas
 * depois dos imports, através do próprio módulo mockado.
 */
jest.mock('../../src/services/storymanagement/GalleryService', () => ({
  __esModule: true,
  createGalleryService: jest.fn(),
}));

jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: {
    exists: jest.fn(),
    localPathFor: jest.fn(),
    destinationFor: jest.fn(),
    thumbnailPathFor: jest.fn(),
    readBytes: jest.fn(),
    writeDownloaded: jest.fn(),
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

/** Cliente axios falso: só precisa de `post`, `get` e a baseURL. */
function fakeClient(overrides: Record<string, any> = {}) {
  return {
    defaults: { baseURL: 'http://servidor' },
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
  mockMediaFileService.exists.mockReturnValue(false);
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
  mockMediaFileService.writeDownloaded.mockImplementation(
    async (storyId: string, hash: string) => `/media/${storyId}/${hash}`,
  );
  mockDownloadFileAsync.mockResolvedValue({ uri: '/media/baixado' });
  setPlatform('ios');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  setPlatform(originalOS);
  jest.restoreAllMocks();
});

/**
 * A reconciliação de mídia nunca pode lançar: um vídeo grande falhando não pode derrubar a
 * sincronização de texto da história inteira. Mídia que não subiu continua pendente e é
 * tentada no ciclo seguinte.
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

  /** Deduplicação global: o mesmo arquivo subido por outra pessoa já basta. */
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

  /** Registro sem arquivo (limpeza do sistema, reinstalação) vira caso de download. */
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

  /** Servidor inalcançável não é falha da mídia: nada é marcado como `failed`. */
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
      `http://servidor/media/${STORY_ID}/blobs/hash-a`,
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
      expect.objectContaining({ localPath: '/media/baixado', downloadState: 'downloaded' }),
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

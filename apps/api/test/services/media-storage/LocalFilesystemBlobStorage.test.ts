import { access, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalFilesystemBlobStorage } from '../../../src/services/media-storage/LocalFilesystemBlobStorage';

const temporaryDirectories: string[] = [];

beforeAll(() => {
  // Vitest runs in Node; production runs the API under Bun. This minimal adapter preserves the file
  // contract the local backend uses without needing an HTTP server.
  vi.stubGlobal('Bun', {
    write: (filePath: string, bytes: ArrayBuffer) => writeFile(filePath, new Uint8Array(bytes)),
    file: (filePath: string) => ({
      exists: async () =>
        access(filePath)
          .then(() => true)
          .catch(() => false),
      text: async () => readFile(filePath, 'utf8'),
    }),
  });
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('LocalFilesystemBlobStorage', () => {
  it('only exposes a blob after moving it from the temporary directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    const key = 'ab/abcdef0123456789abcdef0123456789';
    const bytes = new TextEncoder().encode('gallery content').buffer;

    await storage.put(key, bytes, 'text/plain');

    expect(await storage.has(key)).toBe(true);
    expect(await Bun.file(path.join(root, key)).text()).toBe('gallery content');
    expect(await Bun.file(path.join(root, 'tmp')).exists()).toBe(true);
  });

  it('treats a repeated content-addressed write as a success', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    const key = 'ab/abcdef0123456789abcdef0123456789';

    await storage.put(key, new TextEncoder().encode('first').buffer, 'text/plain');
    await storage.put(key, new TextEncoder().encode('second').buffer, 'text/plain');

    expect(await Bun.file(path.join(root, key)).text()).toBe('first');
  });

  it('rejects keys that could escape the configured storage root', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);

    await expect(storage.has('../outside')).rejects.toThrow('Invalid media storage key');
  });

  it('cleans abandoned temporary uploads without touching finalized blobs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    const key = 'ab/abcdef0123456789abcdef0123456789';
    await storage.put(key, new TextEncoder().encode('final').buffer, 'text/plain');
    const abandonedPath = path.join(root, 'tmp', 'abandoned.part');
    await writeFile(abandonedPath, 'incomplete');
    await utimes(abandonedPath, new Date(0), new Date(0));

    expect(await storage.cleanupTemporaryFiles!(0)).toBe(1);
    expect(await storage.has(key)).toBe(true);
    expect(await Bun.file(path.join(root, 'tmp', 'abandoned.part')).exists()).toBe(false);
  });

  it('lets two identical uploads race without either failing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    const key = 'ab/abcdef0123456789abcdef0123456789';
    const bytes = new TextEncoder().encode('same bytes').buffer;

    await expect(
      Promise.all([storage.put(key, bytes, 'text/plain'), storage.put(key, bytes, 'text/plain')]),
    ).resolves.toHaveLength(2);

    expect(await storage.has(key)).toBe(true);
  });

  it('propagates a delete failure that is not a missing file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    await storage.put(
      'sub/filler',
      new TextEncoder().encode('keeps the directory').buffer,
      'text/plain',
    );

    await expect(storage.delete('sub')).rejects.toThrow();
    expect(await storage.has('sub/filler')).toBe(true);
  });

  it('reports zero cleanups when no temporary directory exists yet', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);

    await expect(storage.cleanupTemporaryFiles(0)).resolves.toBe(0);
  });

  it('propagates a cleanup failure that is not a missing directory', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    await writeFile(path.join(root, 'tmp'), 'not a directory');

    await expect(storage.cleanupTemporaryFiles(0)).rejects.toThrow();
  });

  it('skips subdirectories and fresh uploads while cleaning', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    await storage.put('ab/blob', new TextEncoder().encode('final').buffer, 'text/plain');
    await mkdir(path.join(root, 'tmp', 'nested'));
    const freshPath = path.join(root, 'tmp', 'fresh.part');
    await writeFile(freshPath, 'in flight');
    const oldPath = path.join(root, 'tmp', 'old.part');
    await writeFile(oldPath, 'abandoned');
    await utimes(oldPath, new Date(0), new Date(0));

    expect(await storage.cleanupTemporaryFiles(60_000)).toBe(1);
    expect(await Bun.file(freshPath).exists()).toBe(true);
    expect(await Bun.file(path.join(root, 'tmp', 'nested')).exists()).toBe(true);
    expect(await Bun.file(oldPath).exists()).toBe(false);
  });
});

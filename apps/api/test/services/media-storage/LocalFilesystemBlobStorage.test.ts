import { access, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
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
});

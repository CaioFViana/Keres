import { access, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LocalFilesystemBlobStorage } from '../../../src/services/media-storage/LocalFilesystemBlobStorage';

const temporaryDirectories: string[] = [];

beforeAll(() => {
  vi.stubGlobal('Bun', {
    write: (filePath: string, bytes: ArrayBuffer) => writeFile(filePath, new Uint8Array(bytes)),
    file: (filePath: string) => ({
      exists: async () => access(filePath).then(() => true).catch(() => false),
      arrayBuffer: async () => {
        const bytes = await readFile(filePath);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      },
    }),
  });
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('LocalFilesystemBlobStorage integration', () => {
  it('stores, reads, deletes, and safely ignores a missing finalized blob', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-integration-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    const key = 'ab/abcdef0123456789abcdef0123456789';
    const bytes = new TextEncoder().encode('gallery content').buffer;

    expect(await storage.has(key)).toBe(false);
    await storage.put(key, bytes, 'text/plain');
    expect(await storage.has(key)).toBe(true);
    expect(await (await storage.get(key))?.arrayBuffer()).toEqual(bytes);
    await storage.delete(key);
    await storage.delete(key);
    expect(await storage.get(key)).toBeNull();
  });

  it('keeps an existing content-addressed blob and cleans only stale temporary uploads', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-integration-'));
    temporaryDirectories.push(root);
    const storage = new LocalFilesystemBlobStorage(root);
    const key = 'ab/abcdef0123456789abcdef0123456789';
    await storage.put(key, new TextEncoder().encode('first').buffer, 'text/plain');
    await storage.put(key, new TextEncoder().encode('second').buffer, 'text/plain');
    const abandonedPath = path.join(root, 'tmp', 'abandoned.part');
    await writeFile(abandonedPath, 'incomplete');
    await utimes(abandonedPath, new Date(0), new Date(0));

    expect(await storage.cleanupTemporaryFiles!(0)).toBe(1);
    expect(new TextDecoder().decode(await (await storage.get(key))?.arrayBuffer())).toBe('first');
    expect(await storage.cleanupTemporaryFiles!(0)).toBe(0);
  });

  it('rejects traversal keys before accessing disk', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'keres-media-integration-'));
    temporaryDirectories.push(root);
    await expect(new LocalFilesystemBlobStorage(root).has('../outside')).rejects.toThrow('Invalid media storage key');
  });
});

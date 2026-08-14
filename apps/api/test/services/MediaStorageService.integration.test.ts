import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { db } from '../../src/db';
import { galleries, mediaBlobs, stories, users } from '../../src/db/schema';
import { MediaStorageService } from '../../src/services/MediaStorageService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

const hash = (letter: string) => letter.repeat(32);

beforeEach(truncateAll);

beforeEach(() => {
  vi.stubGlobal('Bun', {
    CryptoHasher: class {
      private readonly hash = createHash('md5');

      update(bytes: ArrayBuffer) {
        this.hash.update(new Uint8Array(bytes));
        return this;
      }

      digest(encoding: 'hex') {
        return this.hash.digest(encoding);
      }
    },
  });
});

describe('MediaStorageService integration', () => {
  it('records a verified hash before delegating the immutable bytes to storage', async () => {
    const bytes = new TextEncoder().encode('gallery content').buffer;
    const expectedHash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    const storage = { has: vi.fn(), put: vi.fn(), get: vi.fn(), delete: vi.fn() };
    const service = new MediaStorageService(storage as any);

    await expect(service.store(expectedHash, 'text/plain', bytes)).resolves.toEqual({
      hash: expectedHash,
      sizeBytes: bytes.byteLength,
    });
    expect(storage.put).toHaveBeenCalledWith(
      `${expectedHash.slice(0, 2)}/${expectedHash}`,
      bytes,
      'text/plain',
    );
    expect(
      await db.query.mediaBlobs.findFirst({
        where: (fields, { eq }) => eq(fields.hash, expectedHash),
      }),
    ).toMatchObject({ mimeType: 'text/plain', sizeBytes: bytes.byteLength });
    await expect(service.store(hash('a'), 'text/plain', bytes)).rejects.toThrow(
      /Media hash mismatch/i,
    );
  });

  it('reports present blobs in batches and returns typed content only for registered storage', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const storage = {
      has: vi.fn(async (key: string) => key === 'aa/a'.replace('a', hash('a').slice(0, 2))),
      put: vi.fn(),
      get: vi.fn(async () => new Blob([bytes], { type: 'image/png' })),
      delete: vi.fn(),
    };
    const presentHash = hash('a');
    const missingHash = hash('b');
    await db.insert(mediaBlobs).values({
      hash: presentHash,
      mimeType: 'image/png',
      sizeBytes: 3,
      storagePath: `${presentHash.slice(0, 2)}/${presentHash}`,
      createdAt: new Date(),
    });
    await db.insert(mediaBlobs).values({
      hash: missingHash,
      mimeType: 'image/png',
      sizeBytes: 4,
      storagePath: `${missingHash.slice(0, 2)}/${missingHash}`,
      createdAt: new Date(),
    });
    storage.has.mockImplementation(async (key: string) => key.startsWith('aa/'));
    const service = new MediaStorageService(storage as any);

    expect(await service.filterPresent([presentHash, missingHash, hash('c')])).toEqual({
      present: [presentHash],
      missing: [missingHash, hash('c')],
    });
    expect(await service.read(presentHash)).toMatchObject({ mimeType: 'image/png', sizeBytes: 3 });
    expect(await service.read(hash('c'))).toBeNull();
  });

  it('keeps referenced blobs and deletes metadata plus bytes once no live gallery references remain', async () => {
    const userId = newId();
    const storyId = newId();
    const referencedHash = hash('d');
    const orphanHash = hash('e');
    const storage = {
      has: vi.fn(),
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      cleanupTemporaryFiles: vi.fn(async () => 2),
    };
    await db
      .insert(users)
      .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
    await db.insert(stories).values({
      id: storyId,
      userId,
      title: 'A Queda',
      type: 'linear',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
    } as never);
    await db.insert(mediaBlobs).values([
      {
        hash: referencedHash,
        mimeType: 'image/png',
        sizeBytes: 1,
        storagePath: `dd/${referencedHash}`,
        createdAt: new Date(),
      },
      {
        hash: orphanHash,
        mimeType: 'image/png',
        sizeBytes: 1,
        storagePath: `ee/${orphanHash}`,
        createdAt: new Date(),
      },
    ]);
    await db.insert(galleries).values({
      id: newId(),
      storyId,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'kept.png',
      hash: referencedHash,
      sizeBytes: 1,
      title: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
    } as never);
    const service = new MediaStorageService(storage as any);

    await service.deleteBlobIfUnreferenced(referencedHash);
    await service.deleteBlobIfUnreferenced(orphanHash);
    await service.deleteBlobIfUnreferenced(hash('f'));
    expect(storage.delete).toHaveBeenCalledWith(`ee/${orphanHash}`);
    expect(
      await db.query.mediaBlobs.findFirst({
        where: (fields, { eq }) => eq(fields.hash, referencedHash),
      }),
    ).toBeTruthy();
    expect(
      await db.query.mediaBlobs.findFirst({
        where: (fields, { eq }) => eq(fields.hash, orphanHash),
      }),
    ).toBeUndefined();
    expect(await service.cleanupTemporaryFiles()).toBe(2);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { db } from '../../src/db';
import { galleries, mediaBlobs, stories, users } from '../../src/db/schema';
import {
  MEDIA_BLOB_GRACE_PERIOD_MS,
  MediaHashMismatchError,
  MediaStorageService,
} from '../../src/services/MediaStorageService';
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
    // The type is the contract the upload route maps to 400; any other failure must stay a 500.
    await expect(service.store(hash('a'), 'text/plain', bytes)).rejects.toThrow(
      MediaHashMismatchError,
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

  it('keeps referenced blobs and stamps (not deletes) newly orphaned ones', async () => {
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
    // Nothing is deleted yet: the orphan only earns its grace stamp, and the bytes stay until
    // the stamp expires without a resurrection.
    expect(storage.delete).not.toHaveBeenCalled();
    expect(
      await db.query.mediaBlobs.findFirst({
        where: (fields, { eq }) => eq(fields.hash, referencedHash),
      }),
    ).toMatchObject({ unreferencedSince: null });
    expect(
      await db.query.mediaBlobs.findFirst({
        where: (fields, { eq }) => eq(fields.hash, orphanHash),
      }),
    ).toMatchObject({ unreferencedSince: expect.any(Date) });
    expect(await service.cleanupTemporaryFiles()).toBe(2);
  });

  it('reaps only expired orphans, and a re-reference clears the stamp first', async () => {
    const userId = newId();
    const storyId = newId();
    const expiredHash = hash('g');
    const freshHash = hash('h');
    const resurrectedHash = hash('i');
    const storage = { has: vi.fn(), put: vi.fn(), get: vi.fn(), delete: vi.fn() };
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
    const oldStamp = new Date(Date.now() - MEDIA_BLOB_GRACE_PERIOD_MS - 1_000);
    await db.insert(mediaBlobs).values([
      {
        hash: expiredHash,
        mimeType: 'image/png',
        sizeBytes: 1,
        storagePath: `gg/${expiredHash}`,
        createdAt: new Date(),
        unreferencedSince: oldStamp,
      },
      {
        hash: freshHash,
        mimeType: 'image/png',
        sizeBytes: 1,
        storagePath: `hh/${freshHash}`,
        createdAt: new Date(),
        unreferencedSince: new Date(),
      },
      {
        hash: resurrectedHash,
        mimeType: 'image/png',
        sizeBytes: 1,
        storagePath: `ii/${resurrectedHash}`,
        createdAt: new Date(),
        unreferencedSince: oldStamp,
      },
    ]);
    await db.insert(galleries).values({
      id: newId(),
      storyId,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: 'back.png',
      hash: resurrectedHash,
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

    const examined = await service.sweepExpiredUnreferencedBlobs();

    // The expired orphan is gone, bytes and record; the fresh one keeps waiting out its grace;
    // the re-referenced one survived the sweep with a cleared stamp.
    expect(examined).toBe(2);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith(`gg/${expiredHash}`);
    const byHash = async (wanted: string) =>
      db.query.mediaBlobs.findFirst({ where: (fields, { eq }) => eq(fields.hash, wanted) });
    expect(await byHash(expiredHash)).toBeUndefined();
    expect(await byHash(freshHash)).toMatchObject({ unreferencedSince: expect.any(Date) });
    expect(await byHash(resurrectedHash)).toMatchObject({ unreferencedSince: null });
  });

  it('reports zero cleanups on a backend with no temporary files', async () => {
    const service = new MediaStorageService({
      has: vi.fn(),
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    } as any);

    await expect(service.cleanupTemporaryFiles()).resolves.toBe(0);
  });
});

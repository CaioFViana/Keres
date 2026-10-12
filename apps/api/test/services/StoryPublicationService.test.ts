import { MAX_MANUSCRIPT_BYTES } from '@keres/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TierLimitExceededError } from '../../src/services/TierEnforcementService';
import { StoryPublicationService } from '../../src/services/StoryPublicationService';
import { AppError } from '../../src/utils/errors';

const storeFns = vi.hoisted(() => ({
  store: vi.fn(async (_storyId: string, _publicationId: string, _bytes: Uint8Array) => {}),
  storeManuscript: vi.fn(
    async (_storyId: string, _publicationId: string, _bytes: Uint8Array, _format: string) => {},
  ),
  storeReader: vi.fn(async (_storyId: string, _publicationId: string, _bytes: Uint8Array) => {}),
  delete: vi.fn(async (_storyId: string, _publicationId: string) => {}),
  deleteManuscript: vi.fn(
    async (_storyId: string, _publicationId: string, _extension: string) => {},
  ),
  deleteReader: vi.fn(async (_storyId: string, _publicationId: string) => {}),
}));
const tierFns = vi.hoisted(() => ({
  assertCanPublish: vi.fn(async (_userId: string) => {}),
  assertCanUploadMedia: vi.fn(async (_userId: string, _storyId: string, _bytes: number) => {}),
  recordPublication: vi.fn(async (_tx: unknown, _userId: string, _storyId: string) => {}),
  // The service reads only the retention ceiling off the tier.
  getEffectiveTier: vi.fn(
    async (_userId: string): Promise<{ maxPublicationsPerStory: number | null } | null> => null,
  ),
}));
const compileFns = vi.hoisted(() => ({
  compileManuscript: vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    format: 'md' as const,
  })),
  compileReader: vi.fn(() => ({ bytes: new Uint8Array([4, 5]) })),
}));
interface ExistingPublicationRow {
  id: string;
  arcId: string | null;
  manuscriptFormat: string | null;
  readerByteSize: number | null;
}

const dbState = vi.hoisted(() => ({
  failTransaction: false,
  inserts: [] as unknown[],
  existingPublications: [] as ExistingPublicationRow[],
}));

vi.mock('../../src/services/PublicationStorageService', () => ({
  publicationStorageService: { ...storeFns },
}));
vi.mock('../../src/services/TierEnforcementService', () => ({
  tierEnforcementService: { ...tierFns },
  TierLimitExceededError: class TierLimitExceededError extends Error {},
}));
// Compiling a book is its own module's business; the rest of it (option parsing) stays real.
vi.mock('../../src/services/publicationCompile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/publicationCompile')>()),
  ...compileFns,
  ownerHandleOf: async () => '@ana',
}));
// The showcase on/off gate still exists in the service; only the reverted
// compile-mode flag is gone, so the mock keeps just `isEnabled`.
vi.mock('../../src/services/ShowcaseSettingsService', () => ({
  showcaseSettingsService: { isEnabled: async () => true },
}));
vi.mock('../../src/services/MediaStorageService', () => ({
  mediaStorageService: { read: async () => null },
}));
vi.mock('../../src/modules/webSocket/webSocket.route', () => ({
  emitUserEvent: () => {},
}));
vi.mock('../../src/db', () => {
  // `where(...)` is awaited directly in one query and extended with `.orderBy(...)` in another, so it
  // resolves to the rows while still carrying the chain. The trim query reads staged rows.
  const where = () =>
    Object.assign(Promise.resolve([]), {
      orderBy: () => Promise.resolve(dbState.existingPublications),
    });
  const tx = {
    select: () => ({ from: () => ({ where }) }),
    insert: () => ({
      values: (rows: unknown) => {
        dbState.inserts.push(rows);
        return { onConflictDoUpdate: () => Promise.resolve() };
      },
    }),
    delete: () => ({ where: () => Promise.resolve() }),
  };
  return {
    db: {
      query: {
        stories: {
          findFirst: () =>
            Promise.resolve({
              id: 'story-1',
              userId: 'user-1',
              isDeleted: false,
              lastOperationVersion: 7,
              title: 'Title',
              description: 'Description',
              genre: 'Genre',
              language: 'pt',
              author: 'Author',
              type: 'linear',
              theme: 'dark',
            }),
        },
        storyPublications: { findFirst: () => Promise.resolve({ id: 'pub-row' }) },
      },
      select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
      transaction: (work: (tx: unknown) => unknown) => {
        if (dbState.failTransaction) return Promise.reject(new Error('tx failed'));
        return Promise.resolve(work(tx));
      },
    },
  };
});

const STORY_EXPORT = {
  story: { id: 'story-1' },
  storyArcs: [],
  galleryItems: [],
};

function makeService() {
  return new StoryPublicationService({
    exportStory: async () => STORY_EXPORT,
  } as never);
}

function publishAll(service: StoryPublicationService) {
  return service.publish('user-1', 'story-1', 7, 'both', 'public', undefined, { format: 'md' }, {});
}

beforeEach(() => {
  dbState.failTransaction = false;
  dbState.inserts.length = 0;
  dbState.existingPublications.length = 0;
  for (const fn of [...Object.values(storeFns), ...Object.values(tierFns), ...Object.values(compileFns)]) {
    fn.mockClear();
  }
  tierFns.getEffectiveTier.mockResolvedValue(null);
});

describe('StoryPublicationService staged-release', () => {
  it('writes the row with the staged blobs sizes after releasing them', async () => {
    const publication = await publishAll(makeService());

    expect(publication).toEqual({ id: 'pub-row' });
    expect(storeFns.store).toHaveBeenCalledTimes(1);
    expect(storeFns.storeManuscript).toHaveBeenCalledTimes(1);
    expect(storeFns.storeReader).toHaveBeenCalledTimes(1);

    const publicationId = storeFns.store.mock.calls[0][1];
    expect(storeFns.storeManuscript.mock.calls[0].slice(0, 2)).toEqual(['story-1', publicationId]);
    expect(storeFns.storeManuscript.mock.calls[0][3]).toBe('md');
    expect(storeFns.storeReader.mock.calls[0].slice(0, 2)).toEqual(['story-1', publicationId]);

    const row = dbState.inserts.find(
      (insert): insert is Record<string, unknown> =>
        typeof insert === 'object' && insert !== null && 'snapshot' in insert,
    );
    expect(row).toBeDefined();
    const storedZip = storeFns.store.mock.calls[0][2] as Uint8Array;
    expect(row).toMatchObject({
      byteSize: storedZip.byteLength,
      packageIncluded: true,
      mediaIncluded: 0,
      mediaTotal: 0,
      readerByteSize: 2,
      manuscriptFormat: 'md',
      manuscriptByteSize: 3,
    });
  });

  it('still removes every staged blob when the transaction fails after the release', async () => {
    dbState.failTransaction = true;

    await expect(publishAll(makeService())).rejects.toThrow('tx failed');

    const publicationId = storeFns.store.mock.calls[0][1];
    expect(storeFns.delete).toHaveBeenCalledWith('story-1', publicationId);
    expect(storeFns.deleteManuscript).toHaveBeenCalledWith('story-1', publicationId, 'md');
    expect(storeFns.deleteReader).toHaveBeenCalledWith('story-1', publicationId);
  });
});

describe('StoryPublicationService client-compiled uploads', () => {
  const manuscriptBytes = () => new TextEncoder().encode('# The Book\n\nFiled body.\n');
  const readerBytes = () =>
    new TextEncoder().encode('<!DOCTYPE html><html><head></head><body>Hi</body></html>');

  function publishUploaded(service: StoryPublicationService, uploaded: unknown) {
    return service.publish(
      'user-1',
      'story-1',
      7,
      'both',
      'public',
      undefined,
      { format: 'md' },
      {},
      true,
      undefined,
      uploaded as never,
    );
  }

  async function statusOf(promise: Promise<unknown>): Promise<number> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      return (error as AppError).status;
    }
    throw new Error('Expected the publish to fail.');
  }

  function storedRow() {
    return dbState.inserts.find(
      (insert): insert is Record<string, unknown> =>
        typeof insert === 'object' && insert !== null && 'snapshot' in insert,
    );
  }

  it('stores uploaded bytes as-is without compiling either artifact', async () => {
    const manuscript = manuscriptBytes();
    const reader = readerBytes();

    const publication = await publishUploaded(makeService(), {
      manuscript: { bytes: manuscript, filename: 'book.md', mimeType: 'text/markdown' },
      reader: { bytes: reader, filename: 'reader.html', mimeType: 'text/html' },
    });

    expect(publication).toEqual({ id: 'pub-row' });
    expect(compileFns.compileManuscript).not.toHaveBeenCalled();
    expect(compileFns.compileReader).not.toHaveBeenCalled();
    expect(storeFns.storeManuscript.mock.calls[0][2]).toEqual(manuscript);
    expect(storeFns.storeManuscript.mock.calls[0][3]).toBe('md');
    expect(storeFns.storeReader.mock.calls[0][2]).toEqual(reader);
    expect(storedRow()).toMatchObject({
      manuscriptFormat: 'md',
      manuscriptByteSize: manuscript.byteLength,
      readerByteSize: reader.byteLength,
    });
    // Publication artifacts never count against the gallery/storage ceilings.
    expect(tierFns.assertCanUploadMedia).not.toHaveBeenCalled();
  });

  it('mixes an uploaded manuscript with a server-compiled reader', async () => {
    const manuscript = manuscriptBytes();

    await publishUploaded(makeService(), {
      manuscript: { bytes: manuscript, filename: 'book.md', mimeType: 'text/markdown' },
    });

    expect(compileFns.compileManuscript).not.toHaveBeenCalled();
    expect(compileFns.compileReader).toHaveBeenCalledTimes(1);
    expect(storeFns.storeManuscript.mock.calls[0][2]).toEqual(manuscript);
    // The reader mock's two bytes, compiled on the server from the options.
    expect(storeFns.storeReader.mock.calls[0][2]).toEqual(new Uint8Array([4, 5]));
    expect(storedRow()).toMatchObject({
      manuscriptByteSize: manuscript.byteLength,
      readerByteSize: 2,
    });
    expect(tierFns.assertCanUploadMedia).not.toHaveBeenCalled();
  });

  it('refuses an upload without its options before storing anything', async () => {
    const manuscriptStatus = await statusOf(
      makeService().publish(
        'user-1',
        'story-1',
        7,
        'both',
        'public',
        undefined,
        undefined,
        {},
        true,
        undefined,
        { manuscript: { bytes: manuscriptBytes(), filename: 'book.md' } },
      ),
    );
    expect(manuscriptStatus).toBe(400);

    const readerStatus = await statusOf(
      makeService().publish(
        'user-1',
        'story-1',
        7,
        'both',
        'public',
        undefined,
        { format: 'md' },
        undefined,
        true,
        undefined,
        { reader: { bytes: readerBytes(), filename: 'reader.html' } },
      ),
    );
    expect(readerStatus).toBe(400);

    expect(storeFns.store).not.toHaveBeenCalled();
    expect(storeFns.storeManuscript).not.toHaveBeenCalled();
    expect(storeFns.storeReader).not.toHaveBeenCalled();
    expect(compileFns.compileManuscript).not.toHaveBeenCalled();
    expect(compileFns.compileReader).not.toHaveBeenCalled();
  });

  it('refuses mismatched bytes before storing anything', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n%fake\n');

    const status = await statusOf(
      publishUploaded(makeService(), {
        manuscript: { bytes: pdf, filename: 'book.md', mimeType: 'text/markdown' },
      }),
    );

    expect(status).toBe(400);
    expect(storeFns.store).not.toHaveBeenCalled();
    expect(storeFns.storeManuscript).not.toHaveBeenCalled();
    expect(storeFns.storeReader).not.toHaveBeenCalled();
  });

  it('refuses oversized uploads with 413 before storing anything', async () => {
    const huge = new Uint8Array(MAX_MANUSCRIPT_BYTES + 1);

    const status = await statusOf(
      publishUploaded(makeService(), {
        manuscript: { bytes: huge, filename: 'book.md', mimeType: 'text/markdown' },
      }),
    );

    expect(status).toBe(413);
    expect(storeFns.store).not.toHaveBeenCalled();
    expect(storeFns.storeManuscript).not.toHaveBeenCalled();
    expect(storeFns.storeReader).not.toHaveBeenCalled();
  });

  it('publishes uploads without consulting the storage ceilings', async () => {
    tierFns.assertCanUploadMedia.mockRejectedValueOnce(
      new TierLimitExceededError('Storage limit reached.'),
    );

    const publication = await publishUploaded(makeService(), {
      manuscript: { bytes: manuscriptBytes(), filename: 'book.md' },
    });

    expect(publication).toEqual({ id: 'pub-row' });
    expect(storeFns.storeManuscript).toHaveBeenCalledTimes(1);
  });

  it('removes uploaded blobs when the transaction fails after the release', async () => {
    dbState.failTransaction = true;

    await expect(
      publishUploaded(makeService(), {
        manuscript: { bytes: manuscriptBytes(), filename: 'book.md' },
        reader: { bytes: readerBytes(), filename: 'reader.html' },
      }),
    ).rejects.toThrow('tx failed');

    const publicationId = storeFns.store.mock.calls[0][1];
    expect(storeFns.delete).toHaveBeenCalledWith('story-1', publicationId);
    expect(storeFns.deleteManuscript).toHaveBeenCalledWith('story-1', publicationId, 'md');
    expect(storeFns.deleteReader).toHaveBeenCalledWith('story-1', publicationId);
  });
});

describe('StoryPublicationService version retention', () => {
  function existingIds(count: number): ExistingPublicationRow[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `old-${index}`,
      arcId: null,
      manuscriptFormat: 'md',
      readerByteSize: 2,
    }));
  }

  async function statusOf(promise: Promise<unknown>): Promise<number> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      return (error as AppError).status;
    }
    throw new Error('Expected the publish to fail.');
  }

  it('keeps the long-standing five without a tier', async () => {
    dbState.existingPublications.push(...existingIds(7));

    await publishAll(makeService());

    expect(storeFns.delete).toHaveBeenCalledWith('story-1', 'old-5');
    expect(storeFns.delete).toHaveBeenCalledWith('story-1', 'old-6');
    expect(storeFns.delete).not.toHaveBeenCalledWith('story-1', expect.stringMatching(/^old-[0-4]$/));
  });

  it('trims to the plan’s versions per story', async () => {
    tierFns.getEffectiveTier.mockResolvedValue({ maxPublicationsPerStory: 2 });
    dbState.existingPublications.push(...existingIds(4));

    await publishAll(makeService());

    expect(storeFns.delete).toHaveBeenCalledWith('story-1', 'old-2');
    expect(storeFns.delete).toHaveBeenCalledWith('story-1', 'old-3');
    // Only the pruned rows lose their blobs; the new version keeps its own.
    expect(storeFns.delete).toHaveBeenCalledTimes(2);
  });

  it('keeps everything when the plan is unlimited', async () => {
    tierFns.getEffectiveTier.mockResolvedValue({ maxPublicationsPerStory: null });
    dbState.existingPublications.push(...existingIds(9));

    await publishAll(makeService());

    // The new version row is written (alongside the showcase entry upsert).
    expect(
      dbState.inserts.some(
        (insert) => typeof insert === 'object' && insert !== null && 'snapshot' in insert,
      ),
    ).toBe(true);
    // Nine old versions and the new one all keep their blobs.
    expect(storeFns.delete).not.toHaveBeenCalled();
  });

  it('refuses with 429 when the plan keeps no versions, storing nothing', async () => {
    tierFns.getEffectiveTier.mockResolvedValue({ maxPublicationsPerStory: 0 });

    const status = await statusOf(publishAll(makeService()));

    expect(status).toBe(429);
    expect(storeFns.store).not.toHaveBeenCalled();
    expect(storeFns.storeManuscript).not.toHaveBeenCalled();
    expect(storeFns.storeReader).not.toHaveBeenCalled();
  });
});

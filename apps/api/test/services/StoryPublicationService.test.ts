import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryPublicationService } from '../../src/services/StoryPublicationService';

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
  recordPublication: vi.fn(async (_tx: unknown, _userId: string, _storyId: string) => {}),
}));
const compileFns = vi.hoisted(() => ({
  compileManuscript: vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    format: 'md' as const,
  })),
  compileReader: vi.fn(() => ({ bytes: new Uint8Array([4, 5]) })),
}));
const dbState = vi.hoisted(() => ({ failTransaction: false, inserts: [] as unknown[] }));

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
  // resolves to the rows while still carrying the chain.
  const where = () => Object.assign(Promise.resolve([]), { orderBy: () => Promise.resolve([]) });
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

describe('StoryPublicationService staged-release', () => {
  beforeEach(() => {
    dbState.failTransaction = false;
    dbState.inserts.length = 0;
    for (const fn of [...Object.values(storeFns), ...Object.values(tierFns)]) fn.mockClear();
  });

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

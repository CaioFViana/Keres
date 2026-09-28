/** @jest-environment node */
const mockFetchStories = jest.fn(async () => undefined);

jest.mock('../../src/state/storyListStore', () => ({
  __esModule: true,
  useStoryListStore: { getState: () => ({ fetchStories: mockFetchStories }) },
}));
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: jest.fn(() => ({})),
}));

import { importNewServerStories } from '../../src/services/sync/importNewServerStories';

const server = { id: 'server-1', idUser: 'me' } as never;

function fakeDb(initial: string[]) {
  const ids = new Set(initial);
  return {
    ids,
    db: {
      query: {
        stories: { findMany: jest.fn(async () => [...ids].map((id) => ({ id }))) },
      },
    } as never,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('importNewServerStories', () => {
  it('downloads only what the device lacks and refreshes the story list', async () => {
    const { db } = fakeDb(['story-1']);
    const engine = {
      fetchServerStoryPreviews: jest.fn(async () => [
        { storyId: 'story-1', role: 'owner' },
        { storyId: 'story-2', role: 'reader' },
      ]),
      downloadAndImportStory: jest.fn(async () => undefined),
    };

    await expect(importNewServerStories(db, engine as never, server)).resolves.toBe(true);

    expect(engine.downloadAndImportStory).toHaveBeenCalledTimes(1);
    expect(engine.downloadAndImportStory).toHaveBeenCalledWith(
      'server-1',
      'story-2',
      'me',
      'reader',
    );
    expect(mockFetchStories).toHaveBeenCalledTimes(1);
  });

  it('never imports a story twice when two runs overlap', async () => {
    const { db, ids } = fakeDb([]);
    const engine = {
      fetchServerStoryPreviews: jest.fn(async () => [{ storyId: 'story-2', role: 'writer' }]),
      downloadAndImportStory: jest.fn(async (_server: string, storyId: string) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        ids.add(storyId);
      }),
    };

    // Accepting an invitation and the realtime nudge that follows it land together.
    const [first, second] = await Promise.all([
      importNewServerStories(db, engine as never, server),
      importNewServerStories(db, engine as never, server),
    ]);

    expect(engine.downloadAndImportStory).toHaveBeenCalledTimes(1);
    expect([first, second]).toEqual([true, false]);
  });

  it('keeps the queue going after a failed run', async () => {
    const { db } = fakeDb([]);
    const failing = {
      fetchServerStoryPreviews: jest.fn(async () => {
        throw new Error('offline');
      }),
      downloadAndImportStory: jest.fn(),
    };
    const working = {
      fetchServerStoryPreviews: jest.fn(async () => []),
      downloadAndImportStory: jest.fn(),
    };

    await expect(importNewServerStories(db, failing as never, server)).rejects.toThrow('offline');
    await expect(importNewServerStories(db, working as never, server)).resolves.toBe(false);
    expect(mockFetchStories).not.toHaveBeenCalled();
  });
});

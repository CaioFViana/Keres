/** @jest-environment node */
const mockDiscard = jest.fn(async (_id: string) => undefined);
const mockFetchStories = jest.fn(async () => undefined);
const mockNotify = jest.fn();
const mockEmit = jest.fn();

jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: jest.fn(() => ({ discardCollaboratedCopy: mockDiscard })),
}));
jest.mock('../../src/state/storyListStore', () => ({
  __esModule: true,
  useStoryListStore: { getState: () => ({ fetchStories: mockFetchStories }) },
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: { getState: () => ({ showNotification: mockNotify }) },
}));
jest.mock('../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: { emit: (...args: unknown[]) => mockEmit(...args) },
}));
jest.mock('../../src/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string, params?: { title: string }) => `${key}:${params?.title}` },
}));

import { noteAccessRevocation } from '../../src/services/accessRevocation';
import { dropRevokedServerStories } from '../../src/services/sync/dropRevokedServerStories';

const server = { id: 'server-1' } as never;
const story = (id: string, myRole: string | null, title = id) => ({ id, title, myRole });
const dbWith = (rows: unknown[]) =>
  ({ query: { stories: { findMany: jest.fn(async () => rows) } } }) as never;
const listed = (...ids: string[]) =>
  ids.map((storyId) => ({ storyId, lastOperationVersion: 1, role: 'reader' as const }));

beforeEach(() => jest.clearAllMocks());

describe('dropRevokedServerStories', () => {
  it('removes the copy of a story the server no longer lists, says so, and lets the open screens go', async () => {
    const db = dbWith([story('kept', 'writer'), story('gone', 'reader', 'Lost Tale')]);

    await expect(dropRevokedServerStories(db, server, listed('kept'))).resolves.toEqual(['gone']);

    expect(mockDiscard).toHaveBeenCalledTimes(1);
    expect(mockDiscard).toHaveBeenCalledWith('gone');
    expect(mockNotify).toHaveBeenCalledWith('story_access_lost:Lost Tale', 'info');
    expect(mockEmit).toHaveBeenCalledWith('story_access_lost', 'gone');
    expect(mockFetchStories).toHaveBeenCalledTimes(1);
  });

  it("never touches the owner's own stories, nor one whose role is still unknown", async () => {
    const db = dbWith([
      story('mine', 'owner'),
      story('unresolved', null),
      story('local-only', 'reader'),
    ]);

    // Only `local-only` is a known collaborator role the server did not list.
    await expect(dropRevokedServerStories(db, server, [])).resolves.toEqual(['local-only']);
    expect(mockDiscard).not.toHaveBeenCalledWith('mine');
    expect(mockDiscard).not.toHaveBeenCalledWith('unresolved');
  });

  it('does nothing, and does not refresh the list, when every copy is still listed', async () => {
    const db = dbWith([story('a', 'reader'), story('b', 'writer')]);

    await expect(dropRevokedServerStories(db, server, listed('a', 'b'))).resolves.toEqual([]);

    expect(mockDiscard).not.toHaveBeenCalled();
    expect(mockFetchStories).not.toHaveBeenCalled();
  });

  it('names the moderation reason when the server revoked access for one', async () => {
    noteAccessRevocation('gone', 'nsfw-story');
    noteAccessRevocation('other', 'removed-by-admin');
    const db = dbWith([story('gone', 'reader', 'Grown Tales'), story('other', 'reader', 'Old')]);

    await expect(dropRevokedServerStories(db, server, [])).resolves.toEqual(['gone', 'other']);

    expect(mockNotify).toHaveBeenCalledWith('story_access_revoked_nsfw:Grown Tales', 'info');
    expect(mockNotify).toHaveBeenCalledWith('story_access_revoked_removed:Old', 'info');
    expect(mockNotify).not.toHaveBeenCalledWith(
      expect.stringContaining('story_access_lost'),
      expect.anything(),
    );
  });

  it('keeps going when one copy cannot be removed, and reports only those that went', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockDiscard.mockRejectedValueOnce(new Error('locked'));
    const db = dbWith([story('first', 'reader'), story('second', 'reader')]);

    await expect(dropRevokedServerStories(db, server, [])).resolves.toEqual(['second']);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith('story_access_lost', 'second');
  });
});

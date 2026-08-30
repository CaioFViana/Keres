/**
 * @jest-environment node
 */
jest.mock('../../src/services/MediaSyncService', () => ({
  __esModule: true,
  createMediaSyncService: jest.fn(),
}));

import { createMediaSyncService } from '../../src/services/MediaSyncService';
import { SyncMedia } from '../../src/services/sync/SyncMedia';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const syncStoryMedia = jest.fn();
const server = { id: 'server-1' } as never;
const client = {} as never;
const db = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  (createMediaSyncService as jest.Mock).mockReturnValue({ syncStoryMedia });
  syncStoryMedia.mockResolvedValue({ uploaded: 0, downloaded: 0, failed: 0, offline: false });
});

function createSubject(overrides: Partial<{ db: unknown; storyId: string | null; server: unknown }> = {}) {
  return new SyncMedia({
    db: () => (overrides.db === undefined ? db : (overrides.db as never)),
    storyId: () => (overrides.storyId === undefined ? 'story-1' : overrides.storyId),
    server: () => (overrides.server === undefined ? server : (overrides.server as never)),
    client: () => client,
  });
}

describe('SyncMedia', () => {
  it('does not construct a transfer service until every sync prerequisite exists', async () => {
    await expect(createSubject({ storyId: null }).sync()).resolves.toBe(false);
    await expect(createSubject({ db: null }).sync()).resolves.toBe(false);
    await expect(createSubject({ server: null }).sync()).resolves.toBe(false);
    expect(createMediaSyncService).not.toHaveBeenCalled();
  });

  it('reuses the media service, reports offline state and only refreshes gallery UI after a transfer', async () => {
    const emit = jest.spyOn(entityEventEmitter, 'emit');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    syncStoryMedia
      .mockResolvedValueOnce({ uploaded: 2, downloaded: 0, failed: 0, offline: true })
      .mockResolvedValueOnce({ uploaded: 0, downloaded: 0, failed: 0, offline: false });
    const subject = createSubject();

    await expect(subject.sync()).resolves.toBe(true);
    await expect(subject.sync()).resolves.toBe(false);

    expect(createMediaSyncService).toHaveBeenCalledTimes(1);
    expect(syncStoryMedia).toHaveBeenCalledWith(client, server, 'story-1');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('gallery_changed', 'story-1');
  });

  it('drops the cached service on reset and treats transfer failures as a non-fatal cycle', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const subject = createSubject();
    await subject.sync();
    subject.reset();
    syncStoryMedia.mockRejectedValueOnce(new Error('network down'));

    await expect(subject.sync()).resolves.toBe(false);
    expect(createMediaSyncService).toHaveBeenCalledTimes(2);
  });
});

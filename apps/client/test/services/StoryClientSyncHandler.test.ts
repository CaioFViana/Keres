/** @jest-environment node */
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { StoryClientSyncHandler } from '../../src/services/entity-sync-handlers/StoryClientSyncHandler';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const CREATED_AT = '2026-08-10T12:00:00.000Z';
let database: TestDatabase;

const createUpdate = (entity: string, id: string, data: unknown) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;
const updateUpdate = (entity: string, id: string, changes: unknown) =>
  ({ type: 'update', entity, id, changes }) as UpdateStoryUpdate;
const deleteUpdate = (entity: string, id: string) =>
  ({ type: 'delete', entity, id }) as DeleteStoryUpdate;

function remoteStory(overrides: Record<string, unknown> = {}) {
  return {
    id: STORY_ID,
    userId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
    title: 'A Queda',
    type: 'linear',
    favoriteBehavior: 'individual',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    version: 4,
    isDeleted: false,
    deletedAt: null,
    lastOperationLog: 18,
    lastServerSyncedLog: 18,
    ...overrides,
  };
}

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryClientSyncHandler', () => {
  it('creates a remote story with date revival and resets the local sync cursor', async () => {
    const handler = new StoryClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(STORY_ID, createUpdate('Story', STORY_ID, remoteStory()));

    expect(await handler.getById(STORY_ID)).toEqual(
      expect.objectContaining({
        id: STORY_ID,
        title: 'A Queda',
        createdAt: new Date(CREATED_AT),
        lastOperationLog: 0,
        lastServerSyncedLog: 0,
      }),
    );
  });

  it('does not apply serverId, myRole, lastOperationLog or userId from a remote update', async () => {
    const handler = new StoryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Story', STORY_ID, remoteStory()));

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Story', STORY_ID, {
        title: 'A Queda Final',
        serverId: 'attacker-server',
        myRole: 'reader',
        lastOperationLog: 999,
        lastServerSyncedLog: 999,
        userId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
      }),
    );

    expect(await handler.getById(STORY_ID)).toEqual(
      expect.objectContaining({
        title: 'A Queda Final',
        serverId: null,
        myRole: null,
        lastOperationLog: 0,
        lastServerSyncedLog: 0,
        userId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      }),
    );
  });

  it('updates and tombstones only the addressed story', async () => {
    const handler = new StoryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Story', STORY_ID, remoteStory()));

    await handler.applyUpdate(
      STORY_ID,
      updateUpdate('Story', STORY_ID, {
        title: 'A Queda Final',
        createdAt: '2026-08-09T12:00:00.000Z',
      }),
    );
    await handler.applyDelete(STORY_ID, deleteUpdate('Story', STORY_ID));

    expect(await handler.getById(STORY_ID)).toEqual(
      expect.objectContaining({
        title: 'A Queda Final',
        createdAt: new Date('2026-08-09T12:00:00.000Z'),
        isDeleted: true,
        deletedAt: expect.any(Date),
      }),
    );
  });

  it('ignores unrelated operations and reports malformed operations instead of writing bad data', async () => {
    const handler = new StoryClientSyncHandler();
    handler.setDb(database.db);

    await handler.applyCreate(STORY_ID, createUpdate('Character', STORY_ID, remoteStory()));
    await handler.applyCreate(STORY_ID, {
      type: 'create',
      entity: 'Story',
      data: remoteStory(),
    } as unknown as CreateStoryUpdate);
    await handler.applyUpdate(STORY_ID, {
      type: 'update',
      entity: 'Story',
      id: STORY_ID,
    } as UpdateStoryUpdate);

    expect(await handler.getById(STORY_ID)).toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('refuses to operate before receiving its database', async () => {
    await expect(
      new StoryClientSyncHandler().applyCreate(
        STORY_ID,
        createUpdate('Story', STORY_ID, remoteStory()),
      ),
    ).rejects.toThrow(/Drizzle client \(db\) not set/);
  });

  it('ignores an update or delete addressed to another entity type', async () => {
    const handler = new StoryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Story', STORY_ID, remoteStory()));

    await handler.applyUpdate(STORY_ID, updateUpdate('Character', STORY_ID, { title: 'x' }));
    await handler.applyDelete(STORY_ID, deleteUpdate('Character', STORY_ID));

    expect(await handler.getById(STORY_ID)).toMatchObject({
      title: 'A Queda',
      isDeleted: false,
    });
  });

  it('refuses a delete with no id instead of tombstoning blindly', async () => {
    const handler = new StoryClientSyncHandler();
    handler.setDb(database.db);
    await handler.applyCreate(STORY_ID, createUpdate('Story', STORY_ID, remoteStory()));

    await handler.applyDelete(STORY_ID, { type: 'delete', entity: 'Story' } as DeleteStoryUpdate);

    expect(await handler.getById(STORY_ID)).toMatchObject({ isDeleted: false });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Missing ID'));
  });

  it('defaults the bookkeeping fields an old server omits on a tombstone create', async () => {
    const handler = new StoryClientSyncHandler();
    handler.setDb(database.db);
    const { version: _version, isDeleted: _deleted, ...rest } = remoteStory();

    await handler.applyCreate(
      STORY_ID,
      createUpdate('Story', STORY_ID, { ...rest, deletedAt: CREATED_AT }),
    );

    const row = await handler.getById(STORY_ID);
    expect(row).toMatchObject({ version: 1, isDeleted: false });
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect((row?.deletedAt as Date).toISOString()).toBe(CREATED_AT);
  });
});

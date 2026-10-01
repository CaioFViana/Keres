/**
 * @jest-environment node
 */
import axios from 'axios';
import { eq } from 'drizzle-orm';
import { comments, favorites, operationLogs, servers, stories } from '../../src/db/schema';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  delete (axios.defaults as any).adapter;
  jest.restoreAllMocks();
});

describe('StoryService lifecycle', () => {
  it('creates a story for the caller and exposes it through live-story queries', async () => {
    const service = createStoryService(database.db);
    const created = await service.createStory('author', {
      userId: 'ignored-by-service',
      title: 'Caminhos',
      type: 'branching',
    });

    expect(created).toEqual(
      expect.objectContaining({ userId: 'author', title: 'Caminhos', type: 'branching' }),
    );
    expect(await service.getStoryById(created.id)).toEqual(
      expect.objectContaining({ id: created.id, title: 'Caminhos' }),
    );
    expect((await service.getAllStories()).map(({ id }) => id)).toEqual(
      expect.arrayContaining([TEST_STORY_ID, created.id]),
    );
    expect(
      await database.db.query.operationLogs.findFirst({
        where: (log, { eq }) => eq(log.entityId, created.id),
      }),
    ).toEqual(expect.objectContaining({ entityType: 'Story', operationType: 'create' }));
  });

  it('persists meaningful updates once and skips an unchanged save', async () => {
    const service = createStoryService(database.db);
    await service.updateStory('local-user', TEST_STORY_ID, { title: 'A Queda Final' });
    const logCountAfterChange = await database.db
      .select({ count: operationLogs.id })
      .from(operationLogs)
      .all();
    await service.updateStory('local-user', TEST_STORY_ID, { title: 'A Queda Final' });

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ title: 'A Queda Final', version: 2 }),
    );
    expect(await database.db.select({ count: operationLogs.id }).from(operationLogs).all()).toEqual(
      logCountAfterChange,
    );
  });

  it('exports a complete, valid empty story package', async () => {
    const service = createStoryService(database.db);
    const exportedStoryId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    await database.db.insert(stories).values({
      id: exportedStoryId,
      userId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      title: 'Pacote válido',
      type: 'linear',
      favoriteBehavior: 'individual',
      ...entityBase,
    });
    const exported = await service.exportFullStory(exportedStoryId);

    expect(exported).toEqual(
      expect.objectContaining({
        story: expect.objectContaining({ id: exportedStoryId }),
        chapters: [],
        scenes: [],
        choices: [],
      }),
    );
  });
});

describe('StoryService unlinkFromServer', () => {
  const seedLinkedStory = async () => {
    await database.db
      .update(stories)
      .set({ serverId: 'server-1', myRole: 'owner' })
      .where(eq(stories.id, TEST_STORY_ID));
  };

  const seedOwnComment = async (authorUserId: string) => {
    await database.db.insert(comments).values({
      id: 'comment-1',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'char-1',
      commentText: 'hello',
      criticality: 0,
      authorUserId,
      ...entityBase,
      deletedAt: null,
    });
  };

  const seedOwnFavorite = async (userId: string) => {
    await database.db.insert(favorites).values({
      id: 'fav-1',
      storyId: TEST_STORY_ID,
      entityType: 'Character',
      entityId: 'char-1',
      userId,
      ...entityBase,
      deletedAt: null,
    });
  };

  const commentAuthor = async () =>
    (
      await database.db.query.comments.findFirst({
        where: eq(comments.id, 'comment-1'),
      })
    )?.authorUserId;

  it('migrates the owner comments back to the local identity when the server is gone', async () => {
    await seedLinkedStory();
    await seedOwnComment('server-user');
    const service = createStoryService(database.db);

    await service.unlinkFromServer(TEST_USER_ID, TEST_STORY_ID);

    expect(await commentAuthor()).toBe(TEST_USER_ID);
    expect((await service.getStoryById(TEST_STORY_ID))?.serverId).toBeNull();
  });

  it('migrates owner comments and favourites back after deleting the server copy', async () => {
    await database.db.insert(servers).values({
      id: 'server-1',
      idUser: 'server-user',
      userName: 'owner',
      name: 'Home',
      url: 'https://home.example',
      ...entityBase,
      deletedAt: null,
    });
    await seedLinkedStory();
    await seedOwnComment('server-user');
    await seedOwnFavorite('server-user');
    (axios.defaults as any).adapter = async (config: any) => ({
      data: { conflicts: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
    const service = createStoryService(database.db);

    await service.unlinkFromServer(TEST_USER_ID, TEST_STORY_ID);

    expect(await commentAuthor()).toBe(TEST_USER_ID);
    expect(
      (
        await database.db.query.favorites.findFirst({
          where: eq(favorites.id, 'fav-1'),
        })
      )?.userId,
    ).toBe(TEST_USER_ID);
    expect((await service.getStoryById(TEST_STORY_ID))?.serverId).toBeNull();
  });
});

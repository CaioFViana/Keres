/**
 * @jest-environment node
 */
jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { deleteStoryMedia: jest.fn() },
}));
jest.mock('../../src/services/apiClient', () => ({
  createKeresAxiosInstance: jest.fn(),
  isOfflineError: jest.fn(() => false),
}));

import { choices } from '../../src/db/schema';
import { createKeresAxiosInstance } from '../../src/services/apiClient';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { StoryOwnerOnlyError } from '../../src/utils/syncUtils';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

async function seedLinkedWriterStory() {
  await seedLocalStory(database, {
    serverId: 'server-1',
    myRole: 'writer',
    type: 'linear',
    favoriteBehavior: 'individual',
    allowReaderComments: false,
  });
}

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryService owner-only policy', () => {
  it('lets a writer change story content', async () => {
    await seedLinkedWriterStory();
    const service = createStoryService(database.db);

    await service.updateStory(TEST_USER_ID, TEST_STORY_ID, { title: 'A Queda, pelo writer' });

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ title: 'A Queda, pelo writer', type: 'linear' }),
    );
  });

  it('lets a writer save when policy fields are echoed unchanged', async () => {
    await seedLinkedWriterStory();
    const service = createStoryService(database.db);

    await service.updateStory(TEST_USER_ID, TEST_STORY_ID, {
      title: 'Ainda a Queda',
      type: 'linear',
      favoriteBehavior: 'individual',
      allowReaderComments: false,
    });

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({
        title: 'Ainda a Queda',
        type: 'linear',
        favoriteBehavior: 'individual',
        allowReaderComments: false,
      }),
    );
  });

  it.each([
    ['type', { type: 'branching' as const }],
    ['favoriteBehavior', { favoriteBehavior: 'global' as const }],
    ['allowReaderComments', { allowReaderComments: true }],
  ])('refuses a writer changing %s', async (_field, patch) => {
    await seedLinkedWriterStory();
    const service = createStoryService(database.db);

    await expect(service.updateStory(TEST_USER_ID, TEST_STORY_ID, patch)).rejects.toBeInstanceOf(
      StoryOwnerOnlyError,
    );
    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({
        type: 'linear',
        favoriteBehavior: 'individual',
        allowReaderComments: false,
        title: 'A Queda',
      }),
    );
  });

  it('lets the owner change policy fields', async () => {
    await seedLocalStory(database, { serverId: 'server-1', myRole: 'owner' });
    const service = createStoryService(database.db);

    await service.updateStory(TEST_USER_ID, TEST_STORY_ID, {
      favoriteBehavior: 'global',
      allowReaderComments: true,
    });

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ favoriteBehavior: 'global', allowReaderComments: true }),
    );
  });

  it('lets a never-linked local story change type and favorite policy', async () => {
    await seedLocalStory(database);
    const service = createStoryService(database.db);

    await service.updateStory(TEST_USER_ID, TEST_STORY_ID, {
      type: 'branching',
      favoriteBehavior: 'global',
    });

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ type: 'branching', favoriteBehavior: 'global' }),
    );
  });

  it('does not create choices when a writer tries to convert the story type', async () => {
    await seedLinkedWriterStory();
    const service = createStoryService(database.db);

    await expect(
      service.convertStoryType(TEST_USER_ID, TEST_STORY_ID, 'branching'),
    ).rejects.toBeInstanceOf(StoryOwnerOnlyError);

    expect(await service.getStoryById(TEST_STORY_ID)).toEqual(
      expect.objectContaining({ type: 'linear' }),
    );
    expect(await database.db.select().from(choices).all()).toEqual([]);
  });

  it('does not delete the local copy when a writer tries to delete the story', async () => {
    await seedLinkedWriterStory();
    (createKeresAxiosInstance as jest.Mock).mockReturnValue({
      post: jest.fn(),
      setTokenProvider: jest.fn(),
      setActiveServer: jest.fn(),
    });

    await expect(createStoryService(database.db).deleteStory(TEST_STORY_ID)).rejects.toBeInstanceOf(
      StoryOwnerOnlyError,
    );
    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ id: TEST_STORY_ID }),
    );
    expect(createKeresAxiosInstance).not.toHaveBeenCalled();
  });

  it('does not unlink when a writer tries to take the story off the server', async () => {
    await seedLinkedWriterStory();
    (createKeresAxiosInstance as jest.Mock).mockReturnValue({
      post: jest.fn(),
      setTokenProvider: jest.fn(),
      setActiveServer: jest.fn(),
    });

    await expect(
      createStoryService(database.db).unlinkFromServer(TEST_USER_ID, TEST_STORY_ID),
    ).rejects.toBeInstanceOf(StoryOwnerOnlyError);
    expect(await database.db.query.stories.findFirst()).toEqual(
      expect.objectContaining({ serverId: 'server-1' }),
    );
    expect(createKeresAxiosInstance).not.toHaveBeenCalled();
  });
});

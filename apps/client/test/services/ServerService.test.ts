/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
jest.mock('../../src/services/MediaFileService', () => ({
  mediaFileService: { deleteStoryMedia: jest.fn() },
}));
import {
  createServerService,
  ServerHasOwnedStoriesError,
  ServerUrlAlreadyRegisteredError,
} from '../../src/services/ServerService';
import { mediaFileService } from '../../src/services/MediaFileService';
import { entityBase, seedLocalStory, TEST_NOW, TEST_STORY_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database, { serverId: 'server', myRole: 'owner' });
});

afterEach(() => database.close());

it('returns only active servers and finds live stories owned by a server', async () => {
  await database.db.insert(schema.servers).values([
    {
      id: 'server',
      idUser: 'local-user',
      userName: 'Caio',
      tag: 'caio',
      name: 'Principal',
      url: 'https://principal.test',
      ...entityBase,
    },
    {
      id: 'removed-server',
      idUser: 'local-user',
      userName: 'Caio',
      tag: 'caio',
      name: 'Removido',
      url: 'https://removed.test',
      ...entityBase,
      isDeleted: true,
    },
  ]);
  await database.db.insert(schema.stories).values({
    id: 'writer-story',
    userId: 'local-user',
    title: 'Compartilhada',
    type: 'linear',
    favoriteBehavior: 'individual',
    serverId: 'server',
    myRole: 'writer',
    ...entityBase,
  });

  const service = createServerService(database.db);
  expect((await service.getAllServers()).map(({ id }) => id)).toEqual(['server']);
  expect(await service.getOwnedStories('server')).toEqual([
    { id: TEST_STORY_ID, title: 'A Queda' },
  ]);
});

describe('server URL uniqueness', () => {
  const newServer = (url: string) => ({
    idUser: 'local-user',
    userName: 'Caio',
    tag: 'caio',
    name: 'Nuvem',
    url,
    lastSyncDate: TEST_NOW,
  });

  it('refuses a second live server with the same URL, including trailing-slash variants', async () => {
    const service = createServerService(database.db);
    const created = await service.createServer(newServer('https://keres.example/'));
    expect(created.url).toBe('https://keres.example');

    await expect(service.createServer(newServer('https://Keres.example'))).rejects.toBeInstanceOf(
      ServerUrlAlreadyRegisteredError,
    );
    expect(await service.getServerByUrl('https://keres.example/')).toMatchObject({
      id: created.id,
    });
  });

  it('lets a URL be reused after the previous server is removed', async () => {
    const service = createServerService(database.db);
    const created = await service.createServer(newServer('https://free.example'));
    await service.deleteServer(created.id);

    const reused = await service.createServer(newServer('https://free.example/'));
    expect(reused.id).not.toBe(created.id);
    expect(reused.url).toBe('https://free.example');
  });

  it('refuses changing a server URL onto another live server', async () => {
    const service = createServerService(database.db);
    await service.createServer(newServer('https://alpha.example'));
    const beta = await service.createServer(newServer('https://beta.example'));

    await expect(
      service.updateServer(beta.id, { url: 'https://alpha.example/' }),
    ).rejects.toBeInstanceOf(ServerUrlAlreadyRegisteredError);
  });
});

it('purges reader and writer stories with their local sync state when leaving a server', async () => {
  await database.db.insert(schema.servers).values({
    id: 'shared-server',
    idUser: 'local-user',
    userName: 'Caio',
    tag: 'caio',
    name: 'Compartilhado',
    url: 'https://shared.test',
    ...entityBase,
  });
  await database.db.insert(schema.stories).values([
    {
      id: 'writer-story',
      userId: 'owner-on-server',
      title: 'Rascunho compartilhado',
      type: 'linear',
      favoriteBehavior: 'individual',
      serverId: 'shared-server',
      myRole: 'writer',
      ...entityBase,
    },
    {
      id: 'reader-story',
      userId: 'owner-on-server',
      title: 'Leitura compartilhada',
      type: 'linear',
      favoriteBehavior: 'individual',
      serverId: 'shared-server',
      myRole: 'reader',
      ...entityBase,
    },
  ]);
  await database.db.insert(schema.chapters).values({
    id: 'writer-chapter',
    storyId: 'writer-story',
    name: 'Capítulo',
    index: 1,
    ...entityBase,
  });
  await database.db.insert(schema.locationMaps).values({
    id: 'writer-map',
    storyId: 'writer-story',
    name: 'Mapa',
    content: { images: [], nodes: [] },
    ...entityBase,
  });
  await database.db.insert(schema.operationLogs).values({
    id: 'writer-operation',
    storyId: 'writer-story',
    userId: 'local-user',
    operationVersion: 1,
    operationType: 'update',
    entityType: 'Chapter',
    entityId: 'writer-chapter',
    payload: '{}',
    createdAt: TEST_NOW,
  });
  await database.db.insert(schema.syncConflicts).values({
    id: 'writer-conflict',
    storyId: 'writer-story',
    entityType: 'Chapter',
    entityId: 'writer-chapter',
    reason: 'server_version_mismatch',
    localOperationType: 'update',
    localOperationIds: '["writer-operation"]',
    localValues: '{}',
    detectedAt: TEST_NOW,
  });
  await database.db.insert(schema.storyPublications).values({
    id: 'writer-publication',
    serverId: 'shared-server',
    storyId: 'writer-story',
    label: 'v1',
    operationVersion: 1,
    byteSize: 1,
    createdAt: TEST_NOW,
  });

  await createServerService(database.db).deleteServer('shared-server');

  expect(await database.db.select().from(schema.stories).all()).toEqual(
    expect.not.arrayContaining([
      expect.objectContaining({ id: 'writer-story' }),
      expect.objectContaining({ id: 'reader-story' }),
    ]),
  );
  expect(await database.db.select().from(schema.chapters).all()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ storyId: 'writer-story' })]),
  );
  expect(await database.db.select().from(schema.locationMaps).all()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ storyId: 'writer-story' })]),
  );
  expect(await database.db.select().from(schema.operationLogs).all()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ storyId: 'writer-story' })]),
  );
  expect(await database.db.select().from(schema.syncConflicts).all()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ storyId: 'writer-story' })]),
  );
  expect(await database.db.select().from(schema.storyPublications).all()).toEqual([]);
  expect(mediaFileService.deleteStoryMedia).toHaveBeenCalledWith('writer-story');
  expect(mediaFileService.deleteStoryMedia).toHaveBeenCalledWith('reader-story');
});

it('blocks removing a server with a live owner story, but purges that story after its local tombstone', async () => {
  await database.db.insert(schema.servers).values({
    id: 'server',
    idUser: 'local-user',
    userName: 'Caio',
    tag: 'caio',
    name: 'Principal',
    url: 'https://principal.test',
    ...entityBase,
  });
  const service = createServerService(database.db);

  await expect(service.deleteServer('server')).rejects.toBeInstanceOf(ServerHasOwnedStoriesError);
  expect(await service.getOwnedStories('server')).toEqual([
    { id: TEST_STORY_ID, title: 'A Queda' },
  ]);

  await database.db
    .update(schema.stories)
    .set({ isDeleted: true, deletedAt: TEST_NOW })
    .where(eq(schema.stories.id, TEST_STORY_ID));
  await service.deleteServer('server');

  expect(
    await database.db.query.stories.findFirst({ where: eq(schema.stories.id, TEST_STORY_ID) }),
  ).toBeUndefined();
  expect(mediaFileService.deleteStoryMedia).toHaveBeenCalledWith(TEST_STORY_ID);
});

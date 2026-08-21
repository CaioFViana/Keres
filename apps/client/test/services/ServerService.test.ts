/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import {
  createServerService,
  ServerUrlAlreadyRegisteredError,
} from '../../src/services/ServerService';
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

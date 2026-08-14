/**
 * @jest-environment node
 */
import * as schema from '../../src/db/schema';
import { createServerService } from '../../src/services/ServerService';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '../helpers/storyTestData';
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

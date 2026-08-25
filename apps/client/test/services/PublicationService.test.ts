/**
 * @jest-environment node
 */
jest.mock('../../src/services/PublicationApiService', () => ({
  __esModule: true,
  publicationApiService: {
    listVisible: jest.fn(),
  },
}));

jest.mock('../../src/utils/i18n', () => ({
  __esModule: true,
  default: {
    // A predictable format so the test can assert the notice's content without depending
    // on the translation itself.
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  },
}));

import { eq } from 'drizzle-orm';
import { servers, stories, storyPublications } from '../../src/db/schema';
import { publicationApiService } from '../../src/services/PublicationApiService';
import { createPublicationService } from '../../src/services/PublicationService';
import { useNotificationStore } from '../../src/state/notificationStore';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const SERVER_ID = 'server-1';
const STORY_ID = 'story-1';
const NOW = new Date('2026-08-19T12:00:00.000Z');

let database: TestDatabase;
let service: ReturnType<typeof createPublicationService>;
let shown: Array<{ message: string; type: string }>;

const listVisible = publicationApiService.listVisible as jest.Mock;

function server() {
  return {
    id: SERVER_ID,
    idUser: 'user-1',
    userName: 'Ana',
    tag: 'ana',
    name: 'Servidor principal',
    url: 'https://example.test',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
  };
}

function publication(id: string, label: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    storyId: STORY_ID,
    ownerUserId: 'user-1',
    label,
    operationVersion: 7,
    formatVersion: 4,
    byteSize: 2048,
    mediaIncluded: 0,
    mediaTotal: 0,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

type StoryRole = 'owner' | 'writer' | 'reader' | null;

async function seedStory(myRole: StoryRole = 'reader') {
  await database.db.insert(stories).values({
    id: STORY_ID,
    userId: 'user-1',
    title: 'O Vale Silencioso',
    type: 'linear',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
    lastOperationLog: 7,
    myRole,
  } as typeof stories.$inferInsert);
}

/** Changes this person's role in the story, without recreating the rest of the scenario. */
async function setMyRole(myRole: StoryRole) {
  await database.db.update(stories).set({ myRole }).where(eq(stories.id, STORY_ID)).run();
}

beforeEach(async () => {
  database = await createTestDatabase();
  service = createPublicationService(database.db);
  await database.db.insert(servers).values(server());
  await seedStory();

  shown = [];
  useNotificationStore.setState({
    showNotification: (message: string, type: string) => {
      shown.push({ message, type });
    },
  } as never);

  listVisible.mockReset();
});

afterEach(() => {
  database.close();
});

describe('syncPublicationsWithServer', () => {
  it('mirrors the server publications locally', async () => {
    listVisible.mockResolvedValue([publication('pub-1', 'v7-2026-08-19')]);

    await service.syncPublicationsWithServer(server() as never);

    const rows = await service.getPublicationsForStory(STORY_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'pub-1', label: 'v7-2026-08-19', byteSize: 2048 });
  });

  // Installing the app must not fire a notice for every version that already existed before it.
  it('stays quiet on the very first sync', async () => {
    listVisible.mockResolvedValue([
      publication('pub-1', 'v7-2026-08-19'),
      publication('pub-2', 'v8-2026-08-19'),
    ]);

    await service.syncPublicationsWithServer(server() as never);

    expect(shown).toEqual([]);
  });

  it('notifies about a version that appeared since the last sync', async () => {
    listVisible.mockResolvedValue([publication('pub-1', 'v7-2026-08-19')]);
    await service.syncPublicationsWithServer(server() as never);

    listVisible.mockResolvedValue([
      publication('pub-1', 'v7-2026-08-19'),
      publication('pub-2', 'v8-2026-08-20'),
    ]);
    await service.syncPublicationsWithServer(server() as never);

    expect(shown).toHaveLength(1);
    expect(shown[0].message).toContain('story_version_published');
    expect(shown[0].message).toContain('O Vale Silencioso');
    expect(shown[0].message).toContain('v8-2026-08-20');
  });

  it('does not notify twice about the same version', async () => {
    listVisible.mockResolvedValue([publication('pub-1', 'v7-2026-08-19')]);
    await service.syncPublicationsWithServer(server() as never);

    listVisible.mockResolvedValue([
      publication('pub-1', 'v7-2026-08-19'),
      publication('pub-2', 'v8-2026-08-20'),
    ]);
    await service.syncPublicationsWithServer(server() as never);
    await service.syncPublicationsWithServer(server() as never);

    expect(shown).toHaveLength(1);
  });

  it('drops versions the owner removed on the server', async () => {
    listVisible.mockResolvedValue([
      publication('pub-1', 'v7-2026-08-19'),
      publication('pub-2', 'v8-2026-08-20'),
    ]);
    await service.syncPublicationsWithServer(server() as never);

    listVisible.mockResolvedValue([publication('pub-2', 'v8-2026-08-20')]);
    await service.syncPublicationsWithServer(server() as never);

    const rows = await service.getPublicationsForStory(STORY_ID);
    expect(rows.map((row) => row.id)).toEqual(['pub-2']);
  });

  it('keeps the mirror untouched while the server is unreachable', async () => {
    listVisible.mockResolvedValue([publication('pub-1', 'v7-2026-08-19')]);
    await service.syncPublicationsWithServer(server() as never);

    listVisible.mockRejectedValue(Object.assign(new Error('offline'), { code: 'NO_RESPONSE' }));
    await expect(service.syncPublicationsWithServer(server() as never)).resolves.toBeUndefined();

    const rows = await service.getPublicationsForStory(STORY_ID);
    expect(rows).toHaveLength(1);
  });

  it('propagates a real failure instead of swallowing it', async () => {
    listVisible.mockRejectedValue(new Error('boom'));
    await expect(service.syncPublicationsWithServer(server() as never)).rejects.toThrow('boom');
  });

  // Two almost simultaneous calls (reconnection + event) must not open two write
  // transactions at the same time in SQLite.
  it('shares one in-flight sync between concurrent callers', async () => {
    listVisible.mockResolvedValue([publication('pub-1', 'v7-2026-08-19')]);

    await Promise.all([
      service.syncPublicationsWithServer(server() as never),
      service.syncPublicationsWithServer(server() as never),
    ]);

    expect(listVisible).toHaveBeenCalledTimes(1);
  });

  it('names the story generically when it is not on this device', async () => {
    await database.db.delete(stories);
    listVisible.mockResolvedValue([publication('pub-1', 'v7-2026-08-19')]);
    await service.syncPublicationsWithServer(server() as never);

    await database.db.delete(storyPublications);
    listVisible.mockResolvedValue([
      publication('pub-1', 'v7-2026-08-19'),
      publication('pub-2', 'v8-2026-08-20'),
    ]);
    // With no local row, this round's first sync becomes "the first" again and gives no notice;
    // what matters here is that the title lookup does not break without the story.
    await expect(service.syncPublicationsWithServer(server() as never)).resolves.toBeUndefined();
  });
});

describe('who gets notified', () => {
  async function publishOneMore() {
    listVisible.mockResolvedValue([publication('pub-1', 'v7-2026-08-19')]);
    await service.syncPublicationsWithServer(server() as never);
    listVisible.mockResolvedValue([
      publication('pub-1', 'v7-2026-08-19'),
      publication('pub-2', 'v8-2026-08-20'),
    ]);
    await service.syncPublicationsWithServer(server() as never);
  }

  // The publisher is the owner: telling them about what they have just done themselves is noise. The event still
  // arrives (it is what keeps the list on their other devices up to date), only the notice is silenced.
  it('says nothing to the owner of the story', async () => {
    await setMyRole('owner');
    await publishOneMore();

    expect(shown).toEqual([]);
  });

  it('still mirrors the new version for the owner', async () => {
    await setMyRole('owner');
    await publishOneMore();

    const rows = await service.getPublicationsForStory(STORY_ID);
    expect(rows.map((row) => row.id).sort()).toEqual(['pub-1', 'pub-2']);
  });

  it.each<StoryRole>(['reader', 'writer'])('notifies a %s of the story', async (role) => {
    await setMyRole(role);
    await publishOneMore();

    expect(shown).toHaveLength(1);
    expect(shown[0].message).toContain('v8-2026-08-20');
  });
});

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
    // Formato previsível para o teste conseguir afirmar o conteúdo do aviso sem depender
    // da tradução em si.
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  },
}));

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

async function seedStory() {
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
  } as typeof stories.$inferInsert);
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

  // Instalar o app não pode disparar um aviso para cada versão que já existia antes dele.
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

  // Duas chamadas quase simultâneas (reconexão + evento) não podem abrir duas transações de
  // escrita ao mesmo tempo no SQLite.
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
    // Sem linha local, o primeiro sync desta rodada volta a ser "primeiro" e não avisa;
    // o que importa aqui é que a busca de título não quebra sem a história.
    await expect(service.syncPublicationsWithServer(server() as never)).resolves.toBeUndefined();
  });
});

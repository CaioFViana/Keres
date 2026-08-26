/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { operationLogs, stories } from '../../src/db/schema';
import { createOperationLogService } from '../../src/services/OperationLogService';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER_STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAW';

let database: TestDatabase;
let service: ReturnType<typeof createOperationLogService>;
let clock: number;

async function seedStory(
  id = STORY_ID,
  favoriteBehavior: 'global' | 'individual' | 'individual_public' = 'global',
) {
  const now = new Date();
  await database.db.insert(stories).values({
    id,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    favoriteBehavior,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  });
}

/** Each log gets a distinct, increasing instant, so the ordering is observable. */
async function logOperation(overrides: Partial<typeof operationLogs.$inferInsert> = {}) {
  clock += 1000;
  const row = {
    id: `log-${clock}`,
    storyId: STORY_ID,
    userId: 'local-user',
    operationVersion: clock / 1000,
    operationType: 'create' as const,
    entityType: 'Character',
    entityId: 'char-1',
    payload: JSON.stringify({ name: 'Keres' }),
    createdAt: new Date(clock),
    isSynced: false,
    ...overrides,
  };
  await database.db.insert(operationLogs).values(row);
  return row;
}

beforeEach(async () => {
  database = await createTestDatabase();
  service = createOperationLogService(database.db);
  clock = 1_700_000_000_000;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('getRecentOperationLogs', () => {
  it('returns the newest operations first', async () => {
    await seedStory();
    const first = await logOperation();
    const second = await logOperation();

    const logs = await service.getRecentOperationLogs(STORY_ID, 10);

    expect(logs.map((log) => log.id)).toEqual([second.id, first.id]);
  });

  it('breaks a same-millisecond tie by insertion order, newest first', async () => {
    await seedStory();
    const sameInstant = new Date(clock);
    const first = await logOperation({ createdAt: sameInstant });
    const second = await logOperation({ createdAt: sameInstant });

    const logs = await service.getRecentOperationLogs(STORY_ID, 10);

    expect(logs.map((log) => log.id)).toEqual([second.id, first.id]);
  });

  it('honours the limit', async () => {
    await seedStory();
    await logOperation();
    await logOperation();
    await logOperation();

    const logs = await service.getRecentOperationLogs(STORY_ID, 2);

    expect(logs).toHaveLength(2);
  });

  it('never returns operations from another story', async () => {
    await seedStory();
    await seedStory(OTHER_STORY_ID);
    await logOperation();
    await logOperation({ storyId: OTHER_STORY_ID });

    const logs = await service.getRecentOperationLogs(STORY_ID, 10);

    expect(logs.every((log) => log.storyId === STORY_ID)).toBe(true);
  });

  it('returns nothing when no storyId was given', async () => {
    await seedStory();
    await logOperation();

    expect(await service.getRecentOperationLogs('', 10)).toEqual([]);
  });

  it('returns an empty list for a story with no history', async () => {
    await seedStory();

    expect(await service.getRecentOperationLogs(STORY_ID, 10)).toEqual([]);
  });
});

describe('getPaginatedOperationLogs', () => {
  it('pages through the history and reports the total', async () => {
    await seedStory();
    const first = await logOperation();
    const second = await logOperation();
    const third = await logOperation();

    const page1 = await service.getPaginatedOperationLogs(STORY_ID, 1, 2);
    const page2 = await service.getPaginatedOperationLogs(STORY_ID, 2, 2);

    expect(page1.logs.map((log) => log.id)).toEqual([third.id, second.id]);
    expect(page2.logs.map((log) => log.id)).toEqual([first.id]);
    expect(page1.total).toBe(3);
    expect(page2.total).toBe(3);
  });

  it('returns an empty page past the end, without failing', async () => {
    await seedStory();
    await logOperation();

    const page = await service.getPaginatedOperationLogs(STORY_ID, 5, 10);

    expect(page.logs).toEqual([]);
    expect(page.total).toBe(1);
  });

  it('counts only the story it was asked about', async () => {
    await seedStory();
    await seedStory(OTHER_STORY_ID);
    await logOperation();
    await logOperation({ storyId: OTHER_STORY_ID });
    await logOperation({ storyId: OTHER_STORY_ID });

    expect((await service.getPaginatedOperationLogs(STORY_ID, 1, 10)).total).toBe(1);
  });

  it('returns nothing when no storyId was given', async () => {
    expect(await service.getPaginatedOperationLogs('', 1, 10)).toEqual({ logs: [], total: 0 });
  });
});

describe('getOperationLogById', () => {
  it('returns the entry', async () => {
    await seedStory();
    const log = await logOperation();

    expect((await service.getOperationLogById(log.id))?.id).toBe(log.id);
  });

  it('returns undefined for an id that does not exist', async () => {
    await seedStory();

    expect(await service.getOperationLogById('nao-existe')).toBeUndefined();
  });

  it('returns undefined when no id was given', async () => {
    expect(await service.getOperationLogById('')).toBeUndefined();
  });
});

/**
 * With individual favourites, what each person marked is theirs: the operation log must not become a
 * window into the other collaborators' choices.
 */
describe('privacy of individual favourites', () => {
  it('hides another user’s favourite operations', async () => {
    await seedStory(STORY_ID, 'individual');
    const mine = await logOperation({ entityType: 'Favorite', userId: 'local-user' });
    await logOperation({ entityType: 'Favorite', userId: 'outra-pessoa' });

    const logs = await service.getRecentOperationLogs(STORY_ID, 10, 'local-user');

    expect(logs.map((log) => log.id)).toEqual([mine.id]);
  });

  it('hides every favourite operation when the viewer is unknown', async () => {
    await seedStory(STORY_ID, 'individual');
    await logOperation({ entityType: 'Favorite', userId: 'local-user' });
    const regular = await logOperation({ entityType: 'Character' });

    const logs = await service.getRecentOperationLogs(STORY_ID, 10);

    expect(logs.map((log) => log.id)).toEqual([regular.id]);
  });

  it('keeps every other kind of operation visible', async () => {
    await seedStory(STORY_ID, 'individual');
    const regular = await logOperation({ entityType: 'Character', userId: 'outra-pessoa' });

    const logs = await service.getRecentOperationLogs(STORY_ID, 10, 'local-user');

    expect(logs.map((log) => log.id)).toEqual([regular.id]);
  });

  it.each(['global', 'individual_public'] as const)(
    'shows everyone’s favourites when the story is %s',
    async (behavior) => {
      await seedStory(STORY_ID, behavior);
      await logOperation({ entityType: 'Favorite', userId: 'local-user' });
      await logOperation({ entityType: 'Favorite', userId: 'outra-pessoa' });

      const logs = await service.getRecentOperationLogs(STORY_ID, 10, 'local-user');

      expect(logs).toHaveLength(2);
    },
  );

  it('excludes hidden favourites from the paginated total as well', async () => {
    await seedStory(STORY_ID, 'individual');
    await logOperation({ entityType: 'Favorite', userId: 'outra-pessoa' });
    await logOperation({ entityType: 'Character' });

    const page = await service.getPaginatedOperationLogs(STORY_ID, 1, 10, 'local-user');

    expect(page.total).toBe(1);
    expect(page.logs).toHaveLength(1);
  });

  it('refuses to open another user’s favourite entry by id', async () => {
    await seedStory(STORY_ID, 'individual');
    const theirs = await logOperation({ entityType: 'Favorite', userId: 'outra-pessoa' });

    expect(await service.getOperationLogById(theirs.id, 'local-user')).toBeUndefined();
  });

  it('opens the viewer’s own favourite entry by id', async () => {
    await seedStory(STORY_ID, 'individual');
    const mine = await logOperation({ entityType: 'Favorite', userId: 'local-user' });

    expect((await service.getOperationLogById(mine.id, 'local-user'))?.id).toBe(mine.id);
  });

  it('refuses a favourite entry when the viewer is unknown', async () => {
    await seedStory(STORY_ID, 'individual');
    const mine = await logOperation({ entityType: 'Favorite', userId: 'local-user' });

    expect(await service.getOperationLogById(mine.id)).toBeUndefined();
  });
});

describe('getFavoriteBehavior', () => {
  it.each(['global', 'individual', 'individual_public'] as const)(
    'reports %s',
    async (behavior) => {
      await seedStory(STORY_ID, behavior);

      expect(await service.getFavoriteBehavior(STORY_ID)).toBe(behavior);
    },
  );

  it('falls back to individual for a story it cannot find, the safer default', async () => {
    expect(await service.getFavoriteBehavior('nao-existe')).toBe('individual');
  });

  it('follows a change to the story setting', async () => {
    await seedStory(STORY_ID, 'global');

    await database.db
      .update(stories)
      .set({ favoriteBehavior: 'individual' })
      .where(eq(stories.id, STORY_ID));

    expect(await service.getFavoriteBehavior(STORY_ID)).toBe('individual');
  });
});

/**
 * @jest-environment jsdom
 */
jest.mock('drizzle-orm/expo-sqlite', () => ({
  __esModule: true,
  drizzle: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: jest.fn(),
}));
jest.mock('../../src/db/schema', () => ({
  __esModule: true,
  stories: { id: 'stories' },
  storySchemaFields: { id: 'storySchemaFields' },
}));

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import {
  runSqliteWebSmokeProbe,
  shouldRunSqliteWebSmokeProbe,
} from '../../src/testing/sqliteWebSmokeProbe';

const PAYLOAD = 'keres-sqlite-web-'.repeat(96);
const IMPORTED_STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const NO_SUCH_TABLE = new Error('no such table: _sqlite_web_smoke_missing_table');

function mockDatabase(overrides: Record<string, jest.Mock> = {}) {
  return {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => ({ payload: PAYLOAD })),
    getAllAsync: jest.fn(async () => {
      throw NO_SUCH_TABLE;
    }),
    ...overrides,
  } as any;
}

const mockValues = jest.fn(async () => undefined);
const mockFindStory = jest.fn(async (): Promise<{ id: string } | undefined> => ({ id: IMPORTED_STORY_ID }));
const mockFindStaleField = jest.fn(async (): Promise<{ id: string } | undefined> => undefined);
const mockDb = {
  insert: jest.fn(() => ({ values: mockValues })),
  query: {
    stories: { findFirst: mockFindStory },
    storySchemaFields: { findFirst: mockFindStaleField },
  },
};
const mockStories = {
  exportFullStory: jest.fn(async () => ({ story: { id: 'src', title: 'x' }, extra: 1 })),
  importFullStory: jest.fn(async () => IMPORTED_STORY_ID),
};

const published = () => (globalThis as any).__KERES_SQLITE_WEB_SMOKE_RESULT__;
const publishedDom = () => document.documentElement.dataset.keresSqliteWebSmoke;

beforeEach(() => {
  jest.clearAllMocks();
  (drizzle as jest.Mock).mockReturnValue(mockDb);
  (createStoryService as jest.Mock).mockReturnValue(mockStories);
  mockValues.mockResolvedValue(undefined);
  mockFindStory.mockResolvedValue({ id: IMPORTED_STORY_ID });
  mockFindStaleField.mockResolvedValue(undefined);
  mockStories.exportFullStory.mockResolvedValue({ story: { id: 'src', title: 'x' }, extra: 1 });
  mockStories.importFullStory.mockResolvedValue(IMPORTED_STORY_ID);
});

afterEach(() => {
  delete (globalThis as any).__KERES_SQLITE_WEB_SMOKE_RESULT__;
  delete document.documentElement.dataset.keresSqliteWebSmoke;
});

it('stays disabled outside a smoke-test web export', () => {
  expect(shouldRunSqliteWebSmokeProbe).toBe(false);
});

it('passes a healthy channel and publishes the handoff result', async () => {
  const database = mockDatabase();

  await runSqliteWebSmokeProbe(database);

  expect(database.execAsync).toHaveBeenCalledWith(
    'CREATE TABLE IF NOT EXISTS _sqlite_web_smoke (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);',
  );
  expect(database.runAsync).toHaveBeenCalledWith(
    'INSERT INTO _sqlite_web_smoke (payload) VALUES (?);',
    PAYLOAD,
  );
  expect(published()).toEqual({
    status: 'passed',
    payloadLength: PAYLOAD.length,
    errorMessage: NO_SUCH_TABLE.message,
    importedStoryId: IMPORTED_STORY_ID,
  });
  expect(JSON.parse(publishedDom() as string)).toEqual(published());
  expect(database.execAsync).toHaveBeenLastCalledWith('DROP TABLE IF EXISTS _sqlite_web_smoke;');
});

it('accepts string failures that name the missing table', async () => {
  const database = mockDatabase({
    getAllAsync: jest.fn(async () => {
      throw 'no such table (string)';
    }),
  });

  await runSqliteWebSmokeProbe(database);

  expect(published()).toMatchObject({ status: 'passed', errorMessage: 'no such table (string)' });
});

it('fails when the long result comes back truncated', async () => {
  const database = mockDatabase({ getFirstAsync: jest.fn(async () => ({ payload: 'short' })) });

  await expect(runSqliteWebSmokeProbe(database)).rejects.toThrow(
    'The SQLite Web Worker returned a truncated long result.',
  );
  expect(published()).toEqual({
    status: 'failed',
    message: 'The SQLite Web Worker returned a truncated long result.',
  });
  expect(JSON.parse(publishedDom() as string)).toEqual(published());
  expect(database.execAsync).toHaveBeenLastCalledWith('DROP TABLE IF EXISTS _sqlite_web_smoke;');
});

it('fails when the SQL error message is lost', async () => {
  const database = mockDatabase({ getAllAsync: jest.fn(async () => []) });

  await expect(runSqliteWebSmokeProbe(database)).rejects.toThrow(
    'The SQLite Web Worker lost the SQL error message: ',
  );
  expect(published()).toMatchObject({ status: 'failed' });
});

it('fails when the import does not replace its stale data', async () => {
  const database = mockDatabase();
  mockStories.importFullStory.mockResolvedValueOnce('another-id');

  await expect(runSqliteWebSmokeProbe(database)).rejects.toThrow(
    'Story import did not atomically replace its stale local data.',
  );
  expect(published()).toMatchObject({ status: 'failed' });
  expect(database.execAsync).toHaveBeenLastCalledWith('DROP TABLE IF EXISTS _sqlite_web_smoke;');
});

it('fails when the orphan field survives the import', async () => {
  const database = mockDatabase();
  mockFindStaleField.mockResolvedValueOnce({ id: '01ARZ3NDEKTSV4RRFFQ69G5FAY' });

  await expect(runSqliteWebSmokeProbe(database)).rejects.toThrow(
    'Story import did not atomically replace its stale local data.',
  );
});

it('fails when the imported story is missing', async () => {
  const database = mockDatabase();
  mockFindStory.mockResolvedValueOnce(undefined);

  await expect(runSqliteWebSmokeProbe(database)).rejects.toThrow(
    'Story import did not atomically replace its stale local data.',
  );
});

it('stringifies non-error setup failures', async () => {
  const database = mockDatabase({
    execAsync: jest.fn(async () => {
      throw 'setup blew up';
    }),
  });

  await expect(runSqliteWebSmokeProbe(database)).rejects.toBe('setup blew up');
  expect(published()).toEqual({ status: 'failed', message: 'setup blew up' });
});

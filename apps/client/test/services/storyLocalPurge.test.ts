/**
 * @jest-environment node
 */
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import {
  purgeStoryLocally,
  STORY_CHILD_TABLES,
} from '../../src/services/storymanagement/storyLocalPurge';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = 'story-to-purge';
const OTHER_STORY_ID = 'other-story';

let database: TestDatabase;

const now = new Date('2026-09-04T12:00:00.000Z');

beforeEach(async () => {
  database = await createTestDatabase();
  await database.db.insert(schema.servers).values({
    id: 'server-1',
    idUser: 'remote-user',
    userName: 'Remote User',
    tag: null,
    name: 'Server',
    url: 'https://server.example',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  });
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'Story to purge',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  });
});

afterEach(() => database.close());

const tableHasStoryId = (value: unknown): boolean => {
  try {
    return 'storyId' in getTableColumns(value as any);
  } catch {
    return false;
  }
};

describe('story local purge', () => {
  it('covers every table directly owned by a story', () => {
    const schemaTablesWithStoryId = Object.values(schema)
      .filter(tableHasStoryId)
      .map((table) => getTableName(table as any))
      .sort();

    expect(STORY_CHILD_TABLES.map(getTableName).sort()).toEqual(schemaTablesWithStoryId);
  });

  it('removes publication cache and detaches packs without deleting their snapshots', async () => {
    await database.db.insert(schema.storyPublications).values({
      id: 'publication-1',
      serverId: 'server-1',
      storyId: STORY_ID,
      label: 'Publicação',
      operationVersion: 5,
      byteSize: 1024,
      createdAt: now,
      notified: false,
    });
    await database.db.insert(schema.packs).values([
      {
        id: 'pack-from-story',
        name: 'Pack preservado',
        description: null,
        language: null,
        authorName: null,
        version: 1,
        visibility: 'private',
        content: '{}',
        sourceStoryId: STORY_ID,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'other-pack',
        name: 'Outro pack',
        description: null,
        language: null,
        authorName: null,
        version: 1,
        visibility: 'private',
        content: '{}',
        sourceStoryId: OTHER_STORY_ID,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await purgeStoryLocally(database.db, STORY_ID);

    await expect(
      database.db.query.stories.findFirst({ where: (stories, { eq }) => eq(stories.id, STORY_ID) }),
    ).resolves.toBeUndefined();
    await expect(
      database.db.query.storyPublications.findFirst({
        where: (publications, { eq }) => eq(publications.storyId, STORY_ID),
      }),
    ).resolves.toBeUndefined();
    await expect(
      database.db.query.packs.findFirst({
        where: (packs, { eq }) => eq(packs.id, 'pack-from-story'),
      }),
    ).resolves.toMatchObject({ sourceStoryId: null, content: '{}' });
    await expect(
      database.db.query.packs.findFirst({ where: (packs, { eq }) => eq(packs.id, 'other-pack') }),
    ).resolves.toMatchObject({ sourceStoryId: OTHER_STORY_ID });
  });
});

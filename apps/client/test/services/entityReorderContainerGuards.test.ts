/**
 * @jest-environment node
 */
import { AttributeType } from '@keres/shared';
import * as schema from '../../src/db/schema';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { createStatService } from '../../src/services/storymanagement/StatService';
import { createStorySchemaFieldService } from '../../src/services/storymanagement/StorySchemaFieldService';
import { entityBase, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * A reorder bases its operation on the container's bumped version. When the container
 * row is gone (a stale screen, a half-purged story), the bump returns no row - and logging
 * the operation anyway would queue a versionless op the push silently skips forever (for
 * updates/deletes) or that conflicts spuriously (for reorders). Fail fast instead, with
 * nothing queued.
 */

const GHOST_STORY_ID = 'ghost-story';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

const loggedOperations = () => database.db.query.operationLogs.findMany();

describe('reorder container guards', () => {
  it('refuses a chapter reorder when the story row is gone', async () => {
    await database.db.insert(schema.chapters).values([
      { id: 'c1', storyId: GHOST_STORY_ID, name: 'One', index: 1, ...entityBase, deletedAt: null },
      { id: 'c2', storyId: GHOST_STORY_ID, name: 'Two', index: 2, ...entityBase, deletedAt: null },
    ]);
    const service = createChapterService(database.db);

    await expect(
      service.reorderChapters(TEST_USER_ID, GHOST_STORY_ID, [
        { id: 'c2', newIndex: 1 },
        { id: 'c1', newIndex: 2 },
      ]),
    ).rejects.toThrow();
    expect(await loggedOperations()).toHaveLength(0);
  });

  it('refuses a scene reorder when the chapter row is gone', async () => {
    await database.db.insert(schema.scenes).values([
      {
        id: 's1',
        storyId: GHOST_STORY_ID,
        chapterId: 'ghost-chapter',
        name: 'One',
        index: 1,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 's2',
        storyId: GHOST_STORY_ID,
        chapterId: 'ghost-chapter',
        name: 'Two',
        index: 2,
        ...entityBase,
        deletedAt: null,
      },
    ]);
    const service = createSceneService(database.db);

    await expect(
      service.reorderScenes(TEST_USER_ID, GHOST_STORY_ID, 'ghost-chapter', [
        { id: 's2', newIndex: 1 },
        { id: 's1', newIndex: 2 },
      ]),
    ).rejects.toThrow();
    expect(await loggedOperations()).toHaveLength(0);
  });

  it('refuses a stat reorder when the story row is gone', async () => {
    await database.db.insert(schema.stats).values([
      { id: 'st1', storyId: GHOST_STORY_ID, name: 'One', order: 0, ...entityBase, deletedAt: null },
      { id: 'st2', storyId: GHOST_STORY_ID, name: 'Two', order: 1, ...entityBase, deletedAt: null },
    ]);
    const service = createStatService(database.db);

    await expect(
      service.reorderStats(TEST_USER_ID, GHOST_STORY_ID, [
        { id: 'st1', order: 1 },
        { id: 'st2', order: 0 },
      ]),
    ).rejects.toThrow();
    expect(await loggedOperations()).toHaveLength(0);
  });

  it('refuses a schema-field reorder when the story row is gone', async () => {
    await database.db.insert(schema.storySchemaFields).values([
      {
        id: 'f1',
        storyId: GHOST_STORY_ID,
        entityType: 'Character',
        name: 'One',
        key: 'one',
        type: AttributeType.TEXT,
        order: 0,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 'f2',
        storyId: GHOST_STORY_ID,
        entityType: 'Character',
        name: 'Two',
        key: 'two',
        type: AttributeType.TEXT,
        order: 1,
        ...entityBase,
        deletedAt: null,
      },
    ]);
    const service = createStorySchemaFieldService(database.db);

    await expect(
      service.reorderFields(TEST_USER_ID, GHOST_STORY_ID, 'Character', [
        { id: 'f1', order: 1 },
        { id: 'f2', order: 0 },
      ]),
    ).rejects.toThrow();
    expect(await loggedOperations()).toHaveLength(0);
  });
});

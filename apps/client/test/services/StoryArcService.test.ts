/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStoryArcService } from '../../src/services/storymanagement/StoryArcService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const service = () => createStoryArcService(database.db);

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('StoryArcService', () => {
  it('creates an arc and logs version 1', async () => {
    const created = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Livro I',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });

    expect(created).toMatchObject({ title: 'Livro I', version: 1, isDefault: true });
    const [operation] = await operations();
    expect(operation).toMatchObject({
      entityType: 'StoryArc',
      operationType: 'create',
      entityId: created.id,
    });
    expect(payloadOf(operation).version).toBe(1);
  });

  it('logs the bumped version on update so push can derive OCC baseVersion', async () => {
    const created = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Livro I',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });

    const updated = await service().updateArc(TEST_USER_ID, created.id, { title: 'Livro II' });
    expect(updated).toMatchObject({ title: 'Livro II', version: 2 });

    const logged = await operations();
    const update = logged.find((entry) => entry.operationType === 'update');
    expect(update).toBeDefined();
    expect(payloadOf(update!).version).toBe(2);
  });

  it('bumps version and logs it on delete so the server accepts OCC', async () => {
    await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Default',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });
    const secondary = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Side quest',
      description: null,
      sortOrder: 1,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: false,
    });

    await service().deleteArc(TEST_USER_ID, secondary.id);

    expect(await service().getById(secondary.id)).toMatchObject({
      isDeleted: true,
      version: 2,
    });
    const logged = await operations();
    const deletion = logged.find(
      (entry) => entry.operationType === 'delete' && entry.entityId === secondary.id,
    );
    expect(deletion).toBeDefined();
    expect(payloadOf(deletion!)).toMatchObject({
      id: secondary.id,
      isDeleted: true,
      version: 2,
    });
  });

  it('refuses to delete the default arc, which chapters fall back to', async () => {
    const created = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Default',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });

    await expect(service().deleteArc(TEST_USER_ID, created.id)).rejects.toThrow(
      'default arc cannot be deleted',
    );
  });

  it('repoints the deleted arc chapters at the default arc', async () => {
    const fallback = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Default',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });
    const doomed = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Side quest',
      description: null,
      sortOrder: 1,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: false,
    });
    await database.db.insert(schema.chapters).values({
      id: 'chapter-1',
      storyId: TEST_STORY_ID,
      name: 'Chapter one',
      index: 1,
      arcId: doomed.id,
      ...entityBase,
      deletedAt: null,
    });

    await service().deleteArc(TEST_USER_ID, doomed.id);

    const chapter = await database.db.query.chapters.findFirst({
      where: eq(schema.chapters.id, 'chapter-1'),
    });
    expect(chapter?.arcId).toBe(fallback.id);
  });

  it('lists the arcs a character, location or item appears in', async () => {
    const first = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'First',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });
    const second = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Second',
      description: null,
      sortOrder: 1,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: false,
    });
    await database.db.insert(schema.chapters).values([
      {
        id: 'chapter-1',
        storyId: TEST_STORY_ID,
        name: 'One',
        index: 1,
        arcId: first.id,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 'chapter-2',
        storyId: TEST_STORY_ID,
        name: 'Two',
        index: 2,
        arcId: second.id,
        ...entityBase,
        deletedAt: null,
      },
    ]);
    await database.db.insert(schema.scenes).values([
      {
        id: 'scene-1',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter-1',
        locationId: 'harbor',
        name: 'Arrival',
        index: 1,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 'scene-2',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter-2',
        locationId: 'forest',
        name: 'Departure',
        index: 1,
        ...entityBase,
        deletedAt: null,
      },
    ]);
    await database.db.insert(schema.characters).values({
      id: 'ada',
      storyId: TEST_STORY_ID,
      name: 'Ada',
      ...entityBase,
    });
    await database.db.insert(schema.characterScenes).values({
      id: 'cs-1',
      storyId: TEST_STORY_ID,
      characterId: 'ada',
      sceneId: 'scene-1',
      ...entityBase,
      deletedAt: null,
    });
    await database.db.insert(schema.items).values({
      id: 'compass',
      storyId: TEST_STORY_ID,
      name: 'Compass',
      ...entityBase,
      deletedAt: null,
    });
    await database.db.insert(schema.itemJourneys).values({
      id: 'journey-1',
      storyId: TEST_STORY_ID,
      itemId: 'compass',
      sceneId: 'scene-2',
      newState: 'lost',
      ...entityBase,
      deletedAt: null,
    });

    // Each walk crosses tombstone guards on every joined table: one deleted scene anywhere in
    // the chain removes the arc from the answer.
    expect(
      (await service().listArcsForCharacter(TEST_STORY_ID, 'ada')).map((arc) => arc.id),
    ).toEqual([first.id]);
    expect(
      (await service().listArcsForLocation(TEST_STORY_ID, 'harbor')).map((arc) => arc.id),
    ).toEqual([first.id]);
    expect(
      (await service().listArcsForItem(TEST_STORY_ID, 'compass')).map((arc) => arc.id),
    ).toEqual([second.id]);
    expect(await service().listArcsForCharacter(TEST_STORY_ID, 'nobody')).toEqual([]);
    expect(await service().listArcsForLocation(TEST_STORY_ID, 'nowhere')).toEqual([]);
    expect(await service().listArcsForItem(TEST_STORY_ID, 'nothing')).toEqual([]);
  });

  it('groups arc ids per linked entity in one query per kind', async () => {
    const first = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'First',
      description: null,
      sortOrder: 0,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: true,
    });
    const second = await service().createArc(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Second',
      description: null,
      sortOrder: 1,
      color: null,
      icon: null,
      themeOverride: null,
      isDefault: false,
    });
    await database.db.insert(schema.chapters).values([
      {
        id: 'chapter-1',
        storyId: TEST_STORY_ID,
        name: 'One',
        index: 1,
        arcId: first.id,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 'chapter-2',
        storyId: TEST_STORY_ID,
        name: 'Two',
        index: 2,
        arcId: second.id,
        ...entityBase,
        deletedAt: null,
      },
    ]);
    await database.db.insert(schema.scenes).values([
      {
        id: 'scene-1',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter-1',
        locationId: 'harbor',
        name: 'Arrival',
        index: 1,
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 'scene-2',
        storyId: TEST_STORY_ID,
        chapterId: 'chapter-2',
        locationId: 'forest',
        name: 'Departure',
        index: 1,
        ...entityBase,
        deletedAt: null,
      },
    ]);
    await database.db.insert(schema.characters).values([
      {
        id: 'ada',
        storyId: TEST_STORY_ID,
        name: 'Ada',
        ...entityBase,
      },
      {
        id: 'bram',
        storyId: TEST_STORY_ID,
        name: 'Bram',
        ...entityBase,
      },
    ]);
    await database.db.insert(schema.characterScenes).values([
      {
        id: 'cs-1',
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        sceneId: 'scene-1',
        ...entityBase,
        deletedAt: null,
      },
      {
        id: 'cs-2',
        storyId: TEST_STORY_ID,
        characterId: 'ada',
        sceneId: 'scene-2',
        ...entityBase,
        deletedAt: null,
      },
      // A deleted link contributes nothing: Bram stays absent like an unlinked entity.
      {
        id: 'cs-3',
        storyId: TEST_STORY_ID,
        characterId: 'bram',
        sceneId: 'scene-1',
        ...entityBase,
        isDeleted: true,
        deletedAt: new Date(),
      },
    ]);
    await database.db.insert(schema.items).values({
      id: 'compass',
      storyId: TEST_STORY_ID,
      name: 'Compass',
      ...entityBase,
      deletedAt: null,
    });
    await database.db.insert(schema.itemJourneys).values({
      id: 'journey-1',
      storyId: TEST_STORY_ID,
      itemId: 'compass',
      sceneId: 'scene-2',
      newState: 'lost',
      ...entityBase,
      deletedAt: null,
    });

    const characters = await service().listEntityArcIds(TEST_STORY_ID, 'character');
    expect([...characters.keys()].sort()).toEqual(['ada']);
    expect([...(characters.get('ada') ?? [])].sort()).toEqual([first.id, second.id].sort());

    const locations = await service().listEntityArcIds(TEST_STORY_ID, 'location');
    expect(locations.get('harbor')).toEqual([first.id]);
    expect(locations.get('forest')).toEqual([second.id]);
    expect(locations.has('nowhere')).toBe(false);

    const items = await service().listEntityArcIds(TEST_STORY_ID, 'item');
    expect(items.get('compass')).toEqual([second.id]);
    expect(items.has('nothing')).toBe(false);
  });
});

/**
 * @jest-environment node
 */
import { compareRanked } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import {
  createScenePageService,
  groupPagesByScene,
  pageHasMedia,
} from '../../src/services/storymanagement/ScenePageService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const service = () => createScenePageService(database.db);

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

async function seedScene(id: string, overrides: Partial<typeof schema.scenes.$inferInsert> = {}) {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId: null,
    locationId: null,
    name: id,
    index: 1,
    rank: 'a0',
    ...entityBase,
    ...overrides,
  } as never);
}

const addPage = (sceneId: string, media: { sketchId: string } | { galleryId: string }, rest = {}) =>
  service().createPage(TEST_USER_ID, { storyId: TEST_STORY_ID, sceneId, media, ...rest });

const textsOf = async (sceneId: string) =>
  (await service().getPagesForScene(sceneId)).map((page) => page.text);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedScene('scene-1');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('ScenePageService', () => {
  it('creates a page with one image, a fit and its text, and logs version 1', async () => {
    const page = await addPage('scene-1', { galleryId: 'g-1' }, { text: 'Panel 1', fit: 'cover' });

    expect(page).toMatchObject({
      sceneId: 'scene-1',
      galleryId: 'g-1',
      sketchId: null,
      fit: 'cover',
      text: 'Panel 1',
      version: 1,
    });
    const [operation] = await operations();
    expect(operation).toMatchObject({
      entityType: 'ScenePage',
      operationType: 'create',
      entityId: page.id,
    });
    expect(payloadOf(operation)).toMatchObject({ galleryId: 'g-1', sketchId: null, version: 1 });
  });

  it('starts a page from a sketch just as well, and contains the image by default', async () => {
    const page = await addPage('scene-1', { sketchId: 'sk-1' });

    expect(page).toMatchObject({ sketchId: 'sk-1', galleryId: null, fit: 'contain', text: null });
  });

  it("keeps a scene's pages in the order they were added, each after the last", async () => {
    await addPage('scene-1', { galleryId: 'g' }, { text: 'one' });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'two' });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'three' });

    expect(await textsOf('scene-1')).toEqual(['one', 'two', 'three']);
  });

  it('adds a page at a place among the others, and clamps a place off the ends', async () => {
    await addPage('scene-1', { galleryId: 'g' }, { text: 'one' });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'three' });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'two', position: 1 });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'first', position: -5 });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'last', position: 99 });

    expect(await textsOf('scene-1')).toEqual(['first', 'one', 'two', 'three', 'last']);
  });

  it('moves one page by changing only its own rank and logging only that update', async () => {
    const one = await addPage('scene-1', { galleryId: 'g' }, { text: 'one' });
    const two = await addPage('scene-1', { galleryId: 'g' }, { text: 'two' });
    const three = await addPage('scene-1', { galleryId: 'g' }, { text: 'three' });

    const moved = await service().movePage(TEST_USER_ID, three.id, 0);

    expect(await textsOf('scene-1')).toEqual(['three', 'one', 'two']);
    expect(moved.version).toBe(2);
    // The others were not written at all.
    for (const untouched of [one, two]) {
      const row = await service().getById(untouched.id);
      expect(row?.version).toBe(1);
      expect(row?.rank).toBe(untouched.rank);
    }
    const log = (await operations()).filter((operation) => operation.operationType === 'update');
    expect(log).toHaveLength(1);
    expect(payloadOf(log[0])).toMatchObject({ rank: moved.rank });
    expect(Object.keys(payloadOf(log[0]))).not.toContain('text');
  });

  it('moves a page down and to the end', async () => {
    const one = await addPage('scene-1', { galleryId: 'g' }, { text: 'one' });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'two' });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'three' });

    await service().movePage(TEST_USER_ID, one.id, 2);
    expect(await textsOf('scene-1')).toEqual(['two', 'three', 'one']);

    await service().movePage(TEST_USER_ID, one.id, 99);
    expect(await textsOf('scene-1')).toEqual(['two', 'three', 'one']);
  });

  it('edits the text and the fit, trims an empty text to nothing and skips a change that changes nothing', async () => {
    const page = await addPage('scene-1', { galleryId: 'g' }, { text: 'one' });

    const edited = await service().updatePage(TEST_USER_ID, page.id, {
      text: 'one, edited',
      fit: 'cover',
    });
    expect(edited).toMatchObject({ text: 'one, edited', fit: 'cover', version: 2 });
    const same = await service().updatePage(TEST_USER_ID, page.id, { fit: 'cover' });
    expect(same.version).toBe(2);
    const cleared = await service().updatePage(TEST_USER_ID, page.id, { text: '   ' });
    expect(cleared.text).toBeNull();
    expect(cleared.version).toBe(3);
  });

  it('replaces the image with another kind, clearing the old one in the same change', async () => {
    const page = await addPage('scene-1', { galleryId: 'g-1' }, { text: 'keep me' });

    const replaced = await service().replaceMedia(TEST_USER_ID, page.id, { sketchId: 'sk-9' });

    expect(replaced).toMatchObject({ sketchId: 'sk-9', galleryId: null, text: 'keep me' });
    const log = (await operations()).filter((operation) => operation.operationType === 'update');
    expect(payloadOf(log[0])).toMatchObject({ sketchId: 'sk-9', galleryId: null });
    expect(Object.keys(payloadOf(log[0]))).not.toContain('text');
  });

  it('deletes a page as a tombstone and leaves it out of the scene', async () => {
    const page = await addPage('scene-1', { galleryId: 'g' }, { text: 'one' });
    await addPage('scene-1', { galleryId: 'g' }, { text: 'two' });

    await service().deletePage(TEST_USER_ID, page.id);

    expect(await textsOf('scene-1')).toEqual(['two']);
    expect((await service().getById(page.id))?.isDeleted).toBe(true);
    const last = (await operations()).at(-1);
    expect(last).toMatchObject({ entityType: 'ScenePage', operationType: 'delete' });
  });

  it('ignores the delete of a page that is not there', async () => {
    await expect(service().deletePage(TEST_USER_ID, 'nope')).resolves.toBeUndefined();
  });

  it('refuses to change or move a page that is not there', async () => {
    await expect(service().updatePage(TEST_USER_ID, 'nope', { fit: 'cover' })).rejects.toThrow();
    await expect(service().movePage(TEST_USER_ID, 'nope', 0)).rejects.toThrow();
    await expect(service().replaceMedia(TEST_USER_ID, 'nope', { sketchId: 's' })).rejects.toThrow();
  });

  it('reads the pages of the story by scene and leaves out those of a deleted scene', async () => {
    await seedScene('scene-2');
    await seedScene('scene-3');
    await addPage('scene-1', { galleryId: 'g' }, { text: 'a1' });
    await addPage('scene-2', { galleryId: 'g' }, { text: 'b1' });
    await addPage('scene-2', { galleryId: 'g' }, { text: 'b2' });
    await addPage('scene-3', { galleryId: 'g' }, { text: 'c1' });
    await database.db
      .update(schema.scenes)
      .set({ isDeleted: true })
      .where(eq(schema.scenes.id, 'scene-3'));

    const pages = await service().getPagesForStory(TEST_STORY_ID);

    expect(pages.map((page) => page.text)).toEqual(['a1', 'b1', 'b2']);
    const grouped = groupPagesByScene(pages);
    expect([...grouped.keys()]).toEqual(['scene-1', 'scene-2']);
    expect(grouped.get('scene-2')?.map((page) => page.text)).toEqual(['b1', 'b2']);
  });

  it('gives an empty story no pages', async () => {
    await database.db.delete(schema.scenes);
    expect(await service().getPagesForStory(TEST_STORY_ID)).toEqual([]);
  });

  it('tells a page that lost its image from one that has it', async () => {
    const page = await addPage('scene-1', { galleryId: 'g' }, { text: 'one' });
    expect(pageHasMedia(page)).toBe(true);
    expect(pageHasMedia({ ...page, galleryId: null })).toBe(false);
    expect(pageHasMedia({ ...page, galleryId: null, sketchId: 'sk' })).toBe(true);
  });

  it('refuses to write to a story that is read-only to this person', async () => {
    await database.db
      .update(schema.stories)
      .set({ serverId: 'srv', myRole: 'reader' } as never)
      .where(eq(schema.stories.id, TEST_STORY_ID));

    await expect(addPage('scene-1', { galleryId: 'g' })).rejects.toThrow();
  });

  it('orders by rank then id, the one order every device uses', () => {
    const rows = [
      { rank: 'a1', id: 'b' },
      { rank: 'a1', id: 'a' },
      { rank: 'a0', id: 'z' },
    ];

    expect([...rows].sort(compareRanked).map((row) => row.id)).toEqual(['z', 'a', 'b']);
  });
});

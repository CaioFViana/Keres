/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { scenePageViewOf } from '../../src/hooks/useScenePages';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { createScenePageService } from '../../src/services/storymanagement/ScenePageService';
import { createSketchService } from '../../src/services/storymanagement/SketchService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

async function seedScene() {
  await database.db.insert(schema.scenes).values({
    id: 'scene-1',
    storyId: TEST_STORY_ID,
    chapterId: null,
    locationId: null,
    name: 'Scene',
    index: 1,
    rank: 'a0',
    ...entityBase,
  } as never);
}

const newImage = (fileName: string) =>
  createGalleryService(database.db).createGallery(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName,
    hash: fileName,
    sizeBytes: 1,
    localPath: `/media/${fileName}`,
    title: fileName,
  } as never);

const pageWith = (media: { galleryId: string } | { sketchId: string }) =>
  createScenePageService(database.db).createPage(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    sceneId: 'scene-1',
    media,
  });

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedScene();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('scenePageViewOf', () => {
  it('shows a Gallery page by its own medium and name', async () => {
    const image = await newImage('panel.png');
    const page = await pageWith({ galleryId: image.id });

    expect(await scenePageViewOf(database.db, page)).toEqual({
      page,
      thumbGalleryId: image.id,
      mediaName: 'panel.png',
      isSketch: false,
      mediaGone: false,
    });
  });

  it('shows a Sketch page by the cover of its Sketch, and by nothing while it has none', async () => {
    const sketch = await createSketchService(database.db).createSketch(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Throne room',
    } as never);
    const page = await pageWith({ sketchId: sketch.id });

    expect(await scenePageViewOf(database.db, page)).toMatchObject({
      thumbGalleryId: null,
      mediaName: 'Throne room',
      isSketch: true,
      mediaGone: false,
    });

    const cover = await newImage('cover.png');
    await createSketchService(database.db).updateSketch(TEST_USER_ID, sketch.id, {
      coverGalleryId: cover.id,
    });
    expect(await scenePageViewOf(database.db, page)).toMatchObject({ thumbGalleryId: cover.id });
  });

  it('calls a page whose medium was deleted "media removed", keeping the page', async () => {
    const image = await newImage('gone.png');
    const page = await pageWith({ galleryId: image.id });
    await database.db
      .update(schema.galleries)
      .set({ isDeleted: true })
      .where(eq(schema.galleries.id, image.id));

    expect(await scenePageViewOf(database.db, page)).toMatchObject({
      thumbGalleryId: null,
      mediaName: null,
      mediaGone: true,
    });
  });

  it('calls a page whose Sketch is deleted or never existed "media removed"', async () => {
    const page = await pageWith({ sketchId: 'never-there' });
    expect(await scenePageViewOf(database.db, page)).toMatchObject({
      isSketch: true,
      mediaGone: true,
    });
  });

  it('calls a page with neither id (both cleared by the sync) "media removed"', async () => {
    const image = await newImage('x.png');
    const page = await pageWith({ galleryId: image.id });

    expect(
      await scenePageViewOf(database.db, { ...page, galleryId: null, sketchId: null }),
    ).toMatchObject({ mediaGone: true, isSketch: false });
  });
});

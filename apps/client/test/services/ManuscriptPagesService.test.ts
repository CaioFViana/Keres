/**
 * @jest-environment node
 */
import { deflateSync } from 'node:zlib';
import * as schema from '../../src/db/schema';
import {
  estimateManuscriptPageBytes,
  loadManuscriptCover,
  loadManuscriptPages,
} from '../../src/services/storymanagement/ManuscriptPagesService';
import { createGalleryService } from '../../src/services/storymanagement/GalleryService';
import { createScenePageService } from '../../src/services/storymanagement/ScenePageService';
import { createSketchService } from '../../src/services/storymanagement/SketchService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const mockReadBytes = jest.fn();
const mockRasterize = jest.fn();

jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { readBytes: (...args: unknown[]) => mockReadBytes(...args) },
}));
jest.mock('../../src/utils/svgRaster', () => ({
  __esModule: true,
  fitRasterSize: (width: number, height: number) => ({ width, height }),
  rasterizeMapSvg: (...args: unknown[]) => mockRasterize(...args),
}));

/** A 2x1 PNG, enough for its header to be read. */
function tinyPng(): Uint8Array {
  const u32 = (value: number) => [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ];
  const header = [...u32(2), ...u32(1), 8, 2, 0, 0, 0];
  const chunk = (type: string, data: number[]) => [
    ...u32(data.length),
    ...[...type].map((char) => char.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0,
  ];
  return Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk('IHDR', header),
    ...chunk('IDAT', [...deflateSync(Buffer.from([0, 1, 2, 3, 4, 5, 6]))]),
    ...chunk('IEND', []),
  ]);
}

let database: TestDatabase;

async function seedScene(id: string) {
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId: null,
    locationId: null,
    name: id,
    index: 1,
    rank: 'a0',
    ...entityBase,
  } as never);
}

const newImage = (name: string, sizeBytes = 100) =>
  createGalleryService(database.db).createGallery(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: name,
    hash: name,
    sizeBytes,
    localPath: `/media/${name}`,
    title: name,
  } as never);

const pageOf = (
  sceneId: string,
  media: { galleryId: string } | { sketchId: string },
  text: string | null = null,
) =>
  createScenePageService(database.db).createPage(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    sceneId,
    media,
    text,
  });

const load = (sceneIds?: ReadonlySet<string>, readPictures?: boolean) =>
  loadManuscriptPages(database.db, TEST_USER_ID, TEST_STORY_ID, sceneIds, readPictures);

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await seedScene('scene-1');
  await seedScene('scene-2');
  mockReadBytes.mockReset().mockImplementation(async () => tinyPng());
  mockRasterize.mockReset().mockImplementation(async () => tinyPng());
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('loadManuscriptPages', () => {
  it('reads each picture once however many pages use it, and keeps the pages in order with their text', async () => {
    const image = await newImage('a.png');
    await pageOf('scene-1', { galleryId: image.id }, 'one');
    await pageOf('scene-1', { galleryId: image.id }, 'two');

    const { pagesByScene, media, problems } = await load();

    expect(mockReadBytes).toHaveBeenCalledTimes(1);
    expect(media[image.id]).toMatchObject({ mimeType: 'image/png', width: 2, height: 1 });
    expect(pagesByScene.get('scene-1')?.map((page) => [page.text, page.mediaId])).toEqual([
      ['one', image.id],
      ['two', image.id],
    ]);
    expect(problems).toEqual({ missing: 0, unsupported: 0, snapshot: 0 });
  });

  it('shows a Sketch by its drawing, without adding any Gallery row', async () => {
    const sketch = await createSketchService(database.db).createSketch(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Roughs',
    } as never);
    await pageOf('scene-1', { sketchId: sketch.id }, 'panel');
    await pageOf('scene-1', { sketchId: sketch.id }, 'panel again');

    const { pagesByScene, media } = await load();

    // Rendered once for both pages, straight from the content.
    expect(mockRasterize).toHaveBeenCalledTimes(1);
    expect(pagesByScene.get('scene-1')?.map((page) => [page.text, page.mediaId])).toEqual([
      ['panel', `sketch:${sketch.id}`],
      ['panel again', `sketch:${sketch.id}`],
    ]);
    expect(media[`sketch:${sketch.id}`]).toMatchObject({
      mimeType: 'image/png',
      width: 2,
      height: 1,
    });
    expect(database.db.select().from(schema.galleries).all()).toHaveLength(0);
  });

  it('keeps a page whose picture is gone as a page with its text, and counts it', async () => {
    const gone = await newImage('gone.png');
    await pageOf('scene-1', { galleryId: gone.id }, 'still here');
    await createGalleryService(database.db).deleteGallery(TEST_USER_ID, gone.id);
    await pageOf('scene-1', { sketchId: 'never-there' }, 'no sketch');

    const { pagesByScene, media, problems } = await load();

    expect(mockRasterize).not.toHaveBeenCalled();
    expect(pagesByScene.get('scene-1')?.map((page) => [page.text, page.mediaId])).toEqual([
      ['still here', null],
      ['no sketch', null],
    ]);
    expect(media).toEqual({});
    expect(problems.missing).toBe(2);
  });

  it('counts a medium it cannot embed, and a file that is not on the device', async () => {
    const gif = await newImage('anim.gif');
    const lost = await newImage('lost.png');
    await pageOf('scene-1', { galleryId: gif.id });
    await pageOf('scene-1', { galleryId: lost.id });
    mockReadBytes.mockImplementation(async (path: string) => {
      if (path.endsWith('lost.png')) throw new Error('ENOENT');
      return new TextEncoder().encode('GIF89a......');
    });

    const { media, problems } = await load();

    expect(media).toEqual({});
    expect(problems).toMatchObject({ unsupported: 1, missing: 1 });
  });

  it('counts a Sketch that could not be drawn, leaving the page without a picture', async () => {
    const sketch = await createSketchService(database.db).createSketch(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Roughs',
    } as never);
    await pageOf('scene-1', { sketchId: sketch.id }, 'text');
    mockRasterize.mockRejectedValue(new Error('no raster host'));

    const { pagesByScene, problems } = await load();

    expect(pagesByScene.get('scene-1')?.[0]).toMatchObject({ mediaId: null, text: 'text' });
    expect(problems.snapshot).toBe(1);
  });

  it('reads only the scenes asked for', async () => {
    const image = await newImage('a.png');
    await pageOf('scene-1', { galleryId: image.id });
    await pageOf('scene-2', { galleryId: image.id });

    const { pagesByScene } = await load(new Set(['scene-2']));

    expect([...pagesByScene.keys()]).toEqual(['scene-2']);
  });

  it('reads and draws nothing when no picture is wanted, but still says which pages have one', async () => {
    const image = await newImage('a.png');
    const sketch = await createSketchService(database.db).createSketch(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Roughs',
    } as never);
    await pageOf('scene-1', { galleryId: image.id }, 'a');
    await pageOf('scene-1', { sketchId: sketch.id }, 'b');
    await pageOf('scene-1', { sketchId: 'never-there' }, 'c');

    const { pagesByScene, media, problems } = await load(undefined, false);

    expect(mockReadBytes).not.toHaveBeenCalled();
    expect(mockRasterize).not.toHaveBeenCalled();
    expect(media).toEqual({});
    expect(pagesByScene.get('scene-1')?.map((page) => page.mediaId !== null)).toEqual([
      true,
      true,
      false,
    ]);
    expect(problems.missing).toBe(1);
  });
});

describe('estimateManuscriptPageBytes', () => {
  it('knows a medium by its recorded size and a Sketch by a generous guess, and a lost page by nothing', async () => {
    const image = await newImage('a.png', 12_345);
    await pageOf('scene-1', { galleryId: image.id });
    await pageOf('scene-1', { sketchId: 'sk-1' });
    await pageOf('scene-2', { galleryId: 'missing' });

    const sizes = await estimateManuscriptPageBytes(database.db, TEST_STORY_ID);

    expect(sizes.get('scene-1')).toEqual([12_345, 1_000_000]);
    expect(sizes.get('scene-2')).toEqual([0]);
  });
});

describe('loadManuscriptCover', () => {
  it('reads the picture of the cover, named by the medium it is', async () => {
    const cover = await newImage('cover.png');

    const loaded = await loadManuscriptCover(database.db, cover.id);

    expect(loaded?.key).toBe(`cover:${cover.id}`);
    expect(loaded?.image).toMatchObject({ mimeType: 'image/png', width: 2, height: 1 });
    expect(mockReadBytes).toHaveBeenCalledWith('/media/cover.png');
  });

  it('is nothing when there is no cover, or the medium is gone, not an image or not on this device', async () => {
    expect(await loadManuscriptCover(database.db, null)).toBeNull();
    expect(await loadManuscriptCover(database.db, 'nowhere')).toBeNull();

    const gone = await newImage('gone.png');
    await createGalleryService(database.db).deleteGallery(TEST_USER_ID, gone.id);
    expect(await loadManuscriptCover(database.db, gone.id)).toBeNull();

    const missing = await newImage('missing.png');
    mockReadBytes.mockRejectedValueOnce(new Error('no such file'));
    expect(await loadManuscriptCover(database.db, missing.id)).toBeNull();
  });

  it('is nothing for a file that is not a PNG or a JPEG', async () => {
    const odd = await newImage('odd.png');
    mockReadBytes.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    expect(await loadManuscriptCover(database.db, odd.id)).toBeNull();
  });
});

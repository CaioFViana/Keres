/**
 * @jest-environment node
 */
import { sketchContentHash } from '@keres/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createSketchService } from '../../src/services/storymanagement/SketchService';
import {
  ensureSketchSnapshot,
  saveSketchSnapshot,
} from '../../src/services/storymanagement/SketchSnapshotService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const mockSaveSnapshot = jest.fn();
const mockRasterize = jest.fn();

jest.mock('../../src/services/MediaFileService', () => ({
  __esModule: true,
  mediaFileService: { saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args) },
}));

jest.mock('../../src/utils/svgRaster', () => ({
  __esModule: true,
  fitRasterSize: (width: number, height: number) => ({ width, height }),
  rasterizeMapSvg: (...args: unknown[]) => mockRasterize(...args),
}));

let database: TestDatabase;
let snapshotCount: number;

const drawn = (sketchId: string) =>
  database.db.select().from(schema.sketches).where(eq(schema.sketches.id, sketchId)).get();

async function newSketch(name = 'Throne room') {
  return createSketchService(database.db).createSketch(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    name,
  } as never);
}

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  snapshotCount = 0;
  mockRasterize.mockImplementation(async () => new Uint8Array([snapshotCount]));
  // Every drawing gets its own file; the same drawing the same one.
  mockSaveSnapshot.mockImplementation(async (_story: string, _mime: string, bytes: Uint8Array) => ({
    localPath: `/media/${bytes[0]}.png`,
    hash: `hash-${bytes[0]}`,
    sizeBytes: bytes.length,
  }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
  mockSaveSnapshot.mockReset();
  mockRasterize.mockReset();
});

describe('SketchSnapshotService', () => {
  it('keeps the snapshot in the Gallery, makes it the cover and remembers the drawing it is of', async () => {
    const sketch = await newSketch();

    const first = await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id);

    expect(first).toMatchObject({ regenerated: true });
    const row = await drawn(sketch.id);
    expect(row?.coverGalleryId).toBe(first?.galleryId);
    expect(row?.coverSourceHash).toBe(sketchContentHash(sketch.content));
    expect(mockRasterize).toHaveBeenCalledTimes(1);
  });

  it('reuses a fresh snapshot without drawing it again', async () => {
    const sketch = await newSketch();
    const first = await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id);

    const second = await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id);

    expect(second).toEqual({ galleryId: first?.galleryId, regenerated: false });
    expect(mockRasterize).toHaveBeenCalledTimes(1);
  });

  it('makes a new snapshot once the drawing has changed, leaving the old one in the Gallery', async () => {
    const sketch = await newSketch();
    const first = await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id);
    const content = structuredClone(sketch.content);
    content.page.width += 100;
    await createSketchService(database.db).updateSketch(TEST_USER_ID, sketch.id, { content });
    snapshotCount = 1;

    const second = await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id);

    expect(second?.regenerated).toBe(true);
    expect(second?.galleryId).not.toBe(first?.galleryId);
    const media = database.db.select().from(schema.galleries).all();
    expect(media).toHaveLength(2);
    expect((await drawn(sketch.id))?.coverSourceHash).toBe(sketchContentHash(content));
  });

  it('treats a cover that predates the hash as stale, and a deleted or missing sketch as nothing', async () => {
    const sketch = await newSketch();
    await createSketchService(database.db).updateSketch(TEST_USER_ID, sketch.id, {
      coverGalleryId: 'old-cover',
    });

    const regenerated = await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id);
    expect(regenerated?.regenerated).toBe(true);
    expect(regenerated?.galleryId).not.toBe('old-cover');

    await createSketchService(database.db).deleteSketch(TEST_USER_ID, sketch.id);
    expect(await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id)).toBeNull();
    expect(await ensureSketchSnapshot(database.db, TEST_USER_ID, 'nope')).toBeNull();
  });

  it('reuses the Gallery row of a byte-identical snapshot', async () => {
    const sketch = await newSketch();
    const other = await newSketch('Same drawing');

    const a = await ensureSketchSnapshot(database.db, TEST_USER_ID, sketch.id);
    const b = await ensureSketchSnapshot(database.db, TEST_USER_ID, other.id);

    expect(b?.galleryId).toBe(a?.galleryId);
    expect(database.db.select().from(schema.galleries).all()).toHaveLength(1);
  });

  it('saves a snapshot of the document it is given', async () => {
    const sketch = await newSketch();
    const doc = {
      page: sketch.content.page,
      layers: [],
      overlays: [],
    };

    const updated = await saveSketchSnapshot(database.db, TEST_USER_ID, sketch, doc);

    expect(updated.coverGalleryId).toBeTruthy();
    expect(updated.coverSourceHash).not.toBe(sketchContentHash(sketch.content));
  });
});

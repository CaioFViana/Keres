import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters, locations, scenes, stories, users } from '../../src/db/schema';
import { StoryExportImportService } from '../../src/services/StoryExportImportService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

const OWNER_ID = newId();
const IMPORTER_ID = newId();
const ORIGINAL_STORY_ID = newId();
const ORIGINAL_CHAPTER_ID = newId();
const ORIGINAL_LOCATION_ID = newId();
const ORIGINAL_SCENE_ID = newId();

const OLD = new Date('2020-01-01T00:00:00.000Z');

let service: StoryExportImportService;

/** Coleções que todo pacote precisa trazer, mesmo vazias. */
const EMPTY_COLLECTIONS = {
  chapters: [],
  scenes: [],
  choices: [],
  characters: [],
  locations: [],
  worldRules: [],
  notes: [],
  noteRelations: [],
  tags: [],
  tagRelations: [],
  suggestions: [],
  characterRelations: [],
  characterScenes: [],
  galleryItems: [],
  itemJourneys: [],
};

const chapter = (id = ORIGINAL_CHAPTER_ID) => ({
  id,
  storyId: ORIGINAL_STORY_ID,
  name: 'Capítulo 1',
  index: 1,
  summary: null,
  isFavorite: false,
  extraNotes: null,
  createdAt: OLD,
  updatedAt: OLD,
  version: 7,
  isDeleted: false,
  deletedAt: null,
});

const location = (id = ORIGINAL_LOCATION_ID) => ({
  id,
  storyId: ORIGINAL_STORY_ID,
  name: 'Ávalon',
  description: null,
  climate: null,
  culture: null,
  politics: null,
  isFavorite: false,
  extraNotes: null,
  createdAt: OLD,
  updatedAt: OLD,
  version: 3,
  isDeleted: false,
  deletedAt: null,
});

const scene = (overrides: Record<string, unknown> = {}) => ({
  id: ORIGINAL_SCENE_ID,
  storyId: ORIGINAL_STORY_ID,
  chapterId: ORIGINAL_CHAPTER_ID,
  locationId: ORIGINAL_LOCATION_ID,
  name: 'Abertura',
  index: 0,
  summary: null,
  gap: null,
  gapType: null,
  duration: null,
  durationType: null,
  isFinish: false,
  isStart: true,
  isFavorite: false,
  extraNotes: null,
  createdAt: OLD,
  updatedAt: OLD,
  version: 5,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

function buildExport(overrides: Record<string, unknown> = {}) {
  return {
    story: {
      id: ORIGINAL_STORY_ID,
      userId: OWNER_ID,
      title: 'A Queda',
      type: 'linear',
      isFavorite: true,
      favoriteBehavior: 'individual',
      normalizeSceneTiming: false,
      allowReaderComments: false,
      createdAt: OLD,
      updatedAt: OLD,
      version: 42,
      isDeleted: false,
      deletedAt: null,
    },
    ...EMPTY_COLLECTIONS,
    chapters: [chapter()],
    locations: [location()],
    scenes: [scene()],
    serverLastOperationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    ...overrides,
  };
}

const storyRow = (id: string) => db.query.stories.findFirst({ where: eq(stories.id, id) });

beforeEach(async () => {
  await truncateAll();
  await db.insert(users).values([
    { id: OWNER_ID, username: 'ana', tag: 'ana', password: 'x' },
    { id: IMPORTER_ID, username: 'bia', tag: 'bia', password: 'x' },
  ] as never);
  service = new StoryExportImportService();
});

describe('ownership and bookkeeping', () => {
  it('makes the importing user the owner, whatever the package claims', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    expect((await storyRow(storyId))!.userId).toBe(IMPORTER_ID);
  });

  it('resets every version to 1, so the imported story starts a fresh history', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    const [importedChapter] = await db.select().from(chapters).where(eq(chapters.storyId, storyId));
    const [importedScene] = await db.select().from(scenes).where(eq(scenes.storyId, storyId));
    expect((await storyRow(storyId))!.version).toBe(1);
    expect(importedChapter.version).toBe(1);
    expect(importedScene.version).toBe(1);
  });

  it('stamps the import time, not the timestamps from the package', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    expect((await storyRow(storyId))!.createdAt.getTime()).toBeGreaterThan(OLD.getTime());
  });

  it('keeps the story settings the author chose', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    expect(await storyRow(storyId)).toMatchObject({
      title: 'A Queda',
      type: 'linear',
      favoriteBehavior: 'individual',
    });
  });

  it('files every child entity under the new story', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    const importedScenes = await db.select().from(scenes).where(eq(scenes.storyId, storyId));
    expect(importedScenes).toHaveLength(1);
  });
});

describe('id remapping on a plain import', () => {
  it('gives the story a fresh id', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    expect(storyId).not.toBe(ORIGINAL_STORY_ID);
  });

  it('gives every child entity a fresh id', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    const [importedChapter] = await db.select().from(chapters).where(eq(chapters.storyId, storyId));
    const [importedLocation] = await db.select().from(locations).where(eq(locations.storyId, storyId));
    expect(importedChapter.id).not.toBe(ORIGINAL_CHAPTER_ID);
    expect(importedLocation.id).not.toBe(ORIGINAL_LOCATION_ID);
  });

  /** O ponto que importa: uma relação não pode continuar apontando para o id antigo. */
  it('rewires the relations to the new ids', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    const [importedChapter] = await db.select().from(chapters).where(eq(chapters.storyId, storyId));
    const [importedLocation] = await db.select().from(locations).where(eq(locations.storyId, storyId));
    const [importedScene] = await db.select().from(scenes).where(eq(scenes.storyId, storyId));

    expect(importedScene.chapterId).toBe(importedChapter.id);
    expect(importedScene.locationId).toBe(importedLocation.id);
  });

  it('lets the same package be imported twice as two separate stories', async () => {
    const first = await service.importStory(IMPORTER_ID, buildExport());
    const second = await service.importStory(IMPORTER_ID, buildExport());

    expect(first).not.toBe(second);
    expect(await db.select().from(scenes)).toHaveLength(2);
  });
});

/**
 * O caminho de "vincular ao servidor uma história criada offline": a partir daí o cliente
 * continua referenciando cada entidade pelo id local, para sempre. Se qualquer filho ganhasse
 * id novo, toda operação futura sobre ele falharia com "not found" - não uma corrida
 * transitória, mas um descasamento estrutural que nenhuma retentativa conserta.
 */
describe('id preservation when uploading a local story', () => {
  it('keeps the story id the client asked to preserve', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID);

    expect(storyId).toBe(ORIGINAL_STORY_ID);
  });

  it('keeps the id of every child entity too', async () => {
    await service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID);

    const [importedChapter] = await db.select().from(chapters);
    const [importedLocation] = await db.select().from(locations);
    const [importedScene] = await db.select().from(scenes);
    expect(importedChapter.id).toBe(ORIGINAL_CHAPTER_ID);
    expect(importedLocation.id).toBe(ORIGINAL_LOCATION_ID);
    expect(importedScene.id).toBe(ORIGINAL_SCENE_ID);
  });

  it('keeps the relations pointing at those same ids', async () => {
    await service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID);

    const [importedScene] = await db.select().from(scenes);
    expect(importedScene.chapterId).toBe(ORIGINAL_CHAPTER_ID);
    expect(importedScene.locationId).toBe(ORIGINAL_LOCATION_ID);
  });

  it('refuses to overwrite a story the same user already has', async () => {
    await service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID);

    await expect(service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID)).rejects.toThrow(
      /already exists for this user/,
    );
  });
});

describe('rejected packages', () => {
  it('rejects a package from a newer app with a status the client can act on', async () => {
    const fromTheFuture = buildExport({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 });

    await expect(service.importStory(IMPORTER_ID, fromTheFuture)).rejects.toMatchObject({ status: 422 });
  });

  it('rejects a package that is not a story export at all', async () => {
    await expect(service.importStory(IMPORTER_ID, { hello: 'world' })).rejects.toThrow();
  });

  it('rejects a scene pointing at a chapter the package does not carry', async () => {
    const broken = buildExport({ scenes: [scene({ chapterId: newId() })] });

    await expect(service.importStory(IMPORTER_ID, broken)).rejects.toThrow(/not found in ID map/);
  });

  it('rejects a scene pointing at a location the package does not carry', async () => {
    const broken = buildExport({ scenes: [scene({ locationId: newId() })] });

    await expect(service.importStory(IMPORTER_ID, broken)).rejects.toThrow(/not found in ID map/);
  });

  /** Import parcial seria pior que import nenhum: o usuário ficaria com uma história quebrada. */
  it('leaves nothing behind when the import fails halfway', async () => {
    const broken = buildExport({ scenes: [scene({ chapterId: newId() })] });

    await service.importStory(IMPORTER_ID, broken).catch(() => {});

    expect(await db.select().from(stories)).toEqual([]);
    expect(await db.select().from(chapters)).toEqual([]);
    expect(await db.select().from(locations)).toEqual([]);
  });

  it('does not leave a story behind when the preserved id is already taken', async () => {
    await service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID);

    await service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID).catch(() => {});

    expect(await db.select().from(stories)).toHaveLength(1);
    expect(await db.select().from(chapters)).toHaveLength(1);
  });
});

describe('export', () => {
  it('round-trips a story imported from a package', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    const exported = await service.exportStory(storyId, IMPORTER_ID);

    expect(exported.story).toMatchObject({ id: storyId, title: 'A Queda', userId: IMPORTER_ID });
    expect(exported.chapters).toHaveLength(1);
    expect(exported.scenes).toHaveLength(1);
    expect(exported.locations).toHaveLength(1);
  });

  it('produces a package that imports again into an equivalent story', async () => {
    const first = await service.importStory(IMPORTER_ID, buildExport());
    const exported = await service.exportStory(first, IMPORTER_ID);

    const second = await service.importStory(IMPORTER_ID, exported);

    const [reExported] = await db.select().from(scenes).where(eq(scenes.storyId, second));
    const [chapterOfSecond] = await db.select().from(chapters).where(eq(chapters.storyId, second));
    expect(reExported.chapterId).toBe(chapterOfSecond.id);
    expect(reExported.name).toBe('Abertura');
  });

  it('stamps the current format version on what it exports', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    const exported = await service.exportStory(storyId, IMPORTER_ID);

    expect(exported.formatVersion).toBe(CURRENT_STORY_FORMAT_VERSION);
  });
});

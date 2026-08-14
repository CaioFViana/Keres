import { AttributeType, CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  attributeValues,
  chapters,
  characters,
  choiceCheckGroups,
  choiceChecks,
  choices,
  effects,
  locations,
  scenes,
  storySchemaFields,
  stories,
  users,
} from '../../src/db/schema';
import { StoryExportImportService } from '../../src/services/StoryExportImportService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

const OWNER_ID = newId();
const IMPORTER_ID = newId();
const ORIGINAL_STORY_ID = newId();
const ORIGINAL_CHAPTER_ID = newId();
const ORIGINAL_LOCATION_ID = newId();
const ORIGINAL_SCENE_ID = newId();
const ORIGINAL_CHOICE_ID = newId();
const ORIGINAL_ITEM_ID = newId();
const ORIGINAL_GROUP_ID = newId();
const ORIGINAL_CHECK_ID = newId();
const ORIGINAL_EFFECT_ID = newId();
const ORIGINAL_CHARACTER_ID = newId();
const ORIGINAL_FIELD_ID = newId();
const ORIGINAL_ATTRIBUTE_VALUE_ID = newId();

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

const character = (id = ORIGINAL_CHARACTER_ID) => ({
  id,
  storyId: ORIGINAL_STORY_ID,
  name: 'Keres',
  isFavorite: false,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

const entityField = () => ({
  id: ORIGINAL_FIELD_ID,
  storyId: ORIGINAL_STORY_ID,
  entityType: 'Character',
  name: 'Aliado',
  key: 'aliado',
  description: null,
  type: AttributeType.ENTITY,
  targetEntityType: 'Character',
  isRequired: false,
  defaultValue: null,
  order: 0,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

const attributeValue = (value: string | null) => ({
  id: ORIGINAL_ATTRIBUTE_VALUE_ID,
  storyId: ORIGINAL_STORY_ID,
  entityType: 'Character',
  entityId: ORIGINAL_CHARACTER_ID,
  fieldId: ORIGINAL_FIELD_ID,
  value,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
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

const choice = (overrides: Record<string, unknown> = {}) => ({
  id: ORIGINAL_CHOICE_ID,
  storyId: ORIGINAL_STORY_ID,
  sceneId: ORIGINAL_SCENE_ID,
  nextSceneId: ORIGINAL_SCENE_ID,
  text: 'Abrir a porta',
  notes: null,
  createdAt: OLD,
  updatedAt: OLD,
  version: 2,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const item = (overrides: Record<string, unknown> = {}) => ({
  id: ORIGINAL_ITEM_ID,
  storyId: ORIGINAL_STORY_ID,
  characterOwnerId: null,
  name: 'Chave enferrujada',
  category: null,
  description: null,
  initialState: null,
  isFavorite: false,
  extraNotes: null,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const choiceCheckGroup = (overrides: Record<string, unknown> = {}) => ({
  id: ORIGINAL_GROUP_ID,
  storyId: ORIGINAL_STORY_ID,
  choiceId: ORIGINAL_CHOICE_ID,
  combinator: 'AND',
  order: 0,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const choiceCheck = (overrides: Record<string, unknown> = {}) => ({
  id: ORIGINAL_CHECK_ID,
  storyId: ORIGINAL_STORY_ID,
  groupId: ORIGINAL_GROUP_ID,
  mode: 'block',
  type: 'inventory',
  order: 0,
  sceneId: null,
  minVisits: null,
  itemId: ORIGINAL_ITEM_ID,
  itemPresence: 'has',
  triggerName: null,
  triggerState: null,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const effect = (overrides: Record<string, unknown> = {}) => ({
  id: ORIGINAL_EFFECT_ID,
  storyId: ORIGINAL_STORY_ID,
  entityType: 'Choice',
  entityId: ORIGINAL_CHOICE_ID,
  effectType: 'itemGrant',
  itemId: ORIGINAL_ITEM_ID,
  triggerName: null,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
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
    const [importedLocation] = await db
      .select()
      .from(locations)
      .where(eq(locations.storyId, storyId));
    expect(importedChapter.id).not.toBe(ORIGINAL_CHAPTER_ID);
    expect(importedLocation.id).not.toBe(ORIGINAL_LOCATION_ID);
  });

  /** O ponto que importa: uma relação não pode continuar apontando para o id antigo. */
  it('rewires the relations to the new ids', async () => {
    const storyId = await service.importStory(IMPORTER_ID, buildExport());

    const [importedChapter] = await db.select().from(chapters).where(eq(chapters.storyId, storyId));
    const [importedLocation] = await db
      .select()
      .from(locations)
      .where(eq(locations.storyId, storyId));
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

    await expect(
      service.importStory(IMPORTER_ID, buildExport(), ORIGINAL_STORY_ID),
    ).rejects.toThrow(/already exists for this user/);
  });
});

describe('rejected packages', () => {
  it('rejects a package from a newer app with a status the client can act on', async () => {
    const fromTheFuture = buildExport({ formatVersion: CURRENT_STORY_FORMAT_VERSION + 1 });

    await expect(service.importStory(IMPORTER_ID, fromTheFuture)).rejects.toMatchObject({
      status: 422,
    });
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

describe('choice checks and effects', () => {
  it('round-trips a choice check group, its check, and an effect', async () => {
    const storyId = await service.importStory(
      IMPORTER_ID,
      buildExport({
        choices: [choice()],
        items: [item()],
        choiceCheckGroups: [choiceCheckGroup()],
        choiceChecks: [choiceCheck()],
        effects: [effect()],
      }),
    );

    const [importedChoice] = await db.select().from(choices).where(eq(choices.storyId, storyId));
    const [importedGroup] = await db
      .select()
      .from(choiceCheckGroups)
      .where(eq(choiceCheckGroups.storyId, storyId));
    const [importedCheck] = await db
      .select()
      .from(choiceChecks)
      .where(eq(choiceChecks.storyId, storyId));
    const [importedEffect] = await db.select().from(effects).where(eq(effects.storyId, storyId));

    expect(importedGroup.choiceId).toBe(importedChoice.id);
    expect(importedCheck.groupId).toBe(importedGroup.id);
    expect(importedCheck.itemPresence).toBe('has');
    expect(importedEffect.entityType).toBe('Choice');
    expect(importedEffect.entityId).toBe(importedChoice.id);
    expect(importedEffect.effectType).toBe('itemGrant');

    const exported = await service.exportStory(storyId, IMPORTER_ID);
    expect(exported.choiceCheckGroups).toHaveLength(1);
    expect(exported.choiceChecks).toHaveLength(1);
    expect(exported.effects).toHaveLength(1);

    const second = await service.importStory(IMPORTER_ID, exported);
    const [reImportedGroup] = await db
      .select()
      .from(choiceCheckGroups)
      .where(eq(choiceCheckGroups.storyId, second));
    const [reImportedChoice] = await db.select().from(choices).where(eq(choices.storyId, second));
    expect(reImportedGroup.choiceId).toBe(reImportedChoice.id);
  });

  it('rejects a choice check group pointing at a choice the package does not carry', async () => {
    const broken = buildExport({
      choices: [choice()],
      choiceCheckGroups: [choiceCheckGroup({ choiceId: newId() })],
    });

    await expect(service.importStory(IMPORTER_ID, broken)).rejects.toThrow(/not found in ID map/);
  });
});

describe('entity attribute references', () => {
  it('remaps an entity attribute value to the imported target entity', async () => {
    const storyId = await service.importStory(
      IMPORTER_ID,
      buildExport({
        characters: [character()],
        storySchemaFields: [entityField()],
        attributeValues: [attributeValue(ORIGINAL_CHARACTER_ID)],
      }),
    );

    const [importedCharacter] = await db
      .select()
      .from(characters)
      .where(eq(characters.storyId, storyId));
    const [importedField] = await db
      .select()
      .from(storySchemaFields)
      .where(eq(storySchemaFields.storyId, storyId));
    const [importedValue] = await db
      .select()
      .from(attributeValues)
      .where(eq(attributeValues.storyId, storyId));

    expect(importedField).toMatchObject({
      type: AttributeType.ENTITY,
      targetEntityType: 'Character',
    });
    expect(importedValue.fieldId).toBe(importedField.id);
    expect(importedValue.value).toBe(importedCharacter.id);
    expect(importedValue.value).not.toBe(ORIGINAL_CHARACTER_ID);
  });

  it('clears an entity attribute target absent from the imported package', async () => {
    const storyId = await service.importStory(
      IMPORTER_ID,
      buildExport({
        characters: [character()],
        storySchemaFields: [entityField()],
        attributeValues: [attributeValue(newId())],
      }),
    );

    const [importedValue] = await db
      .select()
      .from(attributeValues)
      .where(eq(attributeValues.storyId, storyId));

    expect(importedValue.value).toBeNull();
  });
});

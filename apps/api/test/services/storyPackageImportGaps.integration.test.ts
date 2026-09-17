import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  boards,
  chapterAnchors,
  chapters,
  locationMaps,
  scenes,
  stories,
  storyCalendars,
  tiers,
  users,
} from '../../src/db/schema';
import { insertPortableCollection } from '../../src/services/story-packages/DatabaseStoryPackageCollectionRepository';
import { StoryExportImportService } from '../../src/services/StoryExportImportService';
import { AppError } from '../../src/utils/errors';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

const OLD = new Date('2020-01-01T00:00:00.000Z');

let service: StoryExportImportService;
let importerId: string;
let storyId: string;

const base = (overrides: Record<string, unknown> = {}) => ({
  id: newId(),
  storyId,
  createdAt: OLD,
  updatedAt: OLD,
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

const chapter = (overrides: Record<string, unknown> = {}) =>
  base({
    name: 'Capitulo 1',
    index: 1,
    summary: null,
    isFavorite: false,
    extraNotes: null,
    ...overrides,
  });

const location = (overrides: Record<string, unknown> = {}) =>
  base({
    name: 'Avalon',
    description: null,
    climate: null,
    culture: null,
    politics: null,
    isFavorite: false,
    extraNotes: null,
    ...overrides,
  });

const scene = (
  chapterId: string,
  locationId: string | null,
  overrides: Record<string, unknown> = {},
) =>
  base({
    chapterId,
    locationId,
    name: 'Abertura',
    index: 1,
    summary: null,
    gap: null,
    gapType: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    ...overrides,
  });

const character = (overrides: Record<string, unknown> = {}) =>
  base({ name: 'Keres', isFavorite: false, ...overrides });

/** Collections every package has to carry, even when empty. */
const buildExport = (overrides: Record<string, unknown> = {}) => ({
  story: {
    id: storyId,
    userId: importerId,
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
  serverLastOperationVersion: 0,
  formatVersion: CURRENT_STORY_FORMAT_VERSION,
  ...overrides,
});

const storyCount = async () => (await db.select({ id: stories.id }).from(stories)).length;

beforeEach(async () => {
  await truncateAll();
  service = new StoryExportImportService();
  importerId = newId();
  storyId = newId();
  await db
    .insert(users)
    .values({ id: importerId, username: 'ana', tag: 'ana', password: 'x' } as never);
});

describe('import refuses references no collection contains', () => {
  it.each([
    [
      'effect entity',
      () => ({
        effects: [
          base({
            entityType: 'Choice',
            entityId: newId(),
            effectType: 'itemGrant',
            itemId: null,
            triggerName: null,
          }),
        ],
      }),
      /\(Choice\) not found in ID map for effect/,
    ],
    [
      'tag relation endpoint',
      () => {
        const tagId = newId();
        return {
          tags: [
            base({ id: tagId, name: 'Viloes', color: null, isFavorite: false, extraNotes: null }),
          ],
          tagRelations: [base({ tagId, relationId: newId(), relationType: 'Character' })],
        };
      },
      /not found in ID map for tag relation/,
    ],
    [
      'gallery relation owner',
      () => {
        const galleryId = newId();
        return {
          galleryItems: [
            base({
              id: galleryId,
              mediaType: 'image',
              mimeType: 'image/png',
              fileName: 'nyx.png',
              hash: 'a'.repeat(32),
              sizeBytes: 1,
              title: null,
              isFavorite: false,
              extraNotes: null,
            }),
          ],
          galleryRelations: [base({ galleryId, ownerId: newId(), ownerType: 'Character' })],
        };
      },
      /not found in ID map for gallery relation/,
    ],
    [
      'attribute value entity',
      () => {
        const fieldId = newId();
        return {
          storySchemaFields: [
            base({
              id: fieldId,
              entityType: 'Character',
              name: 'Origem',
              key: 'origem',
              description: null,
              type: 'text',
              isRequired: false,
              defaultValue: null,
              order: 0,
            }),
          ],
          attributeValues: [
            base({ entityType: 'Character', entityId: newId(), fieldId, value: 'Atenas' }),
          ],
        };
      },
      /not found in ID map for attribute value/,
    ],
    [
      'note relation endpoint',
      () => {
        const noteId = newId();
        return {
          notes: [
            base({
              id: noteId,
              title: 'Profecia',
              body: null,
              isFavorite: false,
              extraNotes: null,
            }),
          ],
          noteRelations: [base({ noteId, relationId: newId(), relationType: 'Character' })],
        };
      },
      /not found in ID map for note relation/,
    ],
    [
      'commented entity',
      () => ({
        comments: [
          base({
            entityType: 'Character',
            entityId: newId(),
            fieldId: null,
            fieldKey: 'name',
            contentSnapshot: 'Keres',
            excerptText: null,
            authorUserId: importerId,
            commentText: 'Olha',
            criticality: 2,
          }),
        ],
      }),
      /references an entity absent from the export/,
    ],
    [
      'favorited entity',
      () => ({
        favorites: [base({ entityType: 'Character', entityId: newId(), userId: importerId })],
      }),
      /not found for favorite/,
    ],
  ])('a dangling %s aborts the import and leaves nothing behind', async (_what, build, message) => {
    await expect(service.importStory(importerId, buildExport(build()))).rejects.toThrow(message);
    expect(await storyCount()).toBe(0);
  });
});

describe('import carries nullable and soft-deleted rows faithfully', () => {
  it('imports a scene with no location', async () => {
    const chapterId = newId();
    const importedId = await service.importStory(
      importerId,
      buildExport({
        chapters: [chapter({ id: chapterId })],
        locations: [location()],
        scenes: [scene(chapterId, null)],
      }),
    );

    const rows = await db.query.scenes.findMany({ where: eq(scenes.storyId, importedId) });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ locationId: null, isDeleted: false });
  });

  it('imports a deleted story arc with its deletion timestamp', async () => {
    const chapterId = newId();
    const locationId = newId();
    const importedId = await service.importStory(
      importerId,
      buildExport({
        storyArcs: [
          base({
            title: 'Ato I',
            description: null,
            sortOrder: 0,
            color: null,
            icon: null,
            themeOverride: null,
            isDefault: false,
            isDeleted: true,
            deletedAt: OLD,
          }),
        ],
        chapters: [chapter({ id: chapterId })],
        locations: [location({ id: locationId })],
        scenes: [scene(chapterId, locationId)],
      }),
    );

    const arcs = await db.query.storyArcs.findMany();
    expect(arcs).toHaveLength(1);
    // The arc block resurrects the row (like chapters) but still maps the timestamp (like
    // anchors): a live row carrying a stale deletedAt. Real exports never contain deleted
    // arcs - they are pruned at export - so this only shows on hand-built packages.
    expect(arcs[0]).toMatchObject({ storyId: importedId, isDeleted: false, deletedAt: OLD });
  });

  it('normalizes duplicate start and finish flags on a linear import', async () => {
    const chapterId = newId();
    const locationId = newId();
    const importedId = await service.importStory(
      importerId,
      buildExport({
        chapters: [chapter({ id: chapterId })],
        locations: [location({ id: locationId })],
        scenes: [
          scene(chapterId, locationId, { name: 'Um', index: 1, isStart: true }),
          scene(chapterId, locationId, { name: 'Dois', index: 2, isStart: true }),
          scene(chapterId, locationId, { name: 'Tres', index: 3, isFinish: true }),
          scene(chapterId, locationId, { name: 'Quatro', index: 4, isFinish: true }),
        ],
      }),
    );

    const rows = await db.query.scenes.findMany({ where: eq(scenes.storyId, importedId) });
    expect(rows.filter((row) => row.isStart)).toHaveLength(1);
    expect(rows.filter((row) => row.isFinish)).toHaveLength(1);
  });

  it('imports a comment on a custom attribute with its field remapped', async () => {
    const characterId = newId();
    const fieldId = newId();
    const importedId = await service.importStory(
      importerId,
      buildExport({
        characters: [character({ id: characterId })],
        storySchemaFields: [
          base({
            id: fieldId,
            entityType: 'Character',
            name: 'Origem',
            key: 'origem',
            description: null,
            type: 'text',
            isRequired: false,
            defaultValue: null,
            order: 0,
          }),
        ],
        comments: [
          base({
            entityType: 'Character',
            entityId: characterId,
            fieldId,
            fieldKey: 'origem',
            contentSnapshot: 'Atenas',
            excerptText: null,
            authorUserId: importerId,
            commentText: 'Olha',
            criticality: 2,
          }),
        ],
      }),
    );

    const fields = await db.query.storySchemaFields.findMany();
    expect(fields).toHaveLength(1);
    const comments = await db.query.comments.findMany();
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ storyId: importedId, fieldId: fields[0].id });
    expect(comments[0].fieldId).not.toBe(fieldId);
  });

  it('keeps pins at ghosts and deletion timestamps on boards and maps', async () => {
    const ghost = newId();
    const boardNode = {
      id: 'AAAAAAAA',
      kind: 'entity',
      x: 1,
      y: 2,
      entityType: 'Character',
      entityId: ghost,
      labelAtPin: 'Sumida',
    };
    const importedId = await service.importStory(
      importerId,
      buildExport({
        storyBoards: [
          base({ name: 'Pins', description: null, content: { nodes: [boardNode], edges: [] } }),
          base({
            name: 'Apagado',
            description: null,
            content: { nodes: [], edges: [] },
            isDeleted: true,
            deletedAt: OLD,
          }),
        ],
        storyLocationMaps: [
          base({
            name: 'Continente',
            description: null,
            content: {
              images: [{ id: 'AAAAAAAA', galleryId: ghost, x: 0, y: 0, width: 10, height: 10 }],
              nodes: [
                {
                  id: 'BBBBBBBB',
                  locationId: ghost,
                  x: 1,
                  y: 2,
                  icon: 'pin',
                  labelAtPin: 'Sumido',
                },
              ],
            },
          }),
          base({
            name: 'Rascunho',
            description: null,
            content: { images: [], nodes: [] },
            isDeleted: true,
            deletedAt: OLD,
          }),
        ],
      }),
    );

    const boardRows = await db.query.boards.findMany({ where: eq(boards.storyId, importedId) });
    expect(boardRows).toHaveLength(2);
    const live = boardRows.find((row) => row.name === 'Pins')!;
    expect((live.content as { nodes: Array<{ entityId: string }> }).nodes[0].entityId).toBe(ghost);
    expect(boardRows.find((row) => row.name === 'Apagado')).toMatchObject({
      isDeleted: true,
      deletedAt: OLD,
    });

    const mapRows = await db.query.locationMaps.findMany({
      where: eq(locationMaps.storyId, importedId),
    });
    expect(mapRows).toHaveLength(2);
    const liveMap = mapRows.find((row) => row.name === 'Continente')!;
    const liveContent = liveMap.content as {
      images: Array<{ galleryId: string }>;
      nodes: Array<{ locationId: string }>;
    };
    expect(liveContent.images[0].galleryId).toBe(ghost);
    expect(liveContent.nodes[0].locationId).toBe(ghost);
    expect(mapRows.find((row) => row.name === 'Rascunho')).toMatchObject({
      isDeleted: true,
      deletedAt: OLD,
    });
  });

  it('imports an open-ended anchor and deletion timestamps on anchors and calendars', async () => {
    const chapterId = newId();
    const locationId = newId();
    const sceneA = newId();
    const sceneB = newId();
    const importedId = await service.importStory(
      importerId,
      buildExport({
        chapters: [chapter({ id: chapterId })],
        locations: [location({ id: locationId })],
        scenes: [
          scene(chapterId, locationId, { id: sceneA, name: 'Um', index: 1 }),
          scene(chapterId, locationId, { id: sceneB, name: 'Dois', index: 2 }),
        ],
        chapterAnchors: [
          base({
            chapterId,
            order: 1,
            startSceneId: sceneA,
            startPosition: 'start',
            startOffset: null,
            startOffsetUnit: null,
            endSceneId: null,
            endPosition: null,
            endOffset: null,
            endOffsetUnit: null,
          }),
          base({
            chapterId,
            order: 2,
            startSceneId: sceneB,
            startPosition: 'start',
            startOffset: null,
            startOffsetUnit: null,
            endSceneId: sceneB,
            endPosition: 'end',
            endOffset: null,
            endOffsetUnit: null,
            isDeleted: true,
            deletedAt: OLD,
          }),
        ],
        storyCalendars: [
          base({
            name: 'Antigo',
            isPrimary: true,
            description: null,
            extraNotes: null,
            definition: {
              secondsPerMinute: 60,
              minutesPerHour: 60,
              hoursPerDay: 24,
              daysPerWeek: 7,
              weekdayNames: [],
              unitNames: {},
              months: [{ name: 'First', days: 30 }],
              eras: [],
              moons: [],
              seasons: [],
            },
            isDeleted: true,
            deletedAt: OLD,
          }),
        ],
      }),
    );

    const anchorRows = await db.query.chapterAnchors.findMany({
      where: eq(chapterAnchors.storyId, importedId),
    });
    expect(anchorRows).toHaveLength(2);
    expect(anchorRows.find((row) => row.order === 1)).toMatchObject({ endSceneId: null });
    expect(anchorRows.find((row) => row.order === 2)).toMatchObject({
      isDeleted: true,
      deletedAt: OLD,
    });
    const calendarRows = await db.query.storyCalendars.findMany({
      where: eq(storyCalendars.storyId, importedId),
    });
    expect(calendarRows).toHaveLength(1);
    expect(calendarRows[0]).toMatchObject({ isDeleted: true, deletedAt: OLD });
  });
});

describe('import guards', () => {
  it('rejects a malformed package that is not a version complaint', async () => {
    // A shapeless object sails through the null-tolerant migrations and dies in schema
    // validation - a plain error, not a version complaint and not an AppError status.
    const error = await service
      .importStory(importerId, { formatVersion: 0 } as never)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).not.toBe('StoryExportVersionError');
    expect((error as AppError).status).toBeUndefined();
    expect(await storyCount()).toBe(0);
  });

  it('refuses a scene with no chapter and a chapter with a ghost arc', async () => {
    // The integrity pre-check pins chapterId as required and every arcId to a packaged arc, so
    // the phases below never see these shapes - these lock that contract in.
    const chapterId = newId();
    const locationId = newId();
    await expect(
      service.importStory(
        importerId,
        buildExport({
          chapters: [chapter({ id: chapterId })],
          locations: [location({ id: locationId })],
          scenes: [scene(chapterId, locationId, { chapterId: null })],
        }),
      ),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      service.importStory(
        importerId,
        buildExport({
          chapters: [chapter({ arcId: newId() })],
          locations: [location({ id: locationId })],
          scenes: [scene(chapterId, locationId)],
        }),
      ),
    ).rejects.toBeInstanceOf(AppError);
    expect(await storyCount()).toBe(0);
  });

  it('refuses an import once the tier story limit is reached', async () => {
    const tierId = newId();
    await db.insert(tiers).values({
      id: tierId,
      name: `Tier ${tierId}`,
      isDefault: false,
      maxStories: 1,
      maxEntitiesPerStory: null,
      maxEntitiesTotal: null,
      maxStorageBytesPerStory: null,
      maxStorageBytesTotal: null,
    } as never);
    await db.update(users).set({ tierId }).where(eq(users.id, importerId));
    const now = new Date();
    await db.insert(stories).values({
      id: newId(),
      userId: importerId,
      title: 'Ja tem uma',
      type: 'linear',
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    } as never);

    const error = await service
      .importStory(importerId, buildExport({ chapters: [chapter()], locations: [location()] }))
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(403);
    expect(await storyCount()).toBe(1);
  });

  it('refuses to insert the package root as a portable collection', async () => {
    await expect(insertPortableCollection({} as never, 'Story' as never, [])).rejects.toThrow(
      /not a portable story collection/i,
    );
  });
});

describe('import phases validate their own inputs', () => {
  /**
   * The integrity pre-check rejects dangling monomorphic references before the phases run, so
   * these guards only fire for direct phase callers - which today means nobody. They are still
   * the documented contract of each phase ("import phases own ... validation"), so these prove
   * each one throws instead of writing a link to nothing. Every case rolls its transaction back.
   */
  const runPhase = async (
    phase: (context: never) => Promise<void>,
    overrides: Record<string, unknown>,
    seeds: Array<[string, string]> = [],
    insertRoot = true,
  ) => {
    const targetStoryId = newId();
    const now = new Date();
    await expect(
      db.transaction(async (tx) => {
        if (insertRoot) {
          await tx.insert(stories).values({
            id: targetStoryId,
            userId: importerId,
            title: 'Phase',
            type: 'linear',
            createdAt: now,
            updatedAt: now,
            version: 1,
            isDeleted: false,
          } as never);
        }
        const idMap = new Map<string, string>(seeds);
        await phase({
          tx,
          fullStory: buildExport(overrides),
          userId: importerId,
          targetStoryId,
          now,
          idMap,
          nextId: () => newId(),
        } as never);
      }),
    ).rejects.toThrow(/ID map|Import Error|absent from the export/);
    expect(await storyCount()).toBe(0);
  };

  it('core refuses a location relation, scene and choice with missing ends', async () => {
    const { importStoryCore } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageCoreImport'
    );
    const placeId = newId();
    // Core inserts the package root itself, so the harness skips the story seed here.
    await runPhase(
      importStoryCore,
      {
        locations: [location({ id: placeId })],
        locationRelations: [
          base({ locationAId: newId(), locationBId: placeId, relationType: 'contains' }),
        ],
      },
      [],
      false,
    );
    const chapterId = newId();
    await runPhase(
      importStoryCore,
      {
        chapters: [chapter({ id: chapterId })],
        locations: [location({ id: placeId })],
        scenes: [scene(newId(), placeId)],
      },
      [],
      false,
    );
    const sceneId = newId();
    await runPhase(
      importStoryCore,
      {
        chapters: [chapter({ id: chapterId })],
        locations: [location({ id: placeId })],
        scenes: [scene(chapterId, placeId, { id: sceneId })],
        choices: [base({ sceneId: newId(), nextSceneId: sceneId, text: 'Ir', notes: null })],
      },
      [],
      false,
    );
  });

  it('core refuses the second end of a location relation, scene and choice', async () => {
    const { importStoryCore } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageCoreImport'
    );
    const placeId = newId();
    const chapterId = newId();
    const sceneId = newId();
    await runPhase(
      importStoryCore,
      {
        locations: [location({ id: placeId })],
        locationRelations: [
          base({ locationAId: placeId, locationBId: newId(), relationType: 'contains' }),
        ],
      },
      [],
      false,
    );
    await runPhase(
      importStoryCore,
      {
        chapters: [chapter({ id: chapterId })],
        scenes: [scene(chapterId, newId())],
      },
      [],
      false,
    );
    await runPhase(
      importStoryCore,
      {
        chapters: [chapter({ id: chapterId })],
        locations: [location({ id: placeId })],
        scenes: [scene(chapterId, placeId, { id: sceneId })],
        choices: [base({ sceneId, nextSceneId: newId(), text: 'Ir', notes: null })],
      },
      [],
      false,
    );
  });

  it('core keeps a ghost arc id and accepts a chapterless scene at the phase', async () => {
    // Neither shape survives the integrity pre-check on the importStory path (see 'import
    // guards'), so both are direct-phase behavior: the arc fallback preserves the id it
    // cannot remap, and a scene with no chapter lands with a null chapterId.
    const { importStoryCore } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageCoreImport'
    );
    const ghostArcId = newId();
    const chapterId = newId();
    const targetStoryId = newId();
    const now = new Date();
    await db.transaction(async (tx) => {
      await importStoryCore({
        tx,
        fullStory: buildExport({
          chapters: [chapter({ id: chapterId, arcId: ghostArcId })],
          scenes: [scene('ignored', null, { id: newId(), chapterId: null })],
        }),
        userId: importerId,
        targetStoryId,
        now,
        idMap: new Map<string, string>(),
        nextId: () => newId(),
      } as never);
    });

    const chapterRows = await db.query.chapters.findMany({
      where: eq(chapters.storyId, targetStoryId),
    });
    expect(chapterRows).toHaveLength(1);
    expect(chapterRows[0]).toMatchObject({ id: expect.any(String), arcId: ghostArcId });
    const sceneRows = await db.query.scenes.findMany({
      where: eq(scenes.storyId, targetStoryId),
    });
    expect(sceneRows).toHaveLength(1);
    expect(sceneRows[0]).toMatchObject({ chapterId: null, locationId: null });
  });

  it('narrative refuses a note relation and a character relation with missing ends', async () => {
    const { importNarrativeCollections } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageNarrativeImport'
    );
    const noteId = newId();
    const characterId = newId();
    await runPhase(importNarrativeCollections, {
      notes: [
        base({ id: noteId, title: 'Lembrete', body: null, isFavorite: false, extraNotes: null }),
      ],
      noteRelations: [
        base({ noteId: newId(), relationId: characterId, relationType: 'Character' }),
      ],
    });
    await runPhase(importNarrativeCollections, {
      characters: [character({ id: characterId })],
      characterRelations: [
        base({ character1Id: newId(), character2Id: characterId, relationType: 'siblings' }),
      ],
    });
  });

  it('narrative refuses anchors and character links with missing ends', async () => {
    const { importNarrativeCollections } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageNarrativeImport'
    );
    const anchor = (overrides: Record<string, unknown>) =>
      base({
        chapterId: newId(),
        order: 1,
        startSceneId: newId(),
        startPosition: 'start',
        startOffset: null,
        startOffsetUnit: null,
        endSceneId: null,
        endPosition: null,
        endOffset: null,
        endOffsetUnit: null,
        ...overrides,
      });
    // An anchor whose chapter, start scene and end scene the file never carried.
    const startId = newId();
    await runPhase(
      importNarrativeCollections,
      { chapterAnchors: [anchor({ startSceneId: startId })] },
      [[startId, newId()]],
    );
    const chapterId = newId();
    await runPhase(importNarrativeCollections, { chapterAnchors: [anchor({ chapterId })] }, [
      [chapterId, newId()],
    ]);
    const endId = newId();
    await runPhase(
      importNarrativeCollections,
      { chapterAnchors: [anchor({ chapterId, startSceneId: startId, endSceneId: endId })] },
      [
        [chapterId, newId()],
        [startId, newId()],
      ],
    );
    // A character relation whose second end the file never carried.
    const characterId = newId();
    await runPhase(importNarrativeCollections, {
      characters: [character({ id: characterId })],
      characterRelations: [
        base({ character1Id: characterId, character2Id: newId(), relationType: 'siblings' }),
      ],
    });
    // A character-scene link missing its character, then its scene.
    await runPhase(importNarrativeCollections, {
      characterScenes: [base({ characterId: newId(), sceneId: newId() })],
    });
    await runPhase(importNarrativeCollections, {
      characters: [character({ id: characterId })],
      characterScenes: [base({ characterId, sceneId: newId() })],
    });
  });

  it('assets refuses a plot link and a route step with missing ends', async () => {
    const { importStoryAssets } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageAssetsImport'
    );
    await runPhase(importStoryAssets, {
      plots: [base({ name: 'Trama', details: null })],
      plotScenes: [base({ plotId: newId(), sceneId: newId(), note: null })],
    });
    await runPhase(importStoryAssets, {
      routes: [base({ name: 'Trilha', details: null })],
      routeSteps: [
        base({ routeId: newId(), position: 1, sceneId: newId(), selectedChoiceId: null }),
      ],
    });
  });

  it('interactions refuses a check with a missing group', async () => {
    const { importStoryInteractions } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageInteractionsImport'
    );
    await runPhase(importStoryInteractions, {
      choiceChecks: [
        base({
          groupId: newId(),
          mode: 'block',
          type: 'inventory',
          order: 0,
          sceneId: null,
          minVisits: null,
          itemId: null,
          itemPresence: 'has',
          triggerName: null,
          triggerState: null,
        }),
      ],
    });
  });

  it('interactions refuses the remaining dangling ends', async () => {
    const { importStoryInteractions } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageInteractionsImport'
    );
    const check = (overrides: Record<string, unknown>) =>
      base({
        groupId: newId(),
        mode: 'block',
        type: 'inventory',
        order: 0,
        sceneId: null,
        minVisits: null,
        itemId: null,
        itemPresence: 'has',
        triggerName: null,
        triggerState: null,
        ...overrides,
      });
    // A group pointing at a choice the file never carried.
    await runPhase(importStoryInteractions, {
      choiceCheckGroups: [base({ choiceId: newId(), combinator: 'AND', order: 0 })],
    });
    // A check pointing at a scene (then an item) the file never carried.
    const groupId = newId();
    const choiceId = newId();
    await runPhase(
      importStoryInteractions,
      {
        choiceCheckGroups: [base({ id: groupId, choiceId, combinator: 'AND', order: 0 })],
        choiceChecks: [check({ groupId, sceneId: newId() })],
      },
      [[choiceId, newId()]],
    );
    await runPhase(
      importStoryInteractions,
      {
        choiceCheckGroups: [base({ id: groupId, choiceId, combinator: 'AND', order: 0 })],
        choiceChecks: [check({ groupId, itemId: newId() })],
      },
      [[choiceId, newId()]],
    );
    // An effect granting an item the file never carried.
    const entityId = newId();
    await runPhase(
      importStoryInteractions,
      {
        effects: [
          base({
            entityType: 'Choice',
            entityId,
            effectType: 'itemGrant',
            itemId: newId(),
            triggerName: null,
          }),
        ],
      },
      [[entityId, newId()]],
    );
    // A journey naming an item, a scene and an owner the file never carried.
    const journey = (overrides: Record<string, unknown>) =>
      base({
        itemId: newId(),
        sceneId: newId(),
        newCharacterOwnerId: null,
        newState: 'perdida',
        extraNotes: null,
        ...overrides,
      });
    await runPhase(importStoryInteractions, { itemJourneys: [journey({})] });
    const itemId = newId();
    await runPhase(importStoryInteractions, { itemJourneys: [journey({ itemId })] }, [
      [itemId, newId()],
    ]);
    const sceneId = newId();
    await runPhase(
      importStoryInteractions,
      { itemJourneys: [journey({ itemId, sceneId, newCharacterOwnerId: newId() })] },
      [
        [itemId, newId()],
        [sceneId, newId()],
      ],
    );
    // A tag link naming a tag the file never carried.
    const relationId = newId();
    await runPhase(
      importStoryInteractions,
      {
        tagRelations: [base({ tagId: newId(), relationId, relationType: 'Character' })],
      },
      [[relationId, newId()]],
    );
    // A gallery link naming a gallery the file never carried.
    const ownerId = newId();
    await runPhase(
      importStoryInteractions,
      {
        galleryRelations: [base({ galleryId: newId(), ownerId, ownerType: 'Character' })],
      },
      [[ownerId, newId()]],
    );
    // An attribute value naming a field the file never carried.
    await runPhase(importStoryInteractions, {
      attributeValues: [
        base({ entityType: 'Character', entityId: newId(), fieldId: newId(), value: 'Atenas' }),
      ],
    });
  });

  it('final refuses a mode and a ladder with missing ends', async () => {
    const { importStoryFinalCollections } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageFinalImport'
    );
    await runPhase(importStoryFinalCollections, {
      modes: [base({ characterId: newId(), name: 'Eco' })],
    });
    await runPhase(importStoryFinalCollections, {
      stats: [base({ name: 'Coragem' })],
      statStrengths: [base({ statId: newId(), label: 'F', minValue: 0 })],
    });
  });

  it('final refuses comments and stat values with missing ends', async () => {
    const { importStoryFinalCollections } = await import(
      '../../src/services/story-packages/DatabaseStoryPackageFinalImport'
    );
    // A comment on a custom field the file never carried.
    const entityId = newId();
    await runPhase(
      importStoryFinalCollections,
      {
        comments: [
          base({
            entityType: 'Character',
            entityId,
            fieldId: newId(),
            fieldKey: 'aliado',
            contentSnapshot: 'Nyx',
            excerptText: null,
            authorUserId: importerId,
            commentText: 'Olha',
            criticality: 2,
          }),
        ],
      },
      [[entityId, newId()]],
    );
    // A stat value missing its character, its stat and its mode.
    const characterId = newId();
    const statId = newId();
    await runPhase(
      importStoryFinalCollections,
      {
        statRelations: [base({ characterId: newId(), statId, modeId: null, value: 5 })],
      },
      [[statId, newId()]],
    );
    await runPhase(
      importStoryFinalCollections,
      {
        statRelations: [base({ characterId, statId: newId(), modeId: null, value: 5 })],
      },
      [[characterId, newId()]],
    );
    await runPhase(
      importStoryFinalCollections,
      {
        statRelations: [base({ characterId, statId, modeId: newId(), value: 5 })],
      },
      [
        [characterId, newId()],
        [statId, newId()],
      ],
    );
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { AttributeType, type CreateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import type { SyncEntityHandler } from '../../src/services/entity-sync-handlers/BaseSyncEntityHandler';
import { AttributeValueSyncHandler } from '../../src/services/entity-sync-handlers/AttributeValueSyncHandler';
import { BoardSyncHandler } from '../../src/services/entity-sync-handlers/BoardSyncHandler';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { CharacterRelationSyncHandler } from '../../src/services/entity-sync-handlers/CharacterRelationSyncHandler';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { ChoiceCheckGroupSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckGroupSyncHandler';
import { ChoiceCheckSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckSyncHandler';
import { ChoiceSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceSyncHandler';
import { CommentSyncHandler } from '../../src/services/entity-sync-handlers/CommentSyncHandler';
import { EffectSyncHandler } from '../../src/services/entity-sync-handlers/EffectSyncHandler';
import { GalleryRelationSyncHandler } from '../../src/services/entity-sync-handlers/GalleryRelationSyncHandler';
import { GallerySyncHandler } from '../../src/services/entity-sync-handlers/GallerySyncHandler';
import { ItemJourneySyncHandler } from '../../src/services/entity-sync-handlers/ItemJourneySyncHandler';
import { ItemSyncHandler } from '../../src/services/entity-sync-handlers/ItemSyncHandler';
import { LocationMapSyncHandler } from '../../src/services/entity-sync-handlers/LocationMapSyncHandler';
import { LocationRelationSyncHandler } from '../../src/services/entity-sync-handlers/LocationRelationSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { ModeSyncHandler } from '../../src/services/entity-sync-handlers/ModeSyncHandler';
import { NoteRelationSyncHandler } from '../../src/services/entity-sync-handlers/NoteRelationSyncHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
import { PlotSceneSyncHandler } from '../../src/services/entity-sync-handlers/PlotSceneSyncHandler';
import { PlotSyncHandler } from '../../src/services/entity-sync-handlers/PlotSyncHandler';
import { RouteStepSyncHandler } from '../../src/services/entity-sync-handlers/RouteStepSyncHandler';
import { RouteSyncHandler } from '../../src/services/entity-sync-handlers/RouteSyncHandler';
import { SceneSyncHandler } from '../../src/services/entity-sync-handlers/SceneSyncHandler';
import { StatRelationSyncHandler } from '../../src/services/entity-sync-handlers/StatRelationSyncHandler';
import { StatStrengthSyncHandler } from '../../src/services/entity-sync-handlers/StatStrengthSyncHandler';
import { StatSyncHandler } from '../../src/services/entity-sync-handlers/StatSyncHandler';
import { StoryArcSyncHandler } from '../../src/services/entity-sync-handlers/StoryArcSyncHandler';
import { StoryCalendarSyncHandler } from '../../src/services/entity-sync-handlers/StoryCalendarSyncHandler';
import { StorySchemaFieldSyncHandler } from '../../src/services/entity-sync-handlers/StorySchemaFieldSyncHandler';
import { StorySyncHandler } from '../../src/services/entity-sync-handlers/StorySyncHandler';
import { SuggestionSyncHandler } from '../../src/services/entity-sync-handlers/SuggestionSyncHandler';
import { TagRelationSyncHandler } from '../../src/services/entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from '../../src/services/entity-sync-handlers/TagSyncHandler';
import { WorldRuleSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let linearStoryId: string;
let branchingStoryId: string;
/** Fixture ids, keyed by story ('L' linear, 'B' branching) and role. */
let fx: Record<string, string>;

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;

const galleryData = (hash: string) => ({
  mediaType: 'image',
  mimeType: 'image/png',
  fileName: 'nyx.png',
  hash,
  sizeBytes: 1,
  title: null,
  isFavorite: false,
  extraNotes: null,
});

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  linearStoryId = newId();
  branchingStoryId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values([
    {
      id: linearStoryId,
      userId,
      title: 'Linear',
      type: 'linear',
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    },
    {
      id: branchingStoryId,
      userId,
      title: 'Branching',
      type: 'branching',
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    },
  ] as never);

  fx = {};
  const chapters = new ChapterSyncHandler();
  const locations = new LocationSyncHandler();
  const scenes = new SceneSyncHandler();
  const characters = new CharacterSyncHandler();
  for (const [story, prefix] of [
    [linearStoryId, 'L'],
    [branchingStoryId, 'B'],
  ] as const) {
    const chapterId = newId();
    const locationId = newId();
    const sceneId = newId();
    const secondSceneId = newId();
    const characterId = newId();
    fx[`${prefix}chapter`] = chapterId;
    fx[`${prefix}location`] = locationId;
    fx[`${prefix}scene`] = sceneId;
    fx[`${prefix}scene2`] = secondSceneId;
    fx[`${prefix}char`] = characterId;
    await chapters.create(
      userId,
      story,
      create('Chapter', chapterId, {
        name: 'Prologo',
        index: 1,
        summary: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
    await locations.create(
      userId,
      story,
      create('Location', locationId, {
        name: 'Olimpo',
        description: null,
        climate: null,
        culture: null,
        politics: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
    for (const [id, name, index] of [
      [sceneId, 'Chegada', 1],
      [secondSceneId, 'Partida', 2],
    ] as const) {
      await scenes.create(
        userId,
        story,
        create('Scene', id, {
          chapterId,
          locationId,
          name,
          index,
          summary: null,
          gap: null,
          gapType: null,
          duration: null,
          durationType: null,
          isStart: index === 1,
          isFinish: index === 2,
          isFavorite: false,
          extraNotes: null,
        }),
      );
    }
    await characters.create(userId, story, create('Character', characterId, { name: 'Keres' }));
  }
  fx.Lchar2 = newId();
  await characters.create(userId, linearStoryId, create('Character', fx.Lchar2, { name: 'Nyx' }));

  // Branching-only scaffolding: choice, check group, route, item.
  const choiceId = newId();
  fx.Bchoice = choiceId;
  await new ChoiceSyncHandler().create(
    userId,
    branchingStoryId,
    create('Choice', choiceId, {
      sceneId: fx.Bscene,
      nextSceneId: fx.Bscene2,
      text: 'Abrir o portao',
      notes: null,
    }),
  );
  const groupId = newId();
  fx.Bgroup = groupId;
  await new ChoiceCheckGroupSyncHandler().create(
    userId,
    branchingStoryId,
    create('ChoiceCheckGroup', groupId, { choiceId, combinator: 'AND', order: 0 }),
  );
  const routeId = newId();
  fx.Broute = routeId;
  await new RouteSyncHandler().create(
    userId,
    branchingStoryId,
    create('Route', routeId, { name: 'Train', details: null }),
  );
  const itemId = newId();
  fx.Bitem = itemId;
  await new ItemSyncHandler().create(
    userId,
    branchingStoryId,
    create('Item', itemId, {
      characterOwnerId: null,
      name: 'Chave',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    }),
  );

  // Linear-only scaffolding: note, tag, gallery, stat, field, plot.
  const noteId = newId();
  fx.Lnote = noteId;
  await new NoteSyncHandler().create(
    userId,
    linearStoryId,
    create('Note', noteId, { title: 'Profecia', body: null, isFavorite: false, extraNotes: null }),
  );
  const tagId = newId();
  fx.Ltag = tagId;
  await new TagSyncHandler().create(
    userId,
    linearStoryId,
    create('Tag', tagId, { name: 'Viloes', color: null, isFavorite: false, extraNotes: null }),
  );
  const galleryId = newId();
  fx.Lgallery = galleryId;
  await new GallerySyncHandler().create(
    userId,
    linearStoryId,
    create('Gallery', galleryId, galleryData('a'.repeat(32))),
  );
  const statId = newId();
  fx.Lstat = statId;
  await new StatSyncHandler().create(
    userId,
    linearStoryId,
    create('Stat', statId, { name: 'Coragem' }),
  );
  const fieldId = newId();
  fx.Lfield = fieldId;
  await new StorySchemaFieldSyncHandler().create(
    userId,
    linearStoryId,
    create('StorySchemaField', fieldId, {
      entityType: 'Character',
      name: 'Origem',
      key: 'origem',
      description: null,
      type: 'text',
      isRequired: false,
      defaultValue: null,
      order: 0,
    }),
  );
  const plotId = newId();
  fx.Lplot = plotId;
  await new PlotSyncHandler().create(
    userId,
    linearStoryId,
    create('Plot', plotId, { name: 'Main plot', details: null }),
  );
});

type Handler = SyncEntityHandler;

const storyOf = (key: 'L' | 'B') => (key === 'L' ? linearStoryId : branchingStoryId);

/**
 * Entities whose create refuses a second row with the same id. Each case creates once (which
 * must succeed) and then retries the same id (which must fail), proving the resend is reported
 * rather than silently applied twice.
 */
const duplicateIdCases: Array<[string, () => Handler, 'L' | 'B', () => Record<string, unknown>]> = [
  ['Board', () => new BoardSyncHandler(), 'L', () => ({ name: 'Pins' })],
  [
    'LocationMap',
    () => new LocationMapSyncHandler(),
    'L',
    () => ({ name: 'Continent', description: null, content: { images: [], nodes: [] } }),
  ],
  [
    'StoryCalendar',
    () => new StoryCalendarSyncHandler(),
    'L',
    () => ({
      name: 'Moon calendar',
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
    }),
  ],
  [
    'Note',
    () => new NoteSyncHandler(),
    'L',
    () => ({ title: 'Ideia', body: null, isFavorite: false, extraNotes: null }),
  ],
  [
    'WorldRule',
    () => new WorldRuleSyncHandler(),
    'L',
    () => ({ title: 'Magia', description: null, isFavorite: false, extraNotes: null }),
  ],
  [
    'Location',
    () => new LocationSyncHandler(),
    'L',
    () => ({
      name: 'Tartaro',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    }),
  ],
  ['Plot', () => new PlotSyncHandler(), 'L', () => ({ name: 'Side plot', details: null })],
  ['Mode', () => new ModeSyncHandler(), 'L', () => ({ characterId: fx.Lchar, name: 'Desperta' })],
  ['Stat', () => new StatSyncHandler(), 'L', () => ({ name: 'Forca' })],
  ['StatStrength', () => new StatStrengthSyncHandler(), 'L', () => ({ label: 'F', minValue: 0 })],
  ['Gallery', () => new GallerySyncHandler(), 'L', () => galleryData('b'.repeat(32))],
  [
    'Chapter',
    () => new ChapterSyncHandler(),
    'L',
    () => ({ name: 'Ato', index: 3, summary: null, isFavorite: false, extraNotes: null }),
  ],
  ['Route', () => new RouteSyncHandler(), 'B', () => ({ name: 'Boat', details: null })],
  [
    'Choice',
    () => new ChoiceSyncHandler(),
    'B',
    () => ({ sceneId: fx.Bscene, nextSceneId: fx.Bscene2, text: 'Voltar', notes: null }),
  ],
  [
    'ChoiceCheckGroup',
    () => new ChoiceCheckGroupSyncHandler(),
    'B',
    () => ({ choiceId: fx.Bchoice, combinator: 'OR', order: 1 }),
  ],
  [
    'ChoiceCheck',
    () => new ChoiceCheckSyncHandler(),
    'B',
    () => ({
      groupId: fx.Bgroup,
      mode: 'enable',
      type: 'inventory',
      order: 1,
      sceneId: null,
      minVisits: null,
      itemId: null,
      itemPresence: 'has',
      triggerName: null,
      triggerState: null,
    }),
  ],
  [
    'Effect',
    () => new EffectSyncHandler(),
    'B',
    () => ({
      entityType: 'Scene',
      entityId: fx.Bscene,
      effectType: 'itemGrant',
      itemId: null,
      triggerName: null,
    }),
  ],
  [
    'ItemJourney',
    () => new ItemJourneySyncHandler(),
    'B',
    () => ({
      itemId: fx.Bitem,
      sceneId: fx.Bscene2,
      newCharacterOwnerId: null,
      newState: 'perdida',
      extraNotes: null,
    }),
  ],
  [
    'RouteStep',
    () => new RouteStepSyncHandler(),
    'B',
    () => ({ routeId: fx.Broute, position: 1, sceneId: fx.Bscene, selectedChoiceId: null }),
  ],
  [
    'Scene',
    () => new SceneSyncHandler(),
    'L',
    () => ({
      chapterId: null,
      locationId: null,
      name: 'Fragmento',
      index: 1,
      summary: null,
      gap: null,
      gapType: null,
      duration: null,
      durationType: null,
      isFavorite: false,
      extraNotes: null,
    }),
  ],
  [
    'GalleryRelation',
    () => new GalleryRelationSyncHandler(),
    'L',
    () => ({ galleryId: fx.Lgallery, ownerId: fx.Lchar2, ownerType: 'Character' }),
  ],
  [
    'StatRelation',
    () => new StatRelationSyncHandler(),
    'L',
    () => ({ characterId: fx.Lchar, statId: fx.Lstat, value: 5 }),
  ],
];

describe('duplicate sync creates', () => {
  it.each(duplicateIdCases)(
    '%s refuses a second create with an id that is already taken',
    async (entity, build, storyKey, data) => {
      const handler = build();
      const storyId = storyOf(storyKey);
      const id = newId();
      await handler.create(userId, storyId, create(entity, id, data()));

      await expect(handler.create(userId, storyId, create(entity, id, data()))).rejects.toThrow(
        `Conflict: ${entity} with ID ${id} already exists.`,
      );
    },
  );

  it('a Tag refuses a second live row with the same name', async () => {
    const handler = new TagSyncHandler();
    const data = () => ({ name: 'Herois', color: null, isFavorite: false, extraNotes: null });
    await handler.create(userId, linearStoryId, create('Tag', newId(), data()));

    await expect(
      handler.create(userId, linearStoryId, create('Tag', newId(), data())),
    ).rejects.toThrow(/already exists/i);
  });

  it('an Item refuses a second live row with the same name', async () => {
    const handler = new ItemSyncHandler();
    const data = () => ({
      characterOwnerId: null,
      name: 'Escudo',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    });
    await handler.create(userId, linearStoryId, create('Item', newId(), data()));

    await expect(
      handler.create(userId, linearStoryId, create('Item', newId(), data())),
    ).rejects.toThrow(/already exists/i);
  });

  it('a Suggestion refuses a second live row with the same type and value', async () => {
    const handler = new SuggestionSyncHandler();
    const data = { type: 'character-name', value: 'Nyx' };
    await handler.create(userId, linearStoryId, create('Suggestion', newId(), data));

    await expect(
      handler.create(userId, linearStoryId, create('Suggestion', newId(), data)),
    ).rejects.toThrow(/already exists/i);
  });

  it('a StorySchemaField refuses a second live field with the same entity type and key', async () => {
    const handler = new StorySchemaFieldSyncHandler();
    const data = () => ({
      entityType: 'Character',
      name: 'Lar',
      key: 'lar',
      description: null,
      type: 'text',
      isRequired: false,
      defaultValue: null,
      order: 1,
    });
    await handler.create(userId, linearStoryId, create('StorySchemaField', newId(), data()));

    await expect(
      handler.create(userId, linearStoryId, create('StorySchemaField', newId(), data())),
    ).rejects.toThrow(/already exists/i);
  });

  it('an AttributeValue refuses a second live value for the same entity and field', async () => {
    const handler = new AttributeValueSyncHandler();
    const data = {
      entityType: 'Character',
      entityId: fx.Lchar,
      fieldId: fx.Lfield,
      value: 'Atenas',
    };
    await handler.create(userId, linearStoryId, create('AttributeValue', newId(), data));

    await expect(
      handler.create(userId, linearStoryId, create('AttributeValue', newId(), data)),
    ).rejects.toThrow(/already exists/i);
  });

  it('a CharacterRelation refuses a second live relation for the same pair', async () => {
    const handler = new CharacterRelationSyncHandler();
    const data = { character1Id: fx.Lchar, character2Id: fx.Lchar2, relationType: 'siblings' };
    await handler.create(userId, linearStoryId, create('CharacterRelation', newId(), data));

    await expect(
      handler.create(userId, linearStoryId, create('CharacterRelation', newId(), data)),
    ).rejects.toThrow(/already exists/i);
  });
});

describe('create-path reference validation', () => {
  it('a Story refuses an operation time in the future', async () => {
    const handler = new StorySyncHandler();
    const storyId = newId();

    await expect(
      handler.create(userId, storyId, {
        type: 'create',
        entity: 'Story',
        id: storyId,
        data: { title: 'Amanha', type: 'linear' },
        operationTime: new Date(Date.now() + 60_000).toISOString(),
      } as CreateStoryUpdate),
    ).rejects.toThrow(/cannot be in the future/i);
    expect(await handler.findById(storyId)).toBeUndefined();
  });

  it('a StorySchemaField refuses an ENTITY attribute without a target entity type', async () => {
    // The refusal surfaces from the schema's own superRefine, before the handler's identical
    // check runs - the handler line is unreachable defense-in-depth, but the refusal is real.
    await expect(
      new StorySchemaFieldSyncHandler().create(
        userId,
        linearStoryId,
        create('StorySchemaField', newId(), {
          entityType: 'Character',
          name: 'Mentor',
          key: 'mentor',
          description: null,
          type: AttributeType.ENTITY,
          isRequired: false,
          defaultValue: null,
          order: 2,
        }),
      ),
    ).rejects.toThrow(/target entity type/i);
  });

  it('a Chapter links to an arc of its story and refuses one from nowhere', async () => {
    const chapters = new ChapterSyncHandler();
    const arcId = newId();
    await new StoryArcSyncHandler().create(
      userId,
      linearStoryId,
      create('StoryArc', arcId, { title: 'Ato I' }),
    );

    const linkedId = newId();
    await chapters.create(
      userId,
      linearStoryId,
      create('Chapter', linkedId, {
        name: 'Com arco',
        index: 3,
        summary: null,
        isFavorite: false,
        extraNotes: null,
        arcId,
      }),
    );
    expect((await chapters.findByIdOrThrow(linkedId)).arcId).toBe(arcId);

    await expect(
      chapters.create(
        userId,
        linearStoryId,
        create('Chapter', newId(), {
          name: 'Sem arco',
          index: 4,
          summary: null,
          isFavorite: false,
          extraNotes: null,
          arcId: newId(),
        }),
      ),
    ).rejects.toMatchObject({ reason: 'validation' });
  });

  it('a PlotScene refuses to link when the story itself is gone', async () => {
    await expect(
      new PlotSceneSyncHandler().create(
        userId,
        newId(),
        create('PlotScene', newId(), { plotId: fx.Lplot, sceneId: fx.Lscene, note: 'X' }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('a Choice refuses a scene and a next scene that do not belong to the story', async () => {
    const handler = new ChoiceSyncHandler();
    await expect(
      handler.create(
        userId,
        branchingStoryId,
        create('Choice', newId(), {
          sceneId: newId(),
          nextSceneId: fx.Bscene2,
          text: 'Nada',
          notes: null,
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      handler.create(
        userId,
        branchingStoryId,
        create('Choice', newId(), {
          sceneId: fx.Bscene,
          nextSceneId: newId(),
          text: 'Nada',
          notes: null,
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it.each([
    ['route', { routeId: () => newId(), sceneId: () => fx.Bscene, selectedChoiceId: () => null }],
    ['scene', { routeId: () => fx.Broute, sceneId: () => newId(), selectedChoiceId: () => null }],
    [
      'choice',
      { routeId: () => fx.Broute, sceneId: () => fx.Bscene, selectedChoiceId: () => newId() },
    ],
  ])('a RouteStep refuses a missing %s', async (_which, ids) => {
    await expect(
      new RouteStepSyncHandler().create(
        userId,
        branchingStoryId,
        create('RouteStep', newId(), {
          routeId: (ids.routeId as () => string)(),
          position: 1,
          sceneId: (ids.sceneId as () => string)(),
          selectedChoiceId: (ids.selectedChoiceId as () => string | null)(),
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it.each([
    ['item', { itemId: () => newId(), sceneId: () => fx.Bscene, ownerId: () => null }],
    ['scene', { itemId: () => fx.Bitem, sceneId: () => newId(), ownerId: () => null }],
    ['owner', { itemId: () => fx.Bitem, sceneId: () => fx.Bscene, ownerId: () => newId() }],
  ])('an ItemJourney refuses a missing %s', async (_which, ids) => {
    await expect(
      new ItemJourneySyncHandler().create(
        userId,
        branchingStoryId,
        create('ItemJourney', newId(), {
          itemId: (ids.itemId as () => string)(),
          sceneId: (ids.sceneId as () => string)(),
          newCharacterOwnerId: (ids.ownerId as () => string | null)(),
          newState: 'perdida',
          extraNotes: null,
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('an Item refuses an owner that does not belong to the story', async () => {
    await expect(
      new ItemSyncHandler().create(
        userId,
        linearStoryId,
        create('Item', newId(), {
          characterOwnerId: newId(),
          name: 'Adaga',
          category: null,
          description: null,
          initialState: null,
          isFavorite: false,
          extraNotes: null,
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('a Gallery refuses a media type the application could not display', async () => {
    await expect(
      new GallerySyncHandler().create(
        userId,
        linearStoryId,
        create('Gallery', newId(), {
          ...galleryData('c'.repeat(32)),
          mediaType: 'image',
          mimeType: 'application/x-unsupported',
        }),
      ),
    ).rejects.toThrow(/unsupported media MIME type/i);
  });

  it('a Comment refuses a create under another user identity', async () => {
    await expect(
      new CommentSyncHandler().create(
        userId,
        linearStoryId,
        create('Comment', newId(), {
          entityType: 'Character',
          entityId: fx.Lchar,
          fieldId: null,
          fieldKey: 'name',
          contentSnapshot: 'Keres',
          excerptText: null,
          authorUserId: newId(),
          commentText: 'Falsificado',
          criticality: 2,
        }),
      ),
    ).rejects.toMatchObject({ reason: 'unauthorized' });
  });

  it('a TagRelation refuses an unknown relation type, a missing tag, and a missing endpoint', async () => {
    const handler = new TagRelationSyncHandler();
    await expect(
      handler.create(
        userId,
        linearStoryId,
        create('TagRelation', newId(), {
          tagId: fx.Ltag,
          relationId: fx.Lchar,
          relationType: 'Starship',
        }),
      ),
    ).rejects.toThrow(/Unknown relationType/i);
    await expect(
      handler.create(
        userId,
        linearStoryId,
        create('TagRelation', newId(), {
          tagId: newId(),
          relationId: fx.Lchar,
          relationType: 'Character',
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    await expect(
      handler.create(
        userId,
        linearStoryId,
        create('TagRelation', newId(), {
          tagId: fx.Ltag,
          relationId: newId(),
          relationType: 'Character',
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('a GalleryRelation refuses a missing gallery and a missing owner', async () => {
    const handler = new GalleryRelationSyncHandler();
    await expect(
      handler.create(
        userId,
        linearStoryId,
        create('GalleryRelation', newId(), {
          galleryId: newId(),
          ownerId: fx.Lchar,
          ownerType: 'Character',
        }),
      ),
    ).rejects.toMatchObject({ reason: 'not_found' });
    await expect(
      handler.create(
        userId,
        linearStoryId,
        create('GalleryRelation', newId(), {
          galleryId: fx.Lgallery,
          ownerId: newId(),
          ownerType: 'Character',
        }),
      ),
    ).rejects.toMatchObject({ reason: 'not_found' });
  });

  it.each(['Character', 'Location', 'WorldRule', 'Scene', 'Chapter'] as const)(
    'a NoteRelation refuses a missing %s endpoint',
    async (relationType) => {
      await expect(
        new NoteRelationSyncHandler().create(
          userId,
          linearStoryId,
          create('NoteRelation', newId(), {
            noteId: fx.Lnote,
            relationId: newId(),
            relationType,
          }),
        ),
      ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
    },
  );

  it('a CharacterRelation refuses a missing first character', async () => {
    // Both endpoints missing: the sorted pair still checks character 1 first.
    await expect(
      new CharacterRelationSyncHandler().create(
        userId,
        linearStoryId,
        create('CharacterRelation', newId(), {
          character1Id: newId(),
          character2Id: newId(),
          relationType: 'siblings',
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('a CharacterRelation refuses a missing second character', async () => {
    await expect(
      new CharacterRelationSyncHandler().create(
        userId,
        linearStoryId,
        create('CharacterRelation', newId(), {
          character1Id: fx.Lchar,
          character2Id: newId(),
          relationType: 'siblings',
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });

  it('a LocationRelation refuses a missing parent', async () => {
    await expect(
      new LocationRelationSyncHandler().create(
        userId,
        linearStoryId,
        create('LocationRelation', newId(), {
          locationAId: newId(),
          locationBId: fx.Llocation,
          relationType: 'contains',
        }),
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });
});

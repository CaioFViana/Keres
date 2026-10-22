import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '@/db';
import { choices, locationRelations, stories, users } from '@/db/schema';
import { CharacterRelationSyncHandler } from '@/services/entity-sync-handlers/CharacterRelationSyncHandler';
import { CharacterSyncHandler } from '@/services/entity-sync-handlers/CharacterSyncHandler';
import { ChapterSyncHandler } from '@/services/entity-sync-handlers/ChapterSyncHandler';
import { ChoiceCheckGroupSyncHandler } from '@/services/entity-sync-handlers/ChoiceCheckGroupSyncHandler';
import { ChoiceCheckSyncHandler } from '@/services/entity-sync-handlers/ChoiceCheckSyncHandler';
import { ChoiceSyncHandler } from '@/services/entity-sync-handlers/ChoiceSyncHandler';
import { CharacterSceneSyncHandler } from '@/services/entity-sync-handlers/CharacterSceneSyncHandler';
import { EffectSyncHandler } from '@/services/entity-sync-handlers/EffectSyncHandler';
import { GalleryRelationSyncHandler } from '@/services/entity-sync-handlers/GalleryRelationSyncHandler';
import { GallerySyncHandler } from '@/services/entity-sync-handlers/GallerySyncHandler';
import { ItemJourneySyncHandler } from '@/services/entity-sync-handlers/ItemJourneySyncHandler';
import { ItemSyncHandler } from '@/services/entity-sync-handlers/ItemSyncHandler';
import { LocationRelationSyncHandler } from '@/services/entity-sync-handlers/LocationRelationSyncHandler';
import { LocationSyncHandler } from '@/services/entity-sync-handlers/LocationSyncHandler';
import { ModeSyncHandler } from '@/services/entity-sync-handlers/ModeSyncHandler';
import { NoteRelationSyncHandler } from '@/services/entity-sync-handlers/NoteRelationSyncHandler';
import { NoteSyncHandler } from '@/services/entity-sync-handlers/NoteSyncHandler';
import { RouteStepSyncHandler } from '@/services/entity-sync-handlers/RouteStepSyncHandler';
import { RouteSyncHandler } from '@/services/entity-sync-handlers/RouteSyncHandler';
import { SceneSyncHandler } from '@/services/entity-sync-handlers/SceneSyncHandler';
import { SeeAlsoRelationSyncHandler } from '@/services/entity-sync-handlers/SeeAlsoRelationSyncHandler';
import { StatRelationSyncHandler } from '@/services/entity-sync-handlers/StatRelationSyncHandler';
import { StatStrengthSyncHandler } from '@/services/entity-sync-handlers/StatStrengthSyncHandler';
import { StatSyncHandler } from '@/services/entity-sync-handlers/StatSyncHandler';
import { StoryCalendarSyncHandler } from '@/services/entity-sync-handlers/StoryCalendarSyncHandler';
import { StorySchemaFieldSyncHandler } from '@/services/entity-sync-handlers/StorySchemaFieldSyncHandler';
import { StorySyncHandler } from '@/services/entity-sync-handlers/StorySyncHandler';
import { SuggestionSyncHandler } from '@/services/entity-sync-handlers/SuggestionSyncHandler';
import { TagRelationSyncHandler } from '@/services/entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from '@/services/entity-sync-handlers/TagSyncHandler';
import { mediaStorageService } from '@/services/media-storage/MediaStorageService';
import { installBunShim } from '@test/helpers/bunShim';
import { newId } from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';
import { renumberArranged } from '@/services/sync/arrangedRanks';

installBunShim();

let userId: string;
let linearStoryId: string;
let branchingStoryId: string;
let fx: Record<string, string>;

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;
const change = (entity: string, id: string, changes: Record<string, unknown>) =>
  ({ type: 'update', entity, id, changes }) as UpdateStoryUpdate;
const remove = (entity: string, id: string, version: number) =>
  ({ type: 'delete', entity, id, version }) as DeleteStoryUpdate;

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

const calendarData = () => ({
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
    const chapter2Id = newId();
    const locationId = newId();
    const location2Id = newId();
    const sceneId = newId();
    const secondSceneId = newId();
    const characterId = newId();
    fx[`${prefix}chapter`] = chapterId;
    fx[`${prefix}chapter2`] = chapter2Id;
    fx[`${prefix}location`] = locationId;
    fx[`${prefix}location2`] = location2Id;
    fx[`${prefix}scene`] = sceneId;
    fx[`${prefix}scene2`] = secondSceneId;
    fx[`${prefix}char`] = characterId;
    for (const [id, name, index] of [
      [chapterId, 'Prologo', 1],
      [chapter2Id, 'Epilogo', 2],
    ] as const) {
      await chapters.create(
        create('Chapter', id, {
          name,
          index,
          summary: null,
          isFavorite: false,
          extraNotes: null,
        }),
        { userId, storyId: story },
      );
    }
    for (const [id, name] of [
      [locationId, 'Olimpo'],
      [location2Id, 'Tartaro'],
    ] as const) {
      await locations.create(
        create('Location', id, {
          name,
          description: null,
          climate: null,
          culture: null,
          politics: null,
          isFavorite: false,
          extraNotes: null,
        }),
        { userId, storyId: story },
      );
    }
    for (const [id, name, index] of [
      [sceneId, 'Chegada', 1],
      [secondSceneId, 'Partida', 2],
    ] as const) {
      await scenes.create(
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
        { userId, storyId: story },
      );
    }
    await characters.create(create('Character', characterId, { name: 'Keres' }), {
      userId,
      storyId: story,
    });
  }
  fx.Lchar2 = newId();
  fx.Lchar3 = newId();
  await characters.create(create('Character', fx.Lchar2, { name: 'Nyx' }), {
    userId,
    storyId: linearStoryId,
  });
  await characters.create(create('Character', fx.Lchar3, { name: 'Erebo' }), {
    userId,
    storyId: linearStoryId,
  });

  const choiceId = newId();
  fx.Bchoice = choiceId;
  await new ChoiceSyncHandler().create(
    create('Choice', choiceId, {
      sceneId: fx.Bscene,
      nextSceneId: fx.Bscene2,
      text: 'Abrir o portao',
      notes: null,
    }),
    { userId, storyId: branchingStoryId },
  );
  const routeId = newId();
  fx.Broute = routeId;
  await new RouteSyncHandler().create(create('Route', routeId, { name: 'Train', details: null }), {
    userId,
    storyId: branchingStoryId,
  });
  const itemId = newId();
  fx.Bitem = itemId;
  await new ItemSyncHandler().create(
    create('Item', itemId, {
      characterOwnerId: null,
      name: 'Chave',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    }),
    { userId, storyId: branchingStoryId },
  );
  const noteId = newId();
  fx.Lnote = noteId;
  await new NoteSyncHandler().create(
    create('Note', noteId, { title: 'Profecia', body: null, isFavorite: false, extraNotes: null }),
    { userId, storyId: linearStoryId },
  );
  const tagId = newId();
  fx.Ltag = tagId;
  await new TagSyncHandler().create(
    create('Tag', tagId, { name: 'Viloes', color: null, isFavorite: false, extraNotes: null }),
    { userId, storyId: linearStoryId },
  );
  const galleryId = newId();
  fx.Lgallery = galleryId;
  await new GallerySyncHandler().create(create('Gallery', galleryId, galleryData('a'.repeat(32))), {
    userId,
    storyId: linearStoryId,
  });
  const statId = newId();
  fx.Lstat = statId;
  await new StatSyncHandler().create(create('Stat', statId, { name: 'Coragem' }), {
    userId,
    storyId: linearStoryId,
  });
});

describe('choice and route update paths', () => {
  it('a Choice re-points its scenes on update', async () => {
    const handler = new ChoiceSyncHandler();
    const current = await handler.findByIdOrThrow(fx.Bchoice);

    await handler.update(
      change('Choice', fx.Bchoice, {
        sceneId: fx.Bscene2,
        nextSceneId: fx.Bscene,
        version: 1,
      }),
      current,
      { userId, storyId: branchingStoryId },
    );

    expect(await handler.findByIdOrThrow(fx.Bchoice)).toMatchObject({
      sceneId: fx.Bscene2,
      nextSceneId: fx.Bscene,
      version: 2,
    });
  });

  it('a Choice refuses direct writes in a linear story', async () => {
    const handler = new ChoiceSyncHandler();
    const now = new Date();
    const linearChoiceId = newId();
    await db.insert(choices).values({
      id: linearChoiceId,
      storyId: linearStoryId,
      sceneId: fx.Lscene,
      nextSceneId: fx.Lscene2,
      text: 'Legado',
      notes: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    } as never);
    const current = await handler.findByIdOrThrow(linearChoiceId);

    await expect(
      handler.create(
        create('Choice', newId(), {
          sceneId: fx.Lscene,
          nextSceneId: fx.Lscene2,
          text: 'Novo',
          notes: null,
        }),
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/linear story/i);
    await expect(
      handler.update(change('Choice', linearChoiceId, { text: 'Editado', version: 1 }), current, {
        userId,
        storyId: linearStoryId,
      }),
    ).rejects.toThrow(/linear story/i);
    await expect(
      handler.delete(remove('Choice', linearChoiceId, 1), current, {
        userId,
        storyId: linearStoryId,
      }),
    ).rejects.toThrow(/linear story/i);
    expect(await handler.findByIdOrThrow(linearChoiceId)).toMatchObject({
      text: 'Legado',
      isDeleted: false,
    });
  });

  it('a Route deletes through the branching guard', async () => {
    const handler = new RouteSyncHandler();
    const current = await handler.findByIdOrThrow(fx.Broute);

    await handler.delete(remove('Route', fx.Broute, 1), current, {
      userId,
      storyId: branchingStoryId,
      database: db,
    });

    expect(await handler.findByIdOrThrow(fx.Broute)).toMatchObject({
      isDeleted: true,
      version: 2,
    });
  });

  it('a RouteStep moves position without re-resolving its endpoints', async () => {
    const handler = new RouteStepSyncHandler();
    const id = newId();
    await handler.create(
      create('RouteStep', id, {
        routeId: fx.Broute,
        position: 1,
        sceneId: fx.Bscene,
        selectedChoiceId: fx.Bchoice,
      }),
      { userId, storyId: branchingStoryId },
    );
    const current = await handler.findByIdOrThrow(id);

    await handler.update(change('RouteStep', id, { position: 5, version: 1 }), current, {
      userId,
      storyId: branchingStoryId,
      database: db,
    });

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      position: 5,
      routeId: fx.Broute,
      sceneId: fx.Bscene,
      selectedChoiceId: fx.Bchoice,
      version: 2,
    });
  });

  it('a RouteStep re-points its route, scene and choice on update', async () => {
    const handler = new RouteStepSyncHandler();
    const route2 = newId();
    await new RouteSyncHandler().create(create('Route', route2, { name: 'Boat', details: null }), {
      userId,
      storyId: branchingStoryId,
    });
    const choice2 = newId();
    await new ChoiceSyncHandler().create(
      create('Choice', choice2, {
        sceneId: fx.Bscene2,
        nextSceneId: fx.Bscene,
        text: 'Voltar',
        notes: null,
      }),
      { userId, storyId: branchingStoryId },
    );
    const id = newId();
    await handler.create(
      create('RouteStep', id, {
        routeId: fx.Broute,
        position: 1,
        sceneId: fx.Bscene,
        selectedChoiceId: null,
      }),
      { userId, storyId: branchingStoryId },
    );
    const current = await handler.findByIdOrThrow(id);

    await handler.update(
      change('RouteStep', id, {
        routeId: route2,
        sceneId: fx.Bscene2,
        selectedChoiceId: choice2,
        version: 1,
      }),
      current,
      { userId, storyId: branchingStoryId },
    );

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      routeId: route2,
      sceneId: fx.Bscene2,
      selectedChoiceId: choice2,
      version: 2,
    });
  });

  it('a RouteStep update re-validates moved endpoints', async () => {
    const handler = new RouteStepSyncHandler();
    const id = newId();
    await handler.create(
      create('RouteStep', id, {
        routeId: fx.Broute,
        position: 1,
        sceneId: fx.Bscene,
        selectedChoiceId: null,
      }),
      { userId, storyId: branchingStoryId },
    );
    const current = await handler.findByIdOrThrow(id);

    await expect(
      handler.update(change('RouteStep', id, { sceneId: newId(), version: 1 }), current, {
        userId,
        storyId: branchingStoryId,
      }),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });
});

describe('item, mode and stat update paths', () => {
  it('an Item renames to a free name and edits other fields without a uniqueness check', async () => {
    const handler = new ItemSyncHandler();
    const id = newId();
    await handler.create(
      create('Item', id, {
        characterOwnerId: fx.Lchar,
        name: 'Espada',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('Item', id, { name: 'Espada longa', version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ name: 'Espada longa', version: 2 });

    await handler.update(
      change('Item', id, { description: 'Forjada em Styx', version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    await handler.update(
      change('Item', id, { name: 'Espada longa', version: 3 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      description: 'Forjada em Styx',
      version: 4,
    });
  });

  it('an Item re-homes its owner on update', async () => {
    const handler = new ItemSyncHandler();
    const id = newId();
    await handler.create(
      create('Item', id, {
        characterOwnerId: fx.Lchar,
        name: 'Escudo',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('Item', id, { characterOwnerId: fx.Lchar2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterOwnerId: fx.Lchar2,
      version: 2,
    });
  });

  it('a Mode edits its name and moves to another character', async () => {
    const handler = new ModeSyncHandler();
    const id = newId();
    await handler.create(create('Mode', id, { characterId: fx.Lchar, name: 'Desperta' }), {
      userId,
      storyId: linearStoryId,
    });

    await handler.update(
      change('Mode', id, { name: 'Adormecida', version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ name: 'Adormecida', version: 2 });

    await handler.update(
      change('Mode', id, { characterId: fx.Lchar2, version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterId: fx.Lchar2,
      version: 3,
    });
  });

  it('a Stat renames without consulting the primary limit', async () => {
    const handler = new StatSyncHandler();

    await handler.update(
      change('Stat', fx.Lstat, { name: 'Bravura', version: 1 }),
      await handler.findByIdOrThrow(fx.Lstat),
      { userId, storyId: linearStoryId },
    );

    expect(await handler.findByIdOrThrow(fx.Lstat)).toMatchObject({ name: 'Bravura', version: 2 });
  });

  it('a Stat already primary stays primary without consulting the limit', async () => {
    const handler = new StatSyncHandler();

    await handler.update(
      change('Stat', fx.Lstat, { isPrimary: true, version: 1 }),
      await handler.findByIdOrThrow(fx.Lstat),
      { userId, storyId: linearStoryId },
    );

    expect(await handler.findByIdOrThrow(fx.Lstat)).toMatchObject({ isPrimary: true, version: 2 });
  });

  it('a StatStrength relabels without touching its floor and moves ladders', async () => {
    const handler = new StatStrengthSyncHandler();
    const id = newId();
    await handler.create(
      create('StatStrength', id, { statId: fx.Lstat, label: 'F', minValue: 0 }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('StatStrength', id, { label: 'Fraco', version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ label: 'Fraco', version: 2 });

    const otherStat = newId();
    await new StatSyncHandler().create(create('Stat', otherStat, { name: 'Sabedoria' }), {
      userId,
      storyId: linearStoryId,
    });
    await handler.update(
      change('StatStrength', id, { statId: otherStat, version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ statId: otherStat, version: 3 });
  });

  it('a StatRelation edits its value and re-points each key', async () => {
    const handler = new StatRelationSyncHandler();
    const modeId = newId();
    await new ModeSyncHandler().create(
      create('Mode', modeId, { characterId: fx.Lchar, name: 'Desperta' }),
      { userId, storyId: linearStoryId },
    );
    const otherStat = newId();
    await new StatSyncHandler().create(create('Stat', otherStat, { name: 'Sabedoria' }), {
      userId,
      storyId: linearStoryId,
    });
    const id = newId();
    await handler.create(
      create('StatRelation', id, { characterId: fx.Lchar, statId: fx.Lstat, value: 5 }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('StatRelation', id, { value: 7, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ value: 7, version: 2 });

    await handler.update(
      change('StatRelation', id, { characterId: fx.Lchar2, version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterId: fx.Lchar2,
      version: 3,
    });

    const mode2 = newId();
    await new ModeSyncHandler().create(
      create('Mode', mode2, { characterId: fx.Lchar2, name: 'Eco' }),
      { userId, storyId: linearStoryId },
    );
    await handler.update(
      change('StatRelation', id, { modeId: mode2, version: 3 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ modeId: mode2, version: 4 });

    await handler.update(
      change('StatRelation', id, { statId: otherStat, version: 4 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ statId: otherStat, version: 5 });
  });
});

describe('check, group, effect and suggestion update paths', () => {
  const checkData = (groupId: string) => ({
    groupId,
    mode: 'enable',
    type: 'inventory',
    order: 0,
    sceneId: null,
    minVisits: null,
    itemId: null,
    itemPresence: 'has',
    triggerName: null,
    triggerState: null,
  });

  it('a ChoiceCheck re-points each endpoint and edits without re-checking', async () => {
    const groups = new ChoiceCheckGroupSyncHandler();
    const handler = new ChoiceCheckSyncHandler();
    const group2 = newId();
    await groups.create(
      create('ChoiceCheckGroup', group2, { choiceId: fx.Bchoice, combinator: 'OR', order: 1 }),
      { userId, storyId: branchingStoryId },
    );
    const group1 = newId();
    await groups.create(
      create('ChoiceCheckGroup', group1, { choiceId: fx.Bchoice, combinator: 'AND', order: 0 }),
      { userId, storyId: branchingStoryId },
    );
    const id = newId();
    await handler.create(create('ChoiceCheck', id, checkData(group1)), {
      userId,
      storyId: branchingStoryId,
    });

    await handler.update(
      change('ChoiceCheck', id, { sceneId: fx.Bscene, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ sceneId: fx.Bscene, version: 2 });

    await handler.update(
      change('ChoiceCheck', id, { itemId: fx.Bitem, version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ itemId: fx.Bitem, version: 3 });

    await handler.update(
      change('ChoiceCheck', id, { groupId: group2, version: 3 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ groupId: group2, version: 4 });

    await handler.update(
      change('ChoiceCheck', id, { order: 9, version: 4 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ order: 9, version: 5 });
  });

  it('a ChoiceCheckGroup moves to another choice and edits without re-checking', async () => {
    const handler = new ChoiceCheckGroupSyncHandler();
    const choice2 = newId();
    await new ChoiceSyncHandler().create(
      create('Choice', choice2, {
        sceneId: fx.Bscene2,
        nextSceneId: fx.Bscene,
        text: 'Voltar',
        notes: null,
      }),
      { userId, storyId: branchingStoryId },
    );
    const id = newId();
    await handler.create(
      create('ChoiceCheckGroup', id, { choiceId: fx.Bchoice, combinator: 'AND', order: 0 }),
      { userId, storyId: branchingStoryId },
    );

    await handler.update(
      change('ChoiceCheckGroup', id, { choiceId: choice2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ choiceId: choice2, version: 2 });

    await handler.update(
      change('ChoiceCheckGroup', id, { combinator: 'OR', version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ combinator: 'OR', version: 3 });
  });

  it('an Effect re-points its item and edits without re-checking', async () => {
    const handler = new EffectSyncHandler();
    const item2 = newId();
    await new ItemSyncHandler().create(
      create('Item', item2, {
        characterOwnerId: null,
        name: 'Mapa',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId: branchingStoryId },
    );
    const id = newId();
    await handler.create(
      create('Effect', id, {
        entityType: 'Scene',
        entityId: fx.Bscene,
        effectType: 'itemGrant',
        itemId: null,
        triggerName: null,
      }),
      { userId, storyId: branchingStoryId },
    );

    await handler.update(
      change('Effect', id, { itemId: item2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ itemId: item2, version: 2 });

    await handler.update(
      change('Effect', id, { triggerName: 'portao', version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ triggerName: 'portao', version: 3 });
  });

  it('a Suggestion retitles its type and restates its own value', async () => {
    const handler = new SuggestionSyncHandler();
    const id = newId();
    await handler.create(create('Suggestion', id, { type: 'character-name', value: 'Nyx' }), {
      userId,
      storyId: linearStoryId,
    });

    await handler.update(
      change('Suggestion', id, { type: 'place-name', version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ type: 'place-name', version: 2 });

    await handler.update(
      change('Suggestion', id, { type: 'place-name', version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 3 });

    await handler.update(
      change('Suggestion', id, { version: 3 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 4 });
  });

  it('a Suggestion edit that collides with another row is rejected', async () => {
    const handler = new SuggestionSyncHandler();
    await handler.create(create('Suggestion', newId(), { type: 'character-name', value: 'Nyx' }), {
      userId,
      storyId: linearStoryId,
    });
    const id = newId();
    await handler.create(create('Suggestion', id, { type: 'character-name', value: 'Erebo' }), {
      userId,
      storyId: linearStoryId,
    });

    await expect(
      handler.update(
        change('Suggestion', id, { value: 'Nyx', version: 1 }),
        await handler.findByIdOrThrow(id),
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/already exists/i);
    expect((await handler.findByIdOrThrow(id)).value).toBe('Erebo');
  });
});

describe('tag and scene update paths', () => {
  it('a Tag edits its color and restates its own name', async () => {
    const handler = new TagSyncHandler();

    await handler.update(
      change('Tag', fx.Ltag, { color: '#ff0000', version: 1 }),
      await handler.findByIdOrThrow(fx.Ltag),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Ltag)).toMatchObject({ color: '#ff0000', version: 2 });

    await handler.update(
      change('Tag', fx.Ltag, { name: 'Viloes', version: 2 }),
      await handler.findByIdOrThrow(fx.Ltag),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Ltag)).toMatchObject({ version: 3 });
  });

  it('a TagRelation moves each key and lands a free retarget', async () => {
    const handler = new TagRelationSyncHandler();
    const tag2 = newId();
    await new TagSyncHandler().create(
      create('Tag', tag2, { name: 'Herois', color: null, isFavorite: false, extraNotes: null }),
      { userId, storyId: linearStoryId },
    );
    const id = newId();
    await handler.create(
      create('TagRelation', id, {
        tagId: fx.Ltag,
        relationId: fx.Lchar,
        relationType: 'Character',
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('TagRelation', id, { tagId: tag2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ tagId: tag2, version: 2 });

    await handler.update(
      change('TagRelation', id, {
        relationId: fx.Lchar2,
        relationType: 'Character',
        version: 2,
      }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      relationId: fx.Lchar2,
      version: 3,
    });

    await handler.update(
      change('TagRelation', id, {
        relationId: fx.Llocation,
        relationType: 'Location',
        version: 3,
      }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      relationId: fx.Llocation,
      relationType: 'Location',
      version: 4,
    });

    await handler.update(
      change('TagRelation', id, { version: 4 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 5 });
  });

  it('a Scene moves chapter, location and calendar override', async () => {
    const handler = new SceneSyncHandler();
    const calendarId = newId();
    await new StoryCalendarSyncHandler().create(
      create('StoryCalendar', calendarId, calendarData()),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('Scene', fx.Lscene, { chapterId: fx.Lchapter2, version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      chapterId: fx.Lchapter2,
      version: 2,
    });

    await handler.update(
      change('Scene', fx.Lscene, { locationId: fx.Llocation2, version: 2 }),
      await handler.findByIdOrThrow(fx.Lscene),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      locationId: fx.Llocation2,
      version: 3,
    });

    await handler.update(
      change('Scene', fx.Lscene, { calendarDateOverrideCalendarId: calendarId, version: 3 }),
      await handler.findByIdOrThrow(fx.Lscene),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      calendarDateOverrideCalendarId: calendarId,
      version: 4,
    });
  });

  /**
   * The operation writes its own row and nothing else: a linear story's single start and finish
   * are kept by the client, which records each other scene's loss of the flag as its own edit.
   * Changed here unlogged, no other device would ever learn of it.
   */
  it('a Scene taking the start or finish flag touches no other scene', async () => {
    const handler = new SceneSyncHandler();

    await handler.update(
      change('Scene', fx.Lscene2, { isStart: true, version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene2),
      { userId, storyId: linearStoryId },
    );
    await handler.update(
      change('Scene', fx.Lscene, { isFinish: true, version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene),
      { userId, storyId: linearStoryId },
    );

    expect(await handler.findByIdOrThrow(fx.Lscene2)).toMatchObject({ isStart: true, version: 2 });
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({ isFinish: true, version: 2 });
  });

  it('a Scene edits its name without touching flags and deletes through the base path', async () => {
    const handler = new SceneSyncHandler();

    await handler.update(
      change('Scene', fx.Lscene, { name: 'Chegada revisada', version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      name: 'Chegada revisada',
      isStart: true,
      version: 2,
    });

    await handler.delete(remove('Scene', fx.Lscene, 2), await handler.findByIdOrThrow(fx.Lscene), {
      userId,
      storyId: linearStoryId,
      database: db,
    });
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({ isDeleted: true, version: 3 });
  });

  it('a Scene on a branching story edits without the linear start/finish handling', async () => {
    const handler = new SceneSyncHandler();

    await handler.update(
      change('Scene', fx.Bscene, { name: 'Chegada revisada', version: 1 }),
      await handler.findByIdOrThrow(fx.Bscene),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Bscene)).toMatchObject({
      name: 'Chegada revisada',
      version: 2,
    });
  });
});

describe('relation update paths', () => {
  it('a CharacterRelation retargets one endpoint', async () => {
    const handler = new CharacterRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('CharacterRelation', id, {
        character1Id: fx.Lchar,
        character2Id: fx.Lchar2,
        relationType: 'siblings',
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('CharacterRelation', id, { character2Id: fx.Lchar3, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );

    const updated = await handler.findByIdOrThrow(id);
    expect([updated.character1Id, updated.character2Id].sort()).toEqual(
      [fx.Lchar, fx.Lchar3].sort(),
    );
    expect(updated.version).toBe(2);
  });

  it('a CharacterRelation refuses to link a character to itself on update', async () => {
    const handler = new CharacterRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('CharacterRelation', id, {
        character1Id: fx.Lchar,
        character2Id: fx.Lchar2,
        relationType: 'siblings',
      }),
      { userId, storyId: linearStoryId },
    );

    // A single-key edit passes the partial schema (which only compares two provided keys) and
    // reaches the handler's own identity check.
    const current = await handler.findByIdOrThrow(id);
    await expect(
      handler.update(
        change('CharacterRelation', id, { character1Id: current.character2Id, version: 1 }),
        current,
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/cannot be identical/i);
  });

  it('a LocationRelation retargets its endpoints and accepts a plain touch', async () => {
    const handler = new LocationRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
      { userId, storyId: linearStoryId },
    );

    const third = newId();
    await new LocationSyncHandler().create(
      create('Location', third, {
        name: 'Erebo',
        description: null,
        climate: null,
        culture: null,
        politics: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId: linearStoryId },
    );
    await handler.update(
      change('LocationRelation', id, { locationAId: fx.Llocation, locationBId: third, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      locationBId: third,
      version: 2,
    });

    await handler.update(
      change('LocationRelation', id, { version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 3 });
  });

  it('a LocationRelation converting to contains takes the parent slot', async () => {
    const handler = new LocationRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('LocationRelation', id, { relationType: 'contains', version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      relationType: 'contains',
      version: 2,
    });
  });

  it('a LocationRelation update that duplicates a connection is rejected', async () => {
    const handler = new LocationRelationSyncHandler();
    await handler.create(
      create('LocationRelation', newId(), {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
      { userId, storyId: linearStoryId },
    );
    const third = newId();
    await new LocationSyncHandler().create(
      create('Location', third, {
        name: 'Erebo',
        description: null,
        climate: null,
        culture: null,
        politics: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId: linearStoryId },
    );
    const id = newId();
    await handler.create(
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: third,
        relationType: 'connected_to',
      }),
      { userId, storyId: linearStoryId },
    );

    await expect(
      handler.update(
        change('LocationRelation', id, { locationBId: fx.Llocation2, version: 1 }),
        await handler.findByIdOrThrow(id),
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/already exists/i);
  });

  it('a LocationRelation refuses to link a location to itself on update', async () => {
    const handler = new LocationRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
      { userId, storyId: linearStoryId },
    );
    const current = await handler.findByIdOrThrow(id);

    // A single-key edit passes the partial schema and reaches the handler's own identity check.
    await expect(
      handler.update(
        change('LocationRelation', id, { locationAId: current.locationBId, version: 1 }),
        current,
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/cannot be identical/i);
  });

  it('a LocationRelation refuses a parent walk that never reaches the top', async () => {
    const handler = new LocationRelationSyncHandler();
    const now = new Date();
    const a = newId();
    const b = newId();
    const c = newId();
    for (const [id, name] of [
      [a, 'A'],
      [b, 'B'],
      [c, 'C'],
    ] as const) {
      await new LocationSyncHandler().create(
        create('Location', id, {
          name,
          description: null,
          climate: null,
          culture: null,
          politics: null,
          isFavorite: false,
          extraNotes: null,
        }),
        { userId, storyId: linearStoryId },
      );
    }
    // A corrupted cycle the handler could never write itself (it checks): inserted directly.
    await db.insert(locationRelations).values([
      {
        id: newId(),
        storyId: linearStoryId,
        locationAId: a,
        locationBId: b,
        relationType: 'contains',
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      },
      {
        id: newId(),
        storyId: linearStoryId,
        locationAId: b,
        locationBId: a,
        relationType: 'contains',
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: null,
      },
    ] as never);

    await expect(
      handler.create(
        create('LocationRelation', newId(), {
          locationAId: a,
          locationBId: c,
          relationType: 'contains',
        }),
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/maximum allowed depth/i);
  });

  it('a GalleryRelation re-links to a free owner and restates its own link', async () => {
    const handler = new GalleryRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('GalleryRelation', id, {
        galleryId: fx.Lgallery,
        ownerId: fx.Lchar,
        ownerType: 'Character',
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('GalleryRelation', id, { ownerId: fx.Lchar2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ ownerId: fx.Lchar2, version: 2 });

    await handler.update(
      change('GalleryRelation', id, {
        ownerId: fx.Llocation,
        ownerType: 'Location',
        version: 2,
      }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      ownerId: fx.Llocation,
      ownerType: 'Location',
      version: 3,
    });

    // Restating the same gallery finds only itself in the duplicate check and lands.
    await handler.update(
      change('GalleryRelation', id, { galleryId: fx.Lgallery, version: 3 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 4 });

    await handler.update(
      change('GalleryRelation', id, { version: 4 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 5 });
  });

  it('a GalleryRelation retarget onto an occupied pair is rejected', async () => {
    const handler = new GalleryRelationSyncHandler();
    await handler.create(
      create('GalleryRelation', newId(), {
        galleryId: fx.Lgallery,
        ownerId: fx.Lchar2,
        ownerType: 'Character',
      }),
      { userId, storyId: linearStoryId },
    );
    const id = newId();
    await handler.create(
      create('GalleryRelation', id, {
        galleryId: fx.Lgallery,
        ownerId: fx.Lchar,
        ownerType: 'Character',
      }),
      { userId, storyId: linearStoryId },
    );

    await expect(
      handler.update(
        change('GalleryRelation', id, { ownerId: fx.Lchar2, version: 1 }),
        await handler.findByIdOrThrow(id),
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/already linked/i);
  });

  it('a NoteRelation refuses to swap its note and its endpoint type', async () => {
    const handler = new NoteRelationSyncHandler();
    const note2 = newId();
    await new NoteSyncHandler().create(
      create('Note', note2, { title: 'Outra', body: null, isFavorite: false, extraNotes: null }),
      { userId, storyId: linearStoryId },
    );
    const id = newId();
    await handler.create(
      create('NoteRelation', id, {
        noteId: fx.Lnote,
        relationId: fx.Lchar,
        relationType: 'Character',
      }),
      { userId, storyId: linearStoryId },
    );
    const current = await handler.findByIdOrThrow(id);

    await expect(
      handler.update(change('NoteRelation', id, { noteId: note2, version: 1 }), current, {
        userId,
        storyId: linearStoryId,
      }),
    ).rejects.toThrow(/Cannot change 'noteId'/i);
    await expect(
      handler.update(
        change('NoteRelation', id, { relationType: 'Location', version: 1 }),
        current,
        { userId, storyId: linearStoryId },
      ),
    ).rejects.toThrow(/Cannot change 'relationType'/i);
  });

  it('a NoteRelation restating its own endpoints is a plain touch', async () => {
    const handler = new NoteRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('NoteRelation', id, {
        noteId: fx.Lnote,
        relationId: fx.Lchar,
        relationType: 'Character',
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('NoteRelation', id, {
        noteId: fx.Lnote,
        relationId: fx.Lchar,
        relationType: 'Character',
        version: 1,
      }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 2 });

    await handler.update(
      change('NoteRelation', id, { version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 3 });
  });

  it('a CharacterScene moves each endpoint and accepts a plain touch', async () => {
    const handler = new CharacterSceneSyncHandler();
    const id = newId();
    await handler.create(
      create('CharacterScene', id, { characterId: fx.Lchar, sceneId: fx.Lscene }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('CharacterScene', id, { characterId: fx.Lchar2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterId: fx.Lchar2,
      version: 2,
    });

    await handler.update(
      change('CharacterScene', id, { sceneId: fx.Lscene2, version: 2 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ sceneId: fx.Lscene2, version: 3 });

    await handler.update(
      change('CharacterScene', id, { version: 3 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 4 });
  });

  it('a SeeAlsoRelation refuses to swap its linked entities', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('SeeAlsoRelation', id, {
        entityAType: 'Character',
        entityAId: fx.Lchar,
        entityBType: 'Character',
        entityBId: fx.Lchar2,
      }),
      { userId, storyId: linearStoryId },
    );
    const current = await handler.findByIdOrThrow(id);

    for (const changes of [
      { entityAType: 'Location' },
      { entityAId: fx.Lchar3 },
      { entityBType: 'Location' },
      { entityBId: fx.Lchar3 },
    ]) {
      await expect(
        handler.update(change('SeeAlsoRelation', id, { ...changes, version: 1 }), current, {
          userId,
          storyId: linearStoryId,
        }),
      ).rejects.toThrow(/Cannot change the linked entities/i);
    }
  });

  it('a SeeAlsoRelation accepts a version-only touch', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    const id = newId();
    await handler.create(
      create('SeeAlsoRelation', id, {
        entityAType: 'Character',
        entityAId: fx.Lchar,
        entityBType: 'Character',
        entityBId: fx.Lchar2,
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.update(
      change('SeeAlsoRelation', id, { version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 2 });
  });

  it('an ItemJourney moves to another scene', async () => {
    const handler = new ItemJourneySyncHandler();
    const id = newId();
    await handler.create(
      create('ItemJourney', id, {
        itemId: fx.Bitem,
        sceneId: fx.Bscene,
        newCharacterOwnerId: null,
        newState: 'perdida',
        extraNotes: null,
      }),
      { userId, storyId: branchingStoryId },
    );

    await handler.update(
      change('ItemJourney', id, { sceneId: fx.Bscene2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ sceneId: fx.Bscene2, version: 2 });
  });

  it('an ItemJourney moves to another item', async () => {
    const handler = new ItemJourneySyncHandler();
    const item2 = newId();
    await new ItemSyncHandler().create(
      create('Item', item2, {
        characterOwnerId: null,
        name: 'Mapa',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
      { userId, storyId: branchingStoryId },
    );
    const id = newId();
    await handler.create(
      create('ItemJourney', id, {
        itemId: fx.Bitem,
        sceneId: fx.Bscene,
        newCharacterOwnerId: null,
        newState: 'perdida',
        extraNotes: null,
      }),
      { userId, storyId: branchingStoryId },
    );

    await handler.update(
      change('ItemJourney', id, { itemId: item2, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ itemId: item2, version: 2 });
  });

  it('an ItemJourney hands the item to another character', async () => {
    const handler = new ItemJourneySyncHandler();
    const heirId = newId();
    await new CharacterSyncHandler().create(create('Character', heirId, { name: 'Erebo' }), {
      userId,
      storyId: branchingStoryId,
    });
    const id = newId();
    await handler.create(
      create('ItemJourney', id, {
        itemId: fx.Bitem,
        sceneId: fx.Bscene,
        newCharacterOwnerId: null,
        newState: 'perdida',
        extraNotes: null,
      }),
      { userId, storyId: branchingStoryId },
    );

    await handler.update(
      change('ItemJourney', id, { newCharacterOwnerId: heirId, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: branchingStoryId },
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      newCharacterOwnerId: heirId,
      version: 2,
    });
  });

  /** Uniqueness holds among live fields only: a tombstone keeps its key and blocks nothing. */
  it('a StorySchemaField delete keeps its key, and a new field may take it', async () => {
    const handler = new StorySchemaFieldSyncHandler();
    const id = newId();
    await handler.create(
      create('StorySchemaField', id, {
        entityType: 'Character',
        name: 'Lar',
        key: 'lar',
        description: null,
        type: 'text',
        isRequired: false,
        defaultValue: null,
        order: 1,
      }),
      { userId, storyId: linearStoryId },
    );

    await handler.delete(remove('StorySchemaField', id, 1), await handler.findByIdOrThrow(id), {
      userId,
      storyId: linearStoryId,
    });
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ key: 'lar', isDeleted: true });

    const next = newId();
    await handler.create(
      create('StorySchemaField', next, {
        entityType: 'Character',
        name: 'Lar',
        key: 'lar',
        description: null,
        type: 'text',
        isRequired: false,
        defaultValue: null,
        order: 1,
      }),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(next)).toMatchObject({ key: 'lar', isDeleted: false });
  });
});

describe('gallery media lifecycle', () => {
  const storeBlob = async (seed: string) => {
    const bytes = new TextEncoder().encode(`gallery-blob-${seed}-${newId()}`).buffer as ArrayBuffer;
    const hash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    await mediaStorageService.store(hash, 'image/png', bytes);
    return hash;
  };

  it('a Gallery edits its MIME type and its container independently', async () => {
    const handler = new GallerySyncHandler();

    await handler.update(
      change('Gallery', fx.Lgallery, { mimeType: 'image/jpeg', version: 1 }),
      await handler.findByIdOrThrow(fx.Lgallery),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Lgallery)).toMatchObject({
      mimeType: 'image/jpeg',
      mediaType: 'image',
      version: 2,
    });

    await handler.update(
      change('Gallery', fx.Lgallery, { mediaType: 'image', version: 2 }),
      await handler.findByIdOrThrow(fx.Lgallery),
      { userId, storyId: linearStoryId },
    );
    expect(await handler.findByIdOrThrow(fx.Lgallery)).toMatchObject({ version: 3 });
  });

  it('a Gallery swaps its hash for an unknown one', async () => {
    const handler = new GallerySyncHandler();
    const hash = 'd'.repeat(32);

    await handler.update(
      change('Gallery', fx.Lgallery, { hash, version: 1 }),
      await handler.findByIdOrThrow(fx.Lgallery),
      { userId, storyId: linearStoryId },
    );

    expect(await handler.findByIdOrThrow(fx.Lgallery)).toMatchObject({ hash, version: 2 });
  });

  it('a Gallery refuses a hash owned by another story', async () => {
    const handler = new GallerySyncHandler();
    const foreignHash = await storeBlob('foreign');

    await expect(
      handler.create(create('Gallery', newId(), galleryData(foreignHash)), {
        userId,
        storyId: linearStoryId,
      }),
    ).rejects.toMatchObject({ reason: 'unauthorized' });
  });

  it('a Gallery reuses a hash its story already references', async () => {
    const handler = new GallerySyncHandler();
    const bytes = new TextEncoder().encode(`shared-${newId()}`).buffer as ArrayBuffer;
    const hash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    const firstId = newId();
    await handler.create(create('Gallery', firstId, galleryData(hash)), {
      userId,
      storyId: linearStoryId,
    });
    await mediaStorageService.store(hash, 'image/png', bytes);

    const secondId = newId();
    await handler.create(create('Gallery', secondId, galleryData(hash)), {
      userId,
      storyId: linearStoryId,
    });

    expect(await handler.findByIdOrThrow(secondId)).toMatchObject({ hash, version: 1 });
  });

  it('a Gallery delete tombstones without collecting: the push coordinator owns collection', async () => {
    const handler = new GallerySyncHandler();
    const hash = 'e'.repeat(32);
    const id = newId();
    await handler.create(create('Gallery', id, galleryData(hash)), {
      userId,
      storyId: linearStoryId,
    });
    const bytes = new TextEncoder().encode(`owned-${newId()}`).buffer as ArrayBuffer;
    const realHash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    await handler.update(
      change('Gallery', id, { hash: realHash, version: 1 }),
      await handler.findByIdOrThrow(id),
      { userId, storyId: linearStoryId },
    );
    await mediaStorageService.store(realHash, 'image/png', bytes);
    expect(await mediaStorageService.has(realHash)).toBe(true);

    await handler.delete(remove('Gallery', id, 2), await handler.findByIdOrThrow(id), {
      userId,
      storyId: linearStoryId,
      database: db,
    });

    expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true });
    // The bytes stay: collecting here would read through the global connection while the push
    // transaction is still uncommitted (seeing the row as live and skipping everything), and bytes
    // deleted first would stay deleted if that transaction then rolled back. The push coordinator
    // collects after the commit instead - see syncPushMediaGc.integration.test.ts.
    expect(await mediaStorageService.has(realHash)).toBe(true);
    expect(
      await db.query.mediaBlobs.findFirst({ where: (f, { eq }) => eq(f.hash, realHash) }),
    ).toBeTruthy();
  });

  it('a Gallery delete keeps a blob another row still uses', async () => {
    const handler = new GallerySyncHandler();
    const bytes = new TextEncoder().encode(`shared-delete-${newId()}`).buffer as ArrayBuffer;
    const hash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    const firstId = newId();
    const secondId = newId();
    await handler.create(create('Gallery', firstId, galleryData(hash)), {
      userId,
      storyId: linearStoryId,
    });
    await handler.create(create('Gallery', secondId, galleryData(hash)), {
      userId,
      storyId: linearStoryId,
    });
    await mediaStorageService.store(hash, 'image/png', bytes);

    await handler.delete(remove('Gallery', firstId, 1), await handler.findByIdOrThrow(firstId), {
      userId,
      storyId: linearStoryId,
    });

    expect(await mediaStorageService.has(hash)).toBe(true);
  });
});

describe('story root paths', () => {
  const storyCreate = (id: string, data: Record<string, unknown>) =>
    ({
      type: 'create',
      entity: 'Story',
      id,
      data,
      operationTime: new Date().toISOString(),
    }) as CreateStoryUpdate;

  it('a schema field moves by its own rank, the story untouched', async () => {
    const stories = new StorySyncHandler();
    const fields = new StorySchemaFieldSyncHandler();
    const storyId = newId();
    await stories.create(storyCreate(storyId, { title: 'Attrs', type: 'linear' }), {
      userId,
      storyId,
    });
    const firstId = newId();
    const secondId = newId();
    for (const [id, key, order, rank] of [
      [firstId, 'origem', 0, 'a1'],
      [secondId, 'lar', 1, 'a2'],
    ] as const) {
      await fields.create(
        create('StorySchemaField', id, {
          entityType: 'Character',
          name: key,
          key,
          description: null,
          type: 'text',
          isRequired: false,
          defaultValue: null,
          order,
          rank,
        }),
        { userId, storyId },
      );
    }

    await fields.update(
      {
        type: 'update',
        entity: 'StorySchemaField',
        id: secondId,
        version: 1,
        changes: { rank: 'a0', version: 1 },
      } as never,
      await fields.findByIdOrThrow(secondId),
      { userId, storyId },
    );
    await renumberArranged(db, storyId, 'StorySchemaField');

    expect(await fields.findByIdOrThrow(firstId)).toMatchObject({ order: 1, version: 1 });
    expect(await fields.findByIdOrThrow(secondId)).toMatchObject({ order: 0, version: 2 });
    expect(await stories.findByIdOrThrow(storyId)).toMatchObject({ version: 1 });
  });

  it('a Story delete sweeps the hashes only it referenced', async () => {
    const stories = new StorySyncHandler();
    const galleries = new GallerySyncHandler();
    const storyId = newId();
    await stories.create(storyCreate(storyId, { title: 'Gone', type: 'linear' }), {
      userId,
      storyId,
    });
    for (const hash of ['f'.repeat(32), '0'.repeat(32)]) {
      await galleries.create(create('Gallery', newId(), galleryData(hash)), { userId, storyId });
    }

    await stories.delete(remove('Story', storyId, 1), await stories.findByIdOrThrow(storyId), {
      userId,
      storyId,
    });

    expect(await stories.findByIdOrThrow(storyId)).toMatchObject({ isDeleted: true, version: 2 });
  });

  it('prepareDelete fills the version for an owner and passes anything else through', async () => {
    const handler = new StorySyncHandler();
    const current = { version: 5 } as never;
    const base = { type: 'delete', entity: 'Story', id: linearStoryId };

    expect(
      handler.prepareDelete(
        { role: 'owner', currentEntity: current } as never,
        {
          ...base,
          version: undefined,
        } as DeleteStoryUpdate,
      ),
    ).toMatchObject({ version: 5 });
    expect(
      handler.prepareDelete(
        { role: 'owner', currentEntity: current } as never,
        {
          ...base,
          version: null,
        } as never,
      ),
    ).toMatchObject({ version: 5 });
    expect(
      handler.prepareDelete(
        { role: 'owner', currentEntity: current } as never,
        {
          ...base,
          version: 3,
        } as DeleteStoryUpdate,
      ),
    ).toMatchObject({ version: 3 });
    const writerDelete = { ...base, version: undefined } as DeleteStoryUpdate;
    expect(
      handler.prepareDelete({ role: 'writer', currentEntity: current } as never, writerDelete),
    ).toBe(writerDelete);
  });
});

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { choices, locationRelations, mediaBlobs, stories, users } from '../../src/db/schema';
import { CharacterRelationSyncHandler } from '../../src/services/entity-sync-handlers/CharacterRelationSyncHandler';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { ChoiceCheckGroupSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckGroupSyncHandler';
import { ChoiceCheckSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceCheckSyncHandler';
import { ChoiceSyncHandler } from '../../src/services/entity-sync-handlers/ChoiceSyncHandler';
import { CharacterSceneSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSceneSyncHandler';
import { EffectSyncHandler } from '../../src/services/entity-sync-handlers/EffectSyncHandler';
import { GalleryRelationSyncHandler } from '../../src/services/entity-sync-handlers/GalleryRelationSyncHandler';
import { GallerySyncHandler } from '../../src/services/entity-sync-handlers/GallerySyncHandler';
import { ItemJourneySyncHandler } from '../../src/services/entity-sync-handlers/ItemJourneySyncHandler';
import { ItemSyncHandler } from '../../src/services/entity-sync-handlers/ItemSyncHandler';
import { LocationRelationSyncHandler } from '../../src/services/entity-sync-handlers/LocationRelationSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { ModeSyncHandler } from '../../src/services/entity-sync-handlers/ModeSyncHandler';
import { NoteRelationSyncHandler } from '../../src/services/entity-sync-handlers/NoteRelationSyncHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
import { RouteStepSyncHandler } from '../../src/services/entity-sync-handlers/RouteStepSyncHandler';
import { RouteSyncHandler } from '../../src/services/entity-sync-handlers/RouteSyncHandler';
import { SceneSyncHandler } from '../../src/services/entity-sync-handlers/SceneSyncHandler';
import { SeeAlsoRelationSyncHandler } from '../../src/services/entity-sync-handlers/SeeAlsoRelationSyncHandler';
import { StatRelationSyncHandler } from '../../src/services/entity-sync-handlers/StatRelationSyncHandler';
import { StatStrengthSyncHandler } from '../../src/services/entity-sync-handlers/StatStrengthSyncHandler';
import { StatSyncHandler } from '../../src/services/entity-sync-handlers/StatSyncHandler';
import { StoryCalendarSyncHandler } from '../../src/services/entity-sync-handlers/StoryCalendarSyncHandler';
import { StorySchemaFieldSyncHandler } from '../../src/services/entity-sync-handlers/StorySchemaFieldSyncHandler';
import { StorySyncHandler } from '../../src/services/entity-sync-handlers/StorySyncHandler';
import { SuggestionSyncHandler } from '../../src/services/entity-sync-handlers/SuggestionSyncHandler';
import { TagRelationSyncHandler } from '../../src/services/entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from '../../src/services/entity-sync-handlers/TagSyncHandler';
import { mediaStorageService } from '../../src/services/MediaStorageService';
import { installBunShim } from '../helpers/bunShim';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

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
        userId,
        story,
        create('Chapter', id, {
          name,
          index,
          summary: null,
          isFavorite: false,
          extraNotes: null,
        }),
      );
    }
    for (const [id, name] of [
      [locationId, 'Olimpo'],
      [location2Id, 'Tartaro'],
    ] as const) {
      await locations.create(
        userId,
        story,
        create('Location', id, {
          name,
          description: null,
          climate: null,
          culture: null,
          politics: null,
          isFavorite: false,
          extraNotes: null,
        }),
      );
    }
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
  fx.Lchar3 = newId();
  await characters.create(userId, linearStoryId, create('Character', fx.Lchar2, { name: 'Nyx' }));
  await characters.create(userId, linearStoryId, create('Character', fx.Lchar3, { name: 'Erebo' }));

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
});

describe('choice and route update paths', () => {
  it('a Choice re-points its scenes on update', async () => {
    const handler = new ChoiceSyncHandler();
    const current = await handler.findByIdOrThrow(fx.Bchoice);

    await handler.update(
      userId,
      branchingStoryId,
      change('Choice', fx.Bchoice, {
        sceneId: fx.Bscene2,
        nextSceneId: fx.Bscene,
        version: 1,
      }),
      current,
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
        userId,
        linearStoryId,
        create('Choice', newId(), {
          sceneId: fx.Lscene,
          nextSceneId: fx.Lscene2,
          text: 'Novo',
          notes: null,
        }),
      ),
    ).rejects.toThrow(/linear story/i);
    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('Choice', linearChoiceId, { text: 'Editado', version: 1 }),
        current,
      ),
    ).rejects.toThrow(/linear story/i);
    await expect(
      handler.delete(userId, linearStoryId, remove('Choice', linearChoiceId, 1), current),
    ).rejects.toThrow(/linear story/i);
    expect(await handler.findByIdOrThrow(linearChoiceId)).toMatchObject({
      text: 'Legado',
      isDeleted: false,
    });
  });

  it('a Route deletes through the branching guard', async () => {
    const handler = new RouteSyncHandler();
    const current = await handler.findByIdOrThrow(fx.Broute);

    await handler.delete(userId, branchingStoryId, remove('Route', fx.Broute, 1), current, db);

    expect(await handler.findByIdOrThrow(fx.Broute)).toMatchObject({
      isDeleted: true,
      version: 2,
    });
  });

  it('a RouteStep moves position without re-resolving its endpoints', async () => {
    const handler = new RouteStepSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      branchingStoryId,
      create('RouteStep', id, {
        routeId: fx.Broute,
        position: 1,
        sceneId: fx.Bscene,
        selectedChoiceId: fx.Bchoice,
      }),
    );
    const current = await handler.findByIdOrThrow(id);

    await handler.update(
      userId,
      branchingStoryId,
      change('RouteStep', id, { position: 5, version: 1 }),
      current,
      db,
    );

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
    await new RouteSyncHandler().create(
      userId,
      branchingStoryId,
      create('Route', route2, { name: 'Boat', details: null }),
    );
    const choice2 = newId();
    await new ChoiceSyncHandler().create(
      userId,
      branchingStoryId,
      create('Choice', choice2, {
        sceneId: fx.Bscene2,
        nextSceneId: fx.Bscene,
        text: 'Voltar',
        notes: null,
      }),
    );
    const id = newId();
    await handler.create(
      userId,
      branchingStoryId,
      create('RouteStep', id, {
        routeId: fx.Broute,
        position: 1,
        sceneId: fx.Bscene,
        selectedChoiceId: null,
      }),
    );
    const current = await handler.findByIdOrThrow(id);

    await handler.update(
      userId,
      branchingStoryId,
      change('RouteStep', id, {
        routeId: route2,
        sceneId: fx.Bscene2,
        selectedChoiceId: choice2,
        version: 1,
      }),
      current,
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
      userId,
      branchingStoryId,
      create('RouteStep', id, {
        routeId: fx.Broute,
        position: 1,
        sceneId: fx.Bscene,
        selectedChoiceId: null,
      }),
    );
    const current = await handler.findByIdOrThrow(id);

    await expect(
      handler.update(
        userId,
        branchingStoryId,
        change('RouteStep', id, { sceneId: newId(), version: 1 }),
        current,
      ),
    ).rejects.toMatchObject({ reason: 'referenced_entity_deleted' });
  });
});

describe('item, mode and stat update paths', () => {
  it('an Item renames to a free name and edits other fields without a uniqueness check', async () => {
    const handler = new ItemSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('Item', id, {
        characterOwnerId: fx.Lchar,
        name: 'Espada',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('Item', id, { name: 'Espada longa', version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ name: 'Espada longa', version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('Item', id, { description: 'Forjada em Styx', version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    await handler.update(
      userId,
      linearStoryId,
      change('Item', id, { name: 'Espada longa', version: 3 }),
      await handler.findByIdOrThrow(id),
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
      userId,
      linearStoryId,
      create('Item', id, {
        characterOwnerId: fx.Lchar,
        name: 'Escudo',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('Item', id, { characterOwnerId: fx.Lchar2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterOwnerId: fx.Lchar2,
      version: 2,
    });
  });

  it('a Mode edits its name and moves to another character', async () => {
    const handler = new ModeSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('Mode', id, { characterId: fx.Lchar, name: 'Desperta' }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('Mode', id, { name: 'Adormecida', version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ name: 'Adormecida', version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('Mode', id, { characterId: fx.Lchar2, version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterId: fx.Lchar2,
      version: 3,
    });
  });

  it('a Stat renames without consulting the primary limit', async () => {
    const handler = new StatSyncHandler();

    await handler.update(
      userId,
      linearStoryId,
      change('Stat', fx.Lstat, { name: 'Bravura', version: 1 }),
      await handler.findByIdOrThrow(fx.Lstat),
    );

    expect(await handler.findByIdOrThrow(fx.Lstat)).toMatchObject({ name: 'Bravura', version: 2 });
  });

  it('a Stat already primary stays primary without consulting the limit', async () => {
    const handler = new StatSyncHandler();

    await handler.update(
      userId,
      linearStoryId,
      change('Stat', fx.Lstat, { isPrimary: true, version: 1 }),
      await handler.findByIdOrThrow(fx.Lstat),
    );

    expect(await handler.findByIdOrThrow(fx.Lstat)).toMatchObject({ isPrimary: true, version: 2 });
  });

  it('a StatStrength relabels without touching its floor and moves ladders', async () => {
    const handler = new StatStrengthSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('StatStrength', id, { statId: fx.Lstat, label: 'F', minValue: 0 }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('StatStrength', id, { label: 'Fraco', version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ label: 'Fraco', version: 2 });

    const otherStat = newId();
    await new StatSyncHandler().create(
      userId,
      linearStoryId,
      create('Stat', otherStat, { name: 'Sabedoria' }),
    );
    await handler.update(
      userId,
      linearStoryId,
      change('StatStrength', id, { statId: otherStat, version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ statId: otherStat, version: 3 });
  });

  it('a StatRelation edits its value and re-points each key', async () => {
    const handler = new StatRelationSyncHandler();
    const modeId = newId();
    await new ModeSyncHandler().create(
      userId,
      linearStoryId,
      create('Mode', modeId, { characterId: fx.Lchar, name: 'Desperta' }),
    );
    const otherStat = newId();
    await new StatSyncHandler().create(
      userId,
      linearStoryId,
      create('Stat', otherStat, { name: 'Sabedoria' }),
    );
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('StatRelation', id, { characterId: fx.Lchar, statId: fx.Lstat, value: 5 }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('StatRelation', id, { value: 7, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ value: 7, version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('StatRelation', id, { characterId: fx.Lchar2, version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterId: fx.Lchar2,
      version: 3,
    });

    const mode2 = newId();
    await new ModeSyncHandler().create(
      userId,
      linearStoryId,
      create('Mode', mode2, { characterId: fx.Lchar2, name: 'Eco' }),
    );
    await handler.update(
      userId,
      linearStoryId,
      change('StatRelation', id, { modeId: mode2, version: 3 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ modeId: mode2, version: 4 });

    await handler.update(
      userId,
      linearStoryId,
      change('StatRelation', id, { statId: otherStat, version: 4 }),
      await handler.findByIdOrThrow(id),
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
      userId,
      branchingStoryId,
      create('ChoiceCheckGroup', group2, { choiceId: fx.Bchoice, combinator: 'OR', order: 1 }),
    );
    const group1 = newId();
    await groups.create(
      userId,
      branchingStoryId,
      create('ChoiceCheckGroup', group1, { choiceId: fx.Bchoice, combinator: 'AND', order: 0 }),
    );
    const id = newId();
    await handler.create(userId, branchingStoryId, create('ChoiceCheck', id, checkData(group1)));

    await handler.update(
      userId,
      branchingStoryId,
      change('ChoiceCheck', id, { sceneId: fx.Bscene, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ sceneId: fx.Bscene, version: 2 });

    await handler.update(
      userId,
      branchingStoryId,
      change('ChoiceCheck', id, { itemId: fx.Bitem, version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ itemId: fx.Bitem, version: 3 });

    await handler.update(
      userId,
      branchingStoryId,
      change('ChoiceCheck', id, { groupId: group2, version: 3 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ groupId: group2, version: 4 });

    await handler.update(
      userId,
      branchingStoryId,
      change('ChoiceCheck', id, { order: 9, version: 4 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ order: 9, version: 5 });
  });

  it('a ChoiceCheckGroup moves to another choice and edits without re-checking', async () => {
    const handler = new ChoiceCheckGroupSyncHandler();
    const choice2 = newId();
    await new ChoiceSyncHandler().create(
      userId,
      branchingStoryId,
      create('Choice', choice2, {
        sceneId: fx.Bscene2,
        nextSceneId: fx.Bscene,
        text: 'Voltar',
        notes: null,
      }),
    );
    const id = newId();
    await handler.create(
      userId,
      branchingStoryId,
      create('ChoiceCheckGroup', id, { choiceId: fx.Bchoice, combinator: 'AND', order: 0 }),
    );

    await handler.update(
      userId,
      branchingStoryId,
      change('ChoiceCheckGroup', id, { choiceId: choice2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ choiceId: choice2, version: 2 });

    await handler.update(
      userId,
      branchingStoryId,
      change('ChoiceCheckGroup', id, { combinator: 'OR', version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ combinator: 'OR', version: 3 });
  });

  it('an Effect re-points its item and edits without re-checking', async () => {
    const handler = new EffectSyncHandler();
    const item2 = newId();
    await new ItemSyncHandler().create(
      userId,
      branchingStoryId,
      create('Item', item2, {
        characterOwnerId: null,
        name: 'Mapa',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
    const id = newId();
    await handler.create(
      userId,
      branchingStoryId,
      create('Effect', id, {
        entityType: 'Scene',
        entityId: fx.Bscene,
        effectType: 'itemGrant',
        itemId: null,
        triggerName: null,
      }),
    );

    await handler.update(
      userId,
      branchingStoryId,
      change('Effect', id, { itemId: item2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ itemId: item2, version: 2 });

    await handler.update(
      userId,
      branchingStoryId,
      change('Effect', id, { triggerName: 'portao', version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ triggerName: 'portao', version: 3 });
  });

  it('a Suggestion retitles its type and restates its own value', async () => {
    const handler = new SuggestionSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('Suggestion', id, { type: 'character-name', value: 'Nyx' }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('Suggestion', id, { type: 'place-name', version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ type: 'place-name', version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('Suggestion', id, { type: 'place-name', version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 3 });

    await handler.update(
      userId,
      linearStoryId,
      change('Suggestion', id, { version: 3 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 4 });
  });

  it('a Suggestion edit that collides with another row is rejected', async () => {
    const handler = new SuggestionSyncHandler();
    await handler.create(
      userId,
      linearStoryId,
      create('Suggestion', newId(), { type: 'character-name', value: 'Nyx' }),
    );
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('Suggestion', id, { type: 'character-name', value: 'Erebo' }),
    );

    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('Suggestion', id, { value: 'Nyx', version: 1 }),
        await handler.findByIdOrThrow(id),
      ),
    ).rejects.toThrow(/already exists/i);
    expect((await handler.findByIdOrThrow(id)).value).toBe('Erebo');
  });
});

describe('tag and scene update paths', () => {
  it('a Tag edits its color and restates its own name', async () => {
    const handler = new TagSyncHandler();

    await handler.update(
      userId,
      linearStoryId,
      change('Tag', fx.Ltag, { color: '#ff0000', version: 1 }),
      await handler.findByIdOrThrow(fx.Ltag),
    );
    expect(await handler.findByIdOrThrow(fx.Ltag)).toMatchObject({ color: '#ff0000', version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('Tag', fx.Ltag, { name: 'Viloes', version: 2 }),
      await handler.findByIdOrThrow(fx.Ltag),
    );
    expect(await handler.findByIdOrThrow(fx.Ltag)).toMatchObject({ version: 3 });
  });

  it('a TagRelation moves each key and lands a free retarget', async () => {
    const handler = new TagRelationSyncHandler();
    const tag2 = newId();
    await new TagSyncHandler().create(
      userId,
      linearStoryId,
      create('Tag', tag2, { name: 'Herois', color: null, isFavorite: false, extraNotes: null }),
    );
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('TagRelation', id, {
        tagId: fx.Ltag,
        relationId: fx.Lchar,
        relationType: 'Character',
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('TagRelation', id, { tagId: tag2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ tagId: tag2, version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('TagRelation', id, {
        relationId: fx.Lchar2,
        relationType: 'Character',
        version: 2,
      }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      relationId: fx.Lchar2,
      version: 3,
    });

    await handler.update(
      userId,
      linearStoryId,
      change('TagRelation', id, {
        relationId: fx.Llocation,
        relationType: 'Location',
        version: 3,
      }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      relationId: fx.Llocation,
      relationType: 'Location',
      version: 4,
    });

    await handler.update(
      userId,
      linearStoryId,
      change('TagRelation', id, { version: 4 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 5 });
  });

  it('a Scene moves chapter, location and calendar override', async () => {
    const handler = new SceneSyncHandler();
    const calendarId = newId();
    await new StoryCalendarSyncHandler().create(
      userId,
      linearStoryId,
      create('StoryCalendar', calendarId, calendarData()),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('Scene', fx.Lscene, { chapterId: fx.Lchapter2, version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene),
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      chapterId: fx.Lchapter2,
      version: 2,
    });

    await handler.update(
      userId,
      linearStoryId,
      change('Scene', fx.Lscene, { locationId: fx.Llocation2, version: 2 }),
      await handler.findByIdOrThrow(fx.Lscene),
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      locationId: fx.Llocation2,
      version: 3,
    });

    await handler.update(
      userId,
      linearStoryId,
      change('Scene', fx.Lscene, { calendarDateOverrideCalendarId: calendarId, version: 3 }),
      await handler.findByIdOrThrow(fx.Lscene),
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      calendarDateOverrideCalendarId: calendarId,
      version: 4,
    });
  });

  it('a Scene taking the start flag clears it elsewhere in a linear story', async () => {
    const handler = new SceneSyncHandler();

    await handler.update(
      userId,
      linearStoryId,
      change('Scene', fx.Lscene2, { isStart: true, version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene2),
    );

    expect(await handler.findByIdOrThrow(fx.Lscene2)).toMatchObject({ isStart: true, version: 2 });
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({ isStart: false, version: 2 });
  });

  it('a Scene taking the finish flag clears it elsewhere in a linear story', async () => {
    const handler = new SceneSyncHandler();

    await handler.update(
      userId,
      linearStoryId,
      change('Scene', fx.Lscene, { isFinish: true, version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene),
    );

    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({ isFinish: true, version: 2 });
    expect(await handler.findByIdOrThrow(fx.Lscene2)).toMatchObject({
      isFinish: false,
      version: 2,
    });
  });

  it('a Scene edits its name without touching flags and deletes through the base path', async () => {
    const handler = new SceneSyncHandler();

    await handler.update(
      userId,
      linearStoryId,
      change('Scene', fx.Lscene, { name: 'Chegada revisada', version: 1 }),
      await handler.findByIdOrThrow(fx.Lscene),
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({
      name: 'Chegada revisada',
      isStart: true,
      version: 2,
    });

    await handler.delete(
      userId,
      linearStoryId,
      remove('Scene', fx.Lscene, 2),
      await handler.findByIdOrThrow(fx.Lscene),
      db,
    );
    expect(await handler.findByIdOrThrow(fx.Lscene)).toMatchObject({ isDeleted: true, version: 3 });
  });

  it('a Scene on a branching story edits without the linear start/finish handling', async () => {
    const handler = new SceneSyncHandler();

    await handler.update(
      userId,
      branchingStoryId,
      change('Scene', fx.Bscene, { name: 'Chegada revisada', version: 1 }),
      await handler.findByIdOrThrow(fx.Bscene),
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
      userId,
      linearStoryId,
      create('CharacterRelation', id, {
        character1Id: fx.Lchar,
        character2Id: fx.Lchar2,
        relationType: 'siblings',
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('CharacterRelation', id, { character2Id: fx.Lchar3, version: 1 }),
      await handler.findByIdOrThrow(id),
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
      userId,
      linearStoryId,
      create('CharacterRelation', id, {
        character1Id: fx.Lchar,
        character2Id: fx.Lchar2,
        relationType: 'siblings',
      }),
    );

    // A single-key edit passes the partial schema (which only compares two provided keys) and
    // reaches the handler's own identity check.
    const current = await handler.findByIdOrThrow(id);
    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('CharacterRelation', id, { character1Id: current.character2Id, version: 1 }),
        current,
      ),
    ).rejects.toThrow(/cannot be identical/i);
  });

  it('a LocationRelation retargets its endpoints and accepts a plain touch', async () => {
    const handler = new LocationRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
    );

    const third = newId();
    await new LocationSyncHandler().create(
      userId,
      linearStoryId,
      create('Location', third, {
        name: 'Erebo',
        description: null,
        climate: null,
        culture: null,
        politics: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
    await handler.update(
      userId,
      linearStoryId,
      change('LocationRelation', id, { locationAId: fx.Llocation, locationBId: third, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      locationBId: third,
      version: 2,
    });

    await handler.update(
      userId,
      linearStoryId,
      change('LocationRelation', id, { version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 3 });
  });

  it('a LocationRelation converting to contains takes the parent slot', async () => {
    const handler = new LocationRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('LocationRelation', id, { relationType: 'contains', version: 1 }),
      await handler.findByIdOrThrow(id),
    );

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      relationType: 'contains',
      version: 2,
    });
  });

  it('a LocationRelation update that duplicates a connection is rejected', async () => {
    const handler = new LocationRelationSyncHandler();
    await handler.create(
      userId,
      linearStoryId,
      create('LocationRelation', newId(), {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
    );
    const third = newId();
    await new LocationSyncHandler().create(
      userId,
      linearStoryId,
      create('Location', third, {
        name: 'Erebo',
        description: null,
        climate: null,
        culture: null,
        politics: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: third,
        relationType: 'connected_to',
      }),
    );

    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('LocationRelation', id, { locationBId: fx.Llocation2, version: 1 }),
        await handler.findByIdOrThrow(id),
      ),
    ).rejects.toThrow(/already exists/i);
  });

  it('a LocationRelation refuses to link a location to itself on update', async () => {
    const handler = new LocationRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('LocationRelation', id, {
        locationAId: fx.Llocation,
        locationBId: fx.Llocation2,
        relationType: 'connected_to',
      }),
    );
    const current = await handler.findByIdOrThrow(id);

    // A single-key edit passes the partial schema and reaches the handler's own identity check.
    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('LocationRelation', id, { locationAId: current.locationBId, version: 1 }),
        current,
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
        userId,
        linearStoryId,
        create('Location', id, {
          name,
          description: null,
          climate: null,
          culture: null,
          politics: null,
          isFavorite: false,
          extraNotes: null,
        }),
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
        userId,
        linearStoryId,
        create('LocationRelation', newId(), {
          locationAId: a,
          locationBId: c,
          relationType: 'contains',
        }),
      ),
    ).rejects.toThrow(/maximum allowed depth/i);
  });

  it('a GalleryRelation re-links to a free owner and restates its own link', async () => {
    const handler = new GalleryRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('GalleryRelation', id, {
        galleryId: fx.Lgallery,
        ownerId: fx.Lchar,
        ownerType: 'Character',
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('GalleryRelation', id, { ownerId: fx.Lchar2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ ownerId: fx.Lchar2, version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('GalleryRelation', id, {
        ownerId: fx.Llocation,
        ownerType: 'Location',
        version: 2,
      }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      ownerId: fx.Llocation,
      ownerType: 'Location',
      version: 3,
    });

    // Restating the same gallery finds only itself in the duplicate check and lands.
    await handler.update(
      userId,
      linearStoryId,
      change('GalleryRelation', id, { galleryId: fx.Lgallery, version: 3 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 4 });

    await handler.update(
      userId,
      linearStoryId,
      change('GalleryRelation', id, { version: 4 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 5 });
  });

  it('a GalleryRelation retarget onto an occupied pair is rejected', async () => {
    const handler = new GalleryRelationSyncHandler();
    await handler.create(
      userId,
      linearStoryId,
      create('GalleryRelation', newId(), {
        galleryId: fx.Lgallery,
        ownerId: fx.Lchar2,
        ownerType: 'Character',
      }),
    );
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('GalleryRelation', id, {
        galleryId: fx.Lgallery,
        ownerId: fx.Lchar,
        ownerType: 'Character',
      }),
    );

    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('GalleryRelation', id, { ownerId: fx.Lchar2, version: 1 }),
        await handler.findByIdOrThrow(id),
      ),
    ).rejects.toThrow(/already linked/i);
  });

  it('a NoteRelation refuses to swap its note and its endpoint type', async () => {
    const handler = new NoteRelationSyncHandler();
    const note2 = newId();
    await new NoteSyncHandler().create(
      userId,
      linearStoryId,
      create('Note', note2, { title: 'Outra', body: null, isFavorite: false, extraNotes: null }),
    );
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('NoteRelation', id, {
        noteId: fx.Lnote,
        relationId: fx.Lchar,
        relationType: 'Character',
      }),
    );
    const current = await handler.findByIdOrThrow(id);

    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('NoteRelation', id, { noteId: note2, version: 1 }),
        current,
      ),
    ).rejects.toThrow(/Cannot change 'noteId'/i);
    await expect(
      handler.update(
        userId,
        linearStoryId,
        change('NoteRelation', id, { relationType: 'Location', version: 1 }),
        current,
      ),
    ).rejects.toThrow(/Cannot change 'relationType'/i);
  });

  it('a NoteRelation restating its own endpoints is a plain touch', async () => {
    const handler = new NoteRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('NoteRelation', id, {
        noteId: fx.Lnote,
        relationId: fx.Lchar,
        relationType: 'Character',
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('NoteRelation', id, {
        noteId: fx.Lnote,
        relationId: fx.Lchar,
        relationType: 'Character',
        version: 1,
      }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 2 });

    await handler.update(
      userId,
      linearStoryId,
      change('NoteRelation', id, { version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 3 });
  });

  it('a CharacterScene moves each endpoint and accepts a plain touch', async () => {
    const handler = new CharacterSceneSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('CharacterScene', id, { characterId: fx.Lchar, sceneId: fx.Lscene }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('CharacterScene', id, { characterId: fx.Lchar2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      characterId: fx.Lchar2,
      version: 2,
    });

    await handler.update(
      userId,
      linearStoryId,
      change('CharacterScene', id, { sceneId: fx.Lscene2, version: 2 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ sceneId: fx.Lscene2, version: 3 });

    await handler.update(
      userId,
      linearStoryId,
      change('CharacterScene', id, { version: 3 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 4 });
  });

  it('a SeeAlsoRelation refuses to swap its linked entities', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('SeeAlsoRelation', id, {
        entityAType: 'Character',
        entityAId: fx.Lchar,
        entityBType: 'Character',
        entityBId: fx.Lchar2,
      }),
    );
    const current = await handler.findByIdOrThrow(id);

    for (const changes of [
      { entityAType: 'Location' },
      { entityAId: fx.Lchar3 },
      { entityBType: 'Location' },
      { entityBId: fx.Lchar3 },
    ]) {
      await expect(
        handler.update(
          userId,
          linearStoryId,
          change('SeeAlsoRelation', id, { ...changes, version: 1 }),
          current,
        ),
      ).rejects.toThrow(/Cannot change the linked entities/i);
    }
  });

  it('a SeeAlsoRelation accepts a version-only touch', async () => {
    const handler = new SeeAlsoRelationSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
      create('SeeAlsoRelation', id, {
        entityAType: 'Character',
        entityAId: fx.Lchar,
        entityBType: 'Character',
        entityBId: fx.Lchar2,
      }),
    );

    await handler.update(
      userId,
      linearStoryId,
      change('SeeAlsoRelation', id, { version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ version: 2 });
  });

  it('an ItemJourney moves to another scene', async () => {
    const handler = new ItemJourneySyncHandler();
    const id = newId();
    await handler.create(
      userId,
      branchingStoryId,
      create('ItemJourney', id, {
        itemId: fx.Bitem,
        sceneId: fx.Bscene,
        newCharacterOwnerId: null,
        newState: 'perdida',
        extraNotes: null,
      }),
    );

    await handler.update(
      userId,
      branchingStoryId,
      change('ItemJourney', id, { sceneId: fx.Bscene2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ sceneId: fx.Bscene2, version: 2 });
  });

  it('an ItemJourney moves to another item', async () => {
    const handler = new ItemJourneySyncHandler();
    const item2 = newId();
    await new ItemSyncHandler().create(
      userId,
      branchingStoryId,
      create('Item', item2, {
        characterOwnerId: null,
        name: 'Mapa',
        category: null,
        description: null,
        initialState: null,
        isFavorite: false,
        extraNotes: null,
      }),
    );
    const id = newId();
    await handler.create(
      userId,
      branchingStoryId,
      create('ItemJourney', id, {
        itemId: fx.Bitem,
        sceneId: fx.Bscene,
        newCharacterOwnerId: null,
        newState: 'perdida',
        extraNotes: null,
      }),
    );

    await handler.update(
      userId,
      branchingStoryId,
      change('ItemJourney', id, { itemId: item2, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({ itemId: item2, version: 2 });
  });

  it('an ItemJourney hands the item to another character', async () => {
    const handler = new ItemJourneySyncHandler();
    const heirId = newId();
    await new CharacterSyncHandler().create(
      userId,
      branchingStoryId,
      create('Character', heirId, { name: 'Erebo' }),
    );
    const id = newId();
    await handler.create(
      userId,
      branchingStoryId,
      create('ItemJourney', id, {
        itemId: fx.Bitem,
        sceneId: fx.Bscene,
        newCharacterOwnerId: null,
        newState: 'perdida',
        extraNotes: null,
      }),
    );

    await handler.update(
      userId,
      branchingStoryId,
      change('ItemJourney', id, { newCharacterOwnerId: heirId, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      newCharacterOwnerId: heirId,
      version: 2,
    });
  });

  it('a StorySchemaField delete resend does not sweep the key twice', async () => {
    const handler = new StorySchemaFieldSyncHandler();
    const id = newId();
    await handler.create(
      userId,
      linearStoryId,
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
    );

    await handler.delete(
      userId,
      linearStoryId,
      remove('StorySchemaField', id, 1),
      await handler.findByIdOrThrow(id),
    );
    const sweptKey = (await handler.findByIdOrThrow(id)).key;
    expect(sweptKey).toMatch(/^lar__deleted_/);

    await handler.delete(
      userId,
      linearStoryId,
      remove('StorySchemaField', id, 2),
      await handler.findByIdOrThrow(id),
    );
    expect((await handler.findByIdOrThrow(id)).key).toBe(sweptKey);
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
      userId,
      linearStoryId,
      change('Gallery', fx.Lgallery, { mimeType: 'image/jpeg', version: 1 }),
      await handler.findByIdOrThrow(fx.Lgallery),
    );
    expect(await handler.findByIdOrThrow(fx.Lgallery)).toMatchObject({
      mimeType: 'image/jpeg',
      mediaType: 'image',
      version: 2,
    });

    await handler.update(
      userId,
      linearStoryId,
      change('Gallery', fx.Lgallery, { mediaType: 'image', version: 2 }),
      await handler.findByIdOrThrow(fx.Lgallery),
    );
    expect(await handler.findByIdOrThrow(fx.Lgallery)).toMatchObject({ version: 3 });
  });

  it('a Gallery swaps its hash for an unknown one', async () => {
    const handler = new GallerySyncHandler();
    const hash = 'd'.repeat(32);

    await handler.update(
      userId,
      linearStoryId,
      change('Gallery', fx.Lgallery, { hash, version: 1 }),
      await handler.findByIdOrThrow(fx.Lgallery),
    );

    expect(await handler.findByIdOrThrow(fx.Lgallery)).toMatchObject({ hash, version: 2 });
  });

  it('a Gallery refuses a hash owned by another story', async () => {
    const handler = new GallerySyncHandler();
    const foreignHash = await storeBlob('foreign');

    await expect(
      handler.create(userId, linearStoryId, create('Gallery', newId(), galleryData(foreignHash))),
    ).rejects.toMatchObject({ reason: 'unauthorized' });
  });

  it('a Gallery reuses a hash its story already references', async () => {
    const handler = new GallerySyncHandler();
    const bytes = new TextEncoder().encode(`shared-${newId()}`).buffer as ArrayBuffer;
    const hash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    const firstId = newId();
    await handler.create(userId, linearStoryId, create('Gallery', firstId, galleryData(hash)));
    await mediaStorageService.store(hash, 'image/png', bytes);

    const secondId = newId();
    await handler.create(userId, linearStoryId, create('Gallery', secondId, galleryData(hash)));

    expect(await handler.findByIdOrThrow(secondId)).toMatchObject({ hash, version: 1 });
  });

  it('a Gallery delete drops its blob when nothing references it', async () => {
    const handler = new GallerySyncHandler();
    const hash = 'e'.repeat(32);
    const id = newId();
    await handler.create(userId, linearStoryId, create('Gallery', id, galleryData(hash)));
    const bytes = new TextEncoder().encode(`owned-${newId()}`).buffer as ArrayBuffer;
    const realHash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    await handler.update(
      userId,
      linearStoryId,
      change('Gallery', id, { hash: realHash, version: 1 }),
      await handler.findByIdOrThrow(id),
    );
    await mediaStorageService.store(realHash, 'image/png', bytes);
    expect(await mediaStorageService.has(realHash)).toBe(true);

    await handler.delete(
      userId,
      linearStoryId,
      remove('Gallery', id, 2),
      await handler.findByIdOrThrow(id),
      db,
    );

    expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true });
    expect(await mediaStorageService.has(realHash)).toBe(false);
    expect(
      await db.query.mediaBlobs.findFirst({ where: (f, { eq }) => eq(f.hash, realHash) }),
    ).toBeUndefined();
  });

  it('a Gallery delete keeps a blob another row still uses', async () => {
    const handler = new GallerySyncHandler();
    const bytes = new TextEncoder().encode(`shared-delete-${newId()}`).buffer as ArrayBuffer;
    const hash = createHash('md5').update(new Uint8Array(bytes)).digest('hex');
    const firstId = newId();
    const secondId = newId();
    await handler.create(userId, linearStoryId, create('Gallery', firstId, galleryData(hash)));
    await handler.create(userId, linearStoryId, create('Gallery', secondId, galleryData(hash)));
    await mediaStorageService.store(hash, 'image/png', bytes);

    await handler.delete(
      userId,
      linearStoryId,
      remove('Gallery', firstId, 1),
      await handler.findByIdOrThrow(firstId),
    );

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

  it('a Story reorders its schema fields', async () => {
    const stories = new StorySyncHandler();
    const fields = new StorySchemaFieldSyncHandler();
    const storyId = newId();
    await stories.create(userId, storyId, storyCreate(storyId, { title: 'Attrs', type: 'linear' }));
    const firstId = newId();
    const secondId = newId();
    for (const [id, key, order] of [
      [firstId, 'origem', 0],
      [secondId, 'lar', 1],
    ] as const) {
      await fields.create(
        userId,
        storyId,
        create('StorySchemaField', id, {
          entityType: 'Character',
          name: key,
          key,
          description: null,
          type: 'text',
          isRequired: false,
          defaultValue: null,
          order,
        }),
      );
    }

    await stories.update(
      userId,
      storyId,
      {
        type: 'reorder',
        entity: 'Story',
        id: storyId,
        version: 1,
        reorderTarget: 'StorySchemaField',
        schemaEntityType: 'Character',
        reorderItems: [
          { id: firstId, newIndex: 2 },
          { id: secondId, newIndex: 1 },
        ],
      } as never,
      await stories.findByIdOrThrow(storyId),
    );

    expect(await fields.findByIdOrThrow(firstId)).toMatchObject({ order: 1, version: 2 });
    expect(await fields.findByIdOrThrow(secondId)).toMatchObject({ order: 0, version: 2 });
    expect(await stories.findByIdOrThrow(storyId)).toMatchObject({ version: 2 });
  });

  it('a Story refuses an attribute reorder without an entity type and a partial batch', async () => {
    const stories = new StorySyncHandler();
    const fields = new StorySchemaFieldSyncHandler();
    const storyId = newId();
    await stories.create(userId, storyId, storyCreate(storyId, { title: 'Attrs', type: 'linear' }));
    const fieldId = newId();
    await fields.create(
      userId,
      storyId,
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
    const current = await stories.findByIdOrThrow(storyId);

    await expect(
      stories.update(
        userId,
        storyId,
        {
          type: 'reorder',
          entity: 'Story',
          id: storyId,
          version: 1,
          reorderTarget: 'StorySchemaField',
          reorderItems: [{ id: fieldId, newIndex: 1 }],
        } as never,
        current,
      ),
    ).rejects.toThrow(/schema entity type/i);

    await expect(
      stories.update(
        userId,
        storyId,
        {
          type: 'reorder',
          entity: 'Story',
          id: storyId,
          version: 1,
          reorderTarget: 'StorySchemaField',
          schemaEntityType: 'Location',
          reorderItems: [{ id: fieldId, newIndex: 1 }],
        } as never,
        current,
      ),
    ).rejects.toMatchObject({ reason: 'validation' });
  });

  it('a Story delete sweeps the hashes only it referenced', async () => {
    const stories = new StorySyncHandler();
    const galleries = new GallerySyncHandler();
    const storyId = newId();
    await stories.create(userId, storyId, storyCreate(storyId, { title: 'Gone', type: 'linear' }));
    for (const hash of ['f'.repeat(32), '0'.repeat(32)]) {
      await galleries.create(userId, storyId, create('Gallery', newId(), galleryData(hash)));
    }

    await stories.delete(
      userId,
      storyId,
      remove('Story', storyId, 1),
      await stories.findByIdOrThrow(storyId),
    );

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

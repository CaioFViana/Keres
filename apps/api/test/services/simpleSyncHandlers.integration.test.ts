import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { StoryArcSyncHandler } from '../../src/services/entity-sync-handlers/StoryArcSyncHandler';
import { ItemSyncHandler } from '../../src/services/entity-sync-handlers/ItemSyncHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
import { PlotSyncHandler } from '../../src/services/entity-sync-handlers/PlotSyncHandler';
import { SuggestionSyncHandler } from '../../src/services/entity-sync-handlers/SuggestionSyncHandler';
import { TagSyncHandler } from '../../src/services/entity-sync-handlers/TagSyncHandler';
import { WorldRuleSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleSyncHandler';
import type { SyncEntityHandler } from '../../src/services/entity-sync-handlers/BaseSyncEntityHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
});

type Handler = SyncEntityHandler;

const cases: Array<
  [string, () => Handler, Record<string, unknown>, Record<string, unknown>, string, unknown]
> = [
  [
    'Chapter',
    () => new ChapterSyncHandler(),
    { name: 'Ato I', index: 1, summary: null, isFavorite: false, extraNotes: null },
    { name: 'Ato II' },
    'name',
    'Ato II',
  ],
  [
    'Location',
    () => new LocationSyncHandler(),
    {
      name: 'Olímpo',
      description: null,
      climate: null,
      culture: null,
      politics: null,
      isFavorite: false,
      extraNotes: null,
    },
    { name: 'Submundo' },
    'name',
    'Submundo',
  ],
  [
    'Note',
    () => new NoteSyncHandler(),
    { title: 'Ideia', body: null, isFavorite: false, extraNotes: null },
    { title: 'Ideia revisada' },
    'title',
    'Ideia revisada',
  ],
  [
    'WorldRule',
    () => new WorldRuleSyncHandler(),
    { title: 'Magia', description: null, isFavorite: false, extraNotes: null },
    { title: 'Magia elemental' },
    'title',
    'Magia elemental',
  ],
  [
    'Tag',
    () => new TagSyncHandler(),
    { name: 'Vilões', color: null, isFavorite: false, extraNotes: null },
    { name: 'Antagonistas' },
    'name',
    'Antagonistas',
  ],
  [
    'Suggestion',
    () => new SuggestionSyncHandler(),
    { type: 'character-name', value: 'Nyx' },
    { value: 'Érebo' },
    'value',
    'Érebo',
  ],
  [
    'Plot',
    () => new PlotSyncHandler(),
    { name: 'Main plot', details: 'The central conflict.' },
    { name: 'Revised plot' },
    'name',
    'Revised plot',
  ],
  [
    'StoryArc',
    () => new StoryArcSyncHandler(),
    { title: 'Ato I' },
    { title: 'Ato II' },
    'title',
    'Ato II',
  ],
];

/**
 * The uniqueness re-check on rename used to filter with `eq(id, update.id)` instead of
 * `ne(id, update.id)` - the query only ever matched the row being updated, so it could never
 * find "another" row with the same name, and the duplicate-prevention check was dead code.
 * These prove a rename that would collide with a *different*, already-existing row is
 * actually rejected now (Tag and Item both key uniqueness on `name` within a story).
 */
const renameCollisionCases: Array<
  [string, () => Handler, Record<string, unknown>, Record<string, unknown>]
> = [
  [
    'Tag',
    () => new TagSyncHandler(),
    { name: 'Vilões', color: null, isFavorite: false, extraNotes: null },
    { name: 'Heróis', color: null, isFavorite: false, extraNotes: null },
  ],
  [
    'Item',
    () => new ItemSyncHandler(),
    {
      characterOwnerId: null,
      name: 'Espada',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    },
    {
      characterOwnerId: null,
      name: 'Escudo',
      category: null,
      description: null,
      initialState: null,
      isFavorite: false,
      extraNotes: null,
    },
  ],
];

describe('simple sync entity handlers', () => {
  it.each(renameCollisionCases)(
    'a %s rename that collides with a different existing row is rejected',
    async (entity, build, firstData, secondData) => {
      const handler = build();
      const firstId = newId();
      const secondId = newId();
      await handler.create(userId, storyId, {
        type: 'create',
        entity,
        id: firstId,
        data: firstData,
      } as CreateStoryUpdate);
      await handler.create(userId, storyId, {
        type: 'create',
        entity,
        id: secondId,
        data: secondData,
      } as CreateStoryUpdate);
      const second = await handler.findByIdOrThrow(secondId);

      const rename = handler.update(
        userId,
        storyId,
        {
          type: 'update',
          entity,
          id: secondId,
          changes: { name: firstData.name, version: 1 },
        } as UpdateStoryUpdate,
        second,
      );

      await expect(rename).rejects.toThrow(/already exists/i);
      expect((await handler.findByIdOrThrow(secondId)).name).toBe(secondData.name);
    },
  );

  it.each(cases)(
    '%s shares the create, update, and tombstone contract',
    async (entity, build, data, changes, changedField, expectedValue) => {
      const handler = build();
      const id = newId();
      await handler.create(userId, storyId, {
        type: 'create',
        entity,
        id,
        data,
      } as CreateStoryUpdate);
      const created = await handler.findByIdOrThrow(id);
      expect(created).toMatchObject({ id, storyId, version: 1, isDeleted: false });

      await handler.update(
        userId,
        storyId,
        { type: 'update', entity, id, changes: { ...changes, version: 1 } } as UpdateStoryUpdate,
        created,
      );
      const updated = await handler.findByIdOrThrow(id);
      expect(updated).toMatchObject({ [changedField]: expectedValue, version: 2 });

      await handler.delete(
        userId,
        storyId,
        { type: 'delete', entity, id, version: 2 } as DeleteStoryUpdate,
        updated,
      );
      expect(await handler.findByIdOrThrow(id)).toMatchObject({ isDeleted: true, version: 3 });
    },
  );
});

describe('StoryArc ordering and defaults', () => {
  const create = (id: string, data: Record<string, unknown>) =>
    new StoryArcSyncHandler().create(userId, storyId, {
      type: 'create',
      entity: 'StoryArc',
      id,
      data,
    } as CreateStoryUpdate);

  it('makes the first arc of a story the default, ordered at zero', async () => {
    const handler = new StoryArcSyncHandler();
    const id = newId();

    await create(id, { title: 'Ato I' });

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      title: 'Ato I',
      sortOrder: 0,
      isDefault: true,
    });
  });

  it('appends later arcs after the live ones, never as default', async () => {
    const handler = new StoryArcSyncHandler();
    const firstId = newId();
    const secondId = newId();
    await create(firstId, { title: 'Ato I' });

    await create(secondId, { title: 'Ato II' });

    expect(await handler.findByIdOrThrow(secondId)).toMatchObject({
      sortOrder: 1,
      isDefault: false,
    });
  });

  it('honours an explicit position instead of appending', async () => {
    const handler = new StoryArcSyncHandler();
    const id = newId();

    await create(id, { title: 'Prólogo', sortOrder: 5 });

    expect((await handler.findByIdOrThrow(id)).sortOrder).toBe(5);
  });

  it('stores the presentation fields the client sent', async () => {
    const handler = new StoryArcSyncHandler();
    const id = newId();

    await create(id, {
      title: 'Ato I',
      description: 'O começo',
      color: '#ff0000',
      icon: 'swords',
      themeOverride: 'dark',
    });

    expect(await handler.findByIdOrThrow(id)).toMatchObject({
      description: 'O começo',
      color: '#ff0000',
      icon: 'swords',
      themeOverride: 'dark',
    });
  });

  it('refuses a second arc with an id that is already taken', async () => {
    const id = newId();
    await create(id, { title: 'Ato I' });

    await expect(create(id, { title: 'Outro' })).rejects.toThrow(
      `Conflict: StoryArc with ID ${id} already exists.`,
    );
  });
});

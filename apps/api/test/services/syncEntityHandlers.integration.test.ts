import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateCharacterDataSchema, PartialCharacterSchema } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { characters, stories, tags, users } from '../../src/db/schema';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import {
  BaseSyncEntityHandler,
  SyncConflictError,
  type SyncEntityHandler,
} from '../../src/services/entity-sync-handlers/BaseSyncEntityHandler';
import { FavoriteSyncHandler } from '../../src/services/entity-sync-handlers/FavoriteSyncHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
import { StorySyncHandler } from '../../src/services/entity-sync-handlers/StorySyncHandler';
import { TagSyncHandler } from '../../src/services/entity-sync-handlers/TagSyncHandler';
import { WorldRuleSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

const USER_ID = newId();
const STORY_ID = newId();

let handler: CharacterSyncHandler;

const createUpdate = (id: string, data: Record<string, unknown>): CreateStoryUpdate =>
  ({ type: 'create', entity: 'Character', id, data }) as CreateStoryUpdate;

const updateUpdate = (id: string, changes: Record<string, unknown>): UpdateStoryUpdate =>
  ({ type: 'update', entity: 'Character', id, changes }) as UpdateStoryUpdate;

const deleteUpdate = (id: string, version?: number): DeleteStoryUpdate =>
  ({ type: 'delete', entity: 'Character', id, version }) as DeleteStoryUpdate;

async function seedWorld() {
  const now = new Date();
  await db
    .insert(users)
    .values({ id: USER_ID, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: STORY_ID,
    userId: USER_ID,
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
}

/** Creates a character through the handler itself and returns the resulting row. */
async function createCharacter(id = newId(), name = 'Keres') {
  await handler.create(USER_ID, STORY_ID, createUpdate(id, { name }));
  return handler.findByIdOrThrow(id);
}

beforeEach(async () => {
  await truncateAll();
  await seedWorld();
  handler = new CharacterSyncHandler();
});

describe('create', () => {
  it('inserts the entity at version 1, under the story of the request', async () => {
    const id = newId();

    await handler.create(USER_ID, STORY_ID, createUpdate(id, { name: 'Keres' }));

    const row = await handler.findByIdOrThrow(id);
    expect(row).toMatchObject({
      id,
      storyId: STORY_ID,
      name: 'Keres',
      version: 1,
      isDeleted: false,
    });
  });

  it('ignores a storyId the client tried to smuggle in the payload', async () => {
    const id = newId();

    await handler.create(
      USER_ID,
      STORY_ID,
      createUpdate(id, { name: 'Keres', storyId: 'historia-alheia' }),
    );

    expect((await handler.findByIdOrThrow(id)).storyId).toBe(STORY_ID);
  });

  it('ignores a version the client tried to set', async () => {
    const id = newId();

    await handler.create(USER_ID, STORY_ID, createUpdate(id, { name: 'Keres', version: 99 }));

    expect((await handler.findByIdOrThrow(id)).version).toBe(1);
  });

  it('refuses to create the same entity twice', async () => {
    const id = newId();
    await handler.create(USER_ID, STORY_ID, createUpdate(id, { name: 'Keres' }));

    await expect(
      handler.create(USER_ID, STORY_ID, createUpdate(id, { name: 'Keres' })),
    ).rejects.toThrow(/already exists/);
  });

  it('rejects a payload the entity schema does not accept', async () => {
    await expect(
      handler.create(USER_ID, STORY_ID, createUpdate(newId(), { name: '' })),
    ).rejects.toThrow();
  });
});

describe('idempotent create comparison and log payloads', () => {
  it('recognizes only the same validated create payload as a safe retry', async () => {
    const row = await createCharacter();

    expect(handler.createPayloadMatches(row, { name: 'Keres' })).toBe(true);
    expect(handler.createPayloadMatches(row, { name: 'Nyx' })).toBe(false);
    expect(handler.createPayloadMatches(row, { name: '' })).toBe(false);
  });

  it('serializes deletes and reorders into the minimal operation-log payload', () => {
    expect(
      handler.sanitizePayloadForLog(
        { type: 'delete', entity: 'Character', id: 'char-1', version: 1 } as DeleteStoryUpdate,
        USER_ID,
      ),
    ).toEqual({ id: 'char-1' });
    expect(
      handler.sanitizePayloadForLog(
        {
          type: 'reorder',
          entity: 'Story',
          id: STORY_ID,
          reorderItems: [{ id: 'chapter-1', newIndex: 1 }],
          reorderTarget: 'Event',
        } as any,
        USER_ID,
      ),
    ).toEqual({
      reorderItems: [{ id: 'chapter-1', newIndex: 1 }],
      reorderTarget: 'Event',
      schemaEntityType: undefined,
    });
  });
});

describe('update', () => {
  it('applies the change and bumps the version', async () => {
    const entity = await createCharacter();

    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Nyx', version: 1 }),
      entity,
    );

    expect(await handler.findByIdOrThrow(entity.id)).toMatchObject({ name: 'Nyx', version: 2 });
  });

  it('leaves the fields the client did not send alone', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { title: 'A Deusa', version: 1 }),
      entity,
    );

    expect(await handler.findByIdOrThrow(entity.id)).toMatchObject({
      name: 'Keres',
      title: 'A Deusa',
    });
  });

  /**
   * The version comparison is equality, not `<`: with `<`, an edit made on a base newer than the
   * server's went through unchecked and every conflict escaped.
   */
  it('refuses an edit built on a stale base version', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Primeiro', version: 1 }),
      entity,
    );
    const current = await handler.findByIdOrThrow(entity.id);

    const stale = handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Segundo', version: 1 }),
      current,
    );

    await expect(stale).rejects.toBeInstanceOf(SyncConflictError);
    await expect(stale).rejects.toMatchObject({
      reason: 'version_conflict',
      clientVersion: 1,
      serverVersion: 2,
    });
  });

  it('does not write anything when the version conflicts', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Primeiro', version: 1 }),
      entity,
    );
    const current = await handler.findByIdOrThrow(entity.id);

    await handler
      .update(USER_ID, STORY_ID, updateUpdate(entity.id, { name: 'Segundo', version: 1 }), current)
      .catch(() => {});

    expect((await handler.findByIdOrThrow(entity.id)).name).toBe('Primeiro');
  });

  it('refuses an edit with no base version instead of last-write-wins', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Primeiro', version: 1 }),
      entity,
    );
    const current = await handler.findByIdOrThrow(entity.id);

    await expect(
      handler.update(USER_ID, STORY_ID, updateUpdate(entity.id, { name: 'Sem base' }), current),
    ).rejects.toBeInstanceOf(SyncConflictError);
    expect((await handler.findByIdOrThrow(entity.id)).name).toBe('Primeiro');
  });

  it('refuses a client that sends the already-incremented version instead of the base', async () => {
    const entity = await createCharacter();

    await expect(
      handler.update(
        USER_ID,
        STORY_ID,
        updateUpdate(entity.id, { name: 'Nyx', version: 2 }),
        entity,
      ),
    ).rejects.toBeInstanceOf(SyncConflictError);
    expect((await handler.findByIdOrThrow(entity.id)).name).toBe('Keres');
  });

  it('refuses to edit an entity that was deleted on the server', async () => {
    const entity = await createCharacter();
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);
    const deleted = await handler.findByIdOrThrow(entity.id);

    const edit = handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Nyx', version: 2 }),
      deleted,
    );

    await expect(edit).rejects.toMatchObject({ reason: 'deleted_on_server' });
  });

  it('restores a deleted entity when the client explicitly asks for it', async () => {
    const entity = await createCharacter();
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);
    const deleted = await handler.findByIdOrThrow(entity.id);

    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { isDeleted: false, name: 'Keres', version: 2 }),
      deleted,
    );

    expect(await handler.findByIdOrThrow(entity.id)).toMatchObject({
      isDeleted: false,
      deletedAt: null,
      name: 'Keres',
    });
  });

  it('stamps updatedAt with the time the client says the edit happened', async () => {
    const entity = await createCharacter();
    const operationTime = new Date(Date.now() - 60_000).toISOString();

    await handler.update(
      USER_ID,
      STORY_ID,
      {
        ...updateUpdate(entity.id, { name: 'Nyx', version: 1 }),
        operationTime,
      } as UpdateStoryUpdate,
      entity,
    );

    expect((await handler.findByIdOrThrow(entity.id)).updatedAt.toISOString()).toBe(operationTime);
  });

  /** A client clock running fast must not push the entity into the future. */
  it('refuses an operation time in the future', async () => {
    const entity = await createCharacter();
    const operationTime = new Date(Date.now() + 60_000).toISOString();

    const edit = handler.update(
      USER_ID,
      STORY_ID,
      {
        ...updateUpdate(entity.id, { name: 'Nyx', version: 1 }),
        operationTime,
      } as UpdateStoryUpdate,
      entity,
    );

    await expect(edit).rejects.toMatchObject({ reason: 'validation' });
  });

  it('allows a second of slack for clock drift', async () => {
    const entity = await createCharacter();
    const operationTime = new Date(Date.now() + 500).toISOString();

    await handler.update(
      USER_ID,
      STORY_ID,
      {
        ...updateUpdate(entity.id, { name: 'Nyx', version: 1 }),
        operationTime,
      } as UpdateStoryUpdate,
      entity,
    );

    expect((await handler.findByIdOrThrow(entity.id)).name).toBe('Nyx');
  });
});

describe('delete', () => {
  it('soft-deletes, keeping the row as a tombstone', async () => {
    const entity = await createCharacter();

    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);

    const row = await handler.findByIdOrThrow(entity.id);
    expect(row).toMatchObject({ isDeleted: true, version: 2 });
    expect(row.deletedAt).toBeInstanceOf(Date);
  });

  /** Resending the same deletion (a lost previous response) is not a conflict: it already took effect. */
  it('treats a repeated delete as a success', async () => {
    const entity = await createCharacter();
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);
    const deleted = await handler.findByIdOrThrow(entity.id);

    await expect(
      handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), deleted),
    ).resolves.toBeUndefined();
    expect((await handler.findByIdOrThrow(entity.id)).version).toBe(2);
  });

  it('refuses a delete built on a stale version', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Nyx', version: 1 }),
      entity,
    );
    const current = await handler.findByIdOrThrow(entity.id);

    const stale = handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), current);

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await handler.findByIdOrThrow(entity.id)).isDeleted).toBe(false);
  });
});

describe('ownership and story checks', () => {
  it('accepts an entity that belongs to the story', async () => {
    const entity = await createCharacter();

    expect(handler.checkBelongsToStory(entity, STORY_ID)).toBe(true);
  });

  it('rejects an entity from another story', async () => {
    const entity = await createCharacter();

    expect(handler.checkBelongsToStory(entity, 'outra-historia')).toBe(false);
  });

  it('treats ownership as satisfied for entities with no owner column', async () => {
    const entity = await createCharacter();

    expect(handler.checkOwnership(entity, 'qualquer-um')).toBe(true);
  });
});

describe('countForStoryIds', () => {
  it('counts the live rows of the story', async () => {
    await createCharacter(newId(), 'Keres');
    await createCharacter(newId(), 'Nyx');

    expect(await handler.countForStoryIds([STORY_ID])).toBe(2);
  });

  it('does not count deleted rows against the plan limit', async () => {
    const entity = await createCharacter();
    await createCharacter(newId(), 'Nyx');
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);

    expect(await handler.countForStoryIds([STORY_ID])).toBe(1);
  });

  it('returns zero for an empty list of stories', async () => {
    await createCharacter();

    expect(await handler.countForStoryIds([])).toBe(0);
  });

  it('does not count rows of another story', async () => {
    await createCharacter();

    expect(await handler.countForStoryIds(['outra-historia'])).toBe(0);
  });
});

describe('findDeleted', () => {
  it('lists tombstones with a display name the recovery screen can show', async () => {
    const entity = await createCharacter(newId(), 'Keres');
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);

    const deleted = await handler.findDeleted();

    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({
      id: entity.id,
      storyId: STORY_ID,
      name: 'Keres',
      version: 2,
    });
    expect(deleted[0].deletedAt).toBeInstanceOf(Date);
    expect(deleted[0].row).toMatchObject({ name: 'Keres' });
  });

  it('does not list live rows', async () => {
    await createCharacter();

    expect(await handler.findDeleted()).toEqual([]);
  });

  it('filters by story when asked', async () => {
    const entity = await createCharacter();
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);

    expect(await handler.findDeleted(STORY_ID)).toHaveLength(1);
    expect(await handler.findDeleted('outra-historia')).toEqual([]);
  });
});

/**
 * The behaviour above comes from the base class, shared by the 25 handlers. These cases confirm that a
 * handler with different columns inherits the same contract, rather than the test measuring a
 * peculiarity of `Character`.
 */
describe('other entities inherit the same contract', () => {
  it('a Tag goes through the same create/update/delete cycle', async () => {
    const tagHandler = new TagSyncHandler();
    const id = newId();

    await tagHandler.create(USER_ID, STORY_ID, {
      type: 'create',
      entity: 'Tag',
      id,
      data: { name: 'Vilões' },
    } as CreateStoryUpdate);
    const created = await tagHandler.findByIdOrThrow(id);
    await tagHandler.update(
      USER_ID,
      STORY_ID,
      {
        type: 'update',
        entity: 'Tag',
        id,
        changes: { name: 'Antagonistas', version: 1 },
      } as UpdateStoryUpdate,
      created,
    );
    const updated = await tagHandler.findByIdOrThrow(id);
    await tagHandler.delete(
      USER_ID,
      STORY_ID,
      { type: 'delete', entity: 'Tag', id, version: 2 } as DeleteStoryUpdate,
      updated,
    );

    const row = await db.select().from(tags).where(eq(tags.id, id));
    expect(row[0]).toMatchObject({ name: 'Antagonistas', isDeleted: true, version: 3 });
  });

  /**
   * `Note` and `WorldRule` used to have an `update` override that repeated the base without
   * `checkVersionConflict`: a concurrent edit on those two entities produced no conflict at all, and
   * when that override's `where version = ...` did not match, the user's edit vanished with no error.
   * The overrides were removed; these cases make sure the two do not drift from the contract again.
   */
  it.each([
    [
      'Note',
      () => new NoteSyncHandler() as SyncEntityHandler,
      { title: 'Ideia', body: null, extraNotes: null },
      { title: 'Outra' },
    ],
    [
      'WorldRule',
      () => new WorldRuleSyncHandler() as SyncEntityHandler,
      { title: 'Magia', description: null, extraNotes: null },
      { title: 'Magia elemental' },
    ],
  ])('a %s reports a version conflict the same way', async (entity, build, data, changes) => {
    const entityHandler = build();
    const id = newId();
    await entityHandler.create(USER_ID, STORY_ID, {
      type: 'create',
      entity,
      id,
      data,
    } as CreateStoryUpdate);
    const created = await entityHandler.findByIdOrThrow(id);

    const stale = entityHandler.update(
      USER_ID,
      STORY_ID,
      { type: 'update', entity, id, changes: { ...changes, version: 99 } } as UpdateStoryUpdate,
      created,
    );

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await entityHandler.findByIdOrThrow(id)).title).toBe(data.title);
  });

  it.each([
    [
      'Note',
      () => new NoteSyncHandler() as SyncEntityHandler,
      { title: 'Ideia', body: null, extraNotes: null },
    ],
    [
      'WorldRule',
      () => new WorldRuleSyncHandler() as SyncEntityHandler,
      { title: 'Magia', description: null, extraNotes: null },
    ],
  ])('a %s refuses an edit after it was deleted on the server', async (entity, build, data) => {
    const entityHandler = build();
    const id = newId();
    await entityHandler.create(USER_ID, STORY_ID, {
      type: 'create',
      entity,
      id,
      data,
    } as CreateStoryUpdate);
    const created = await entityHandler.findByIdOrThrow(id);
    await entityHandler.delete(
      USER_ID,
      STORY_ID,
      { type: 'delete', entity, id, version: 1 } as DeleteStoryUpdate,
      created,
    );
    const deleted = await entityHandler.findByIdOrThrow(id);

    const edit = entityHandler.update(
      USER_ID,
      STORY_ID,
      { type: 'update', entity, id, changes: { title: 'Depois', version: 2 } } as UpdateStoryUpdate,
      deleted,
    );

    await expect(edit).rejects.toMatchObject({ reason: 'deleted_on_server' });
  });

  it('keeps each entity type in its own table', async () => {
    const sharedId = newId();
    await handler.create(USER_ID, STORY_ID, createUpdate(sharedId, { name: 'Keres' }));
    const tagHandler = new TagSyncHandler();
    await tagHandler.create(USER_ID, STORY_ID, {
      type: 'create',
      entity: 'Tag',
      id: sharedId,
      data: { name: 'Vilões' },
    } as CreateStoryUpdate);

    expect((await db.select().from(characters).where(eq(characters.id, sharedId)))[0].name).toBe(
      'Keres',
    );
    expect((await db.select().from(tags).where(eq(tags.id, sharedId)))[0].name).toBe('Vilões');
  });
});

/**
 * A handler over the characters table with a configurable column mapping, to exercise the base
 * class paths that no concrete handler reaches: every shipped handler declares soft-delete
 * columns, so the "entity without tombstones" branches only run here.
 */
class ColumnProbeHandler extends BaseSyncEntityHandler<
  typeof CreateCharacterDataSchema,
  typeof PartialCharacterSchema
> {
  override entityName = 'Character';

  constructor(options?: {
    storyIdColumnName?: string;
    userIdColumnName?: string;
    isDeletedColumnName?: string;
    deletedAtColumnName?: string;
  }) {
    super('id', 'version', CreateCharacterDataSchema, PartialCharacterSchema, options);
  }

  async create(): Promise<void> {
    throw new Error('not implemented');
  }
}

describe('base handler defensive paths', () => {
  it('throws a plain error when the entity has no registered table', async () => {
    const probe = new ColumnProbeHandler();
    probe.entityName = 'SomethingFromTheFuture';

    await expect(probe.findById(newId())).rejects.toThrow(
      "No table registered for sync entity 'SomethingFromTheFuture'.",
    );
  });

  it('throws when the entity to load is not there', async () => {
    await expect(handler.findByIdOrThrow('nao-existe')).rejects.toThrow(
      'Character nao-existe not found.',
    );
  });

  it('counts every row when the entity has no soft-delete column to filter on', async () => {
    const id = newId();
    await createCharacter(id);
    await db.update(characters).set({ isDeleted: true }).where(eq(characters.id, id));
    const probe = new ColumnProbeHandler({ storyIdColumnName: 'storyId' });

    expect(await probe.countForStoryIds([STORY_ID])).toBe(1);
  });

  it('reports no tombstones for an entity that cannot soft-delete', async () => {
    const probe = new ColumnProbeHandler({ storyIdColumnName: 'storyId' });

    expect(await probe.findDeleted(STORY_ID)).toEqual([]);
  });

  it('refuses to delete an entity that cannot soft-delete', async () => {
    const probe = new ColumnProbeHandler({ storyIdColumnName: 'storyId' });
    const row = await createCharacter();

    await expect(probe.delete(USER_ID, STORY_ID, deleteUpdate(row.id, 1), row)).rejects.toThrow(
      /Delete not supported for entity Character/,
    );
  });

  it('reports a null deletion date when the entity tracks none', async () => {
    const probe = new ColumnProbeHandler({
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
    });
    const row = await createCharacter();
    await db.update(characters).set({ isDeleted: true }).where(eq(characters.id, row.id));

    expect(await probe.findDeleted(STORY_ID)).toEqual([
      expect.objectContaining({ id: row.id, deletedAt: null }),
    ]);
  });

  it('reports a null deletion date for a legacy tombstone that has none stored', async () => {
    const row = await createCharacter();
    await db
      .update(characters)
      .set({ isDeleted: true, deletedAt: null })
      .where(eq(characters.id, row.id));

    expect(await handler.findDeleted(STORY_ID)).toEqual([
      expect.objectContaining({ id: row.id, deletedAt: null }),
    ]);
  });

  it('throws when the loaded row carries no numeric version', async () => {
    const row = await createCharacter();

    await expect(
      handler.update(USER_ID, STORY_ID, updateUpdate(row.id, { name: 'x', version: 1 }), {
        ...row,
        version: 'corrupt',
      } as never),
    ).rejects.toThrow('Invalid persisted version for Character.');
  });

  it('sanitizes an unknown operation type into an empty log payload', () => {
    expect(
      handler.sanitizePayloadForLog(
        { type: 'teleport', entity: 'Character', id: 'c-1' } as never,
        USER_ID,
      ),
    ).toEqual({});
  });

  it('ignores identity and absent fields when comparing a resent create', async () => {
    const favoriteHandler = new FavoriteSyncHandler();
    const entityId = newId();

    expect(
      favoriteHandler.createPayloadMatches(
        { entityId, entityType: 'Character', userId: newId() },
        { entityId, entityType: 'Character', userId: newId() },
      ),
    ).toBe(true);

    const row = await createCharacter();
    expect(handler.createPayloadMatches(row, { name: 'Keres', title: undefined })).toBe(true);
  });
});

describe('base handler ownership and story checks', () => {
  it('compares the owner column when the entity has one', async () => {
    const storyHandler = new StorySyncHandler();
    const story = await db.query.stories.findFirst({ where: eq(stories.id, STORY_ID) });

    expect(storyHandler.checkOwnership(story as never, USER_ID)).toBe(true);
    expect(storyHandler.checkOwnership(story as never, 'outro-usuario')).toBe(false);
  });

  it('treats a top-level entity as belonging to any story', () => {
    const probe = new ColumnProbeHandler();

    expect(probe.checkBelongsToStory({ id: 'x' } as never, 'qualquer-historia')).toBe(true);
  });

  it('only lets a story belong to itself, never to a story id from the URL', async () => {
    const storyHandler = new StorySyncHandler();
    const story = await db.query.stories.findFirst({ where: eq(stories.id, STORY_ID) });

    expect(storyHandler.checkBelongsToStory(story as never, STORY_ID)).toBe(true);
    expect(storyHandler.checkBelongsToStory(story as never, 'historia-alheia')).toBe(false);
  });
});

describe('base handler delete race', () => {
  /**
   * Mirrors the update race the base already guards: two deletes read version 1, one commits,
   * and the loser's `WHERE version = 1` matches nothing. An empty `returning()` is a conflict -
   * the row changed under us - not a silent success.
   */
  it('reports a version conflict when the row moved between the read and the delete', async () => {
    const row = await createCharacter();
    await db.update(characters).set({ version: 2 }).where(eq(characters.id, row.id));

    await expect(
      handler.delete(USER_ID, STORY_ID, deleteUpdate(row.id, 1), row),
    ).rejects.toMatchObject({ reason: 'version_conflict' });
  });
});

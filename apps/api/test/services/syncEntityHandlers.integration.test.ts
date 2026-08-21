import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { characters, stories, tags, users } from '../../src/db/schema';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { SyncConflictError } from '../../src/services/entity-sync-handlers/BaseSyncEntityHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
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

/** Cria um personagem pelo próprio handler e devolve a linha resultante. */
async function createCharacter(id = newId(), name = 'Keres') {
  await handler.create(USER_ID, STORY_ID, createUpdate(id, { name }));
  return handler.findById(id);
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

    const row = await handler.findById(id);
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

    expect((await handler.findById(id)).storyId).toBe(STORY_ID);
  });

  it('ignores a version the client tried to set', async () => {
    const id = newId();

    await handler.create(USER_ID, STORY_ID, createUpdate(id, { name: 'Keres', version: 99 }));

    expect((await handler.findById(id)).version).toBe(1);
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

describe('update', () => {
  it('applies the change and bumps the version', async () => {
    const entity = await createCharacter();

    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Nyx', version: 1 }),
      entity,
    );

    expect(await handler.findById(entity.id)).toMatchObject({ name: 'Nyx', version: 2 });
  });

  it('leaves the fields the client did not send alone', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { title: 'A Deusa', version: 1 }),
      entity,
    );

    expect(await handler.findById(entity.id)).toMatchObject({ name: 'Keres', title: 'A Deusa' });
  });

  /**
   * A comparação de versão é de igualdade, não `<`: com `<`, uma edição feita sobre uma base
   * mais nova que a do servidor passava sem checagem e todo conflito escapava.
   */
  it('refuses an edit built on a stale base version', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Primeiro', version: 1 }),
      entity,
    );
    const current = await handler.findById(entity.id);

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
    const current = await handler.findById(entity.id);

    await handler
      .update(USER_ID, STORY_ID, updateUpdate(entity.id, { name: 'Segundo', version: 1 }), current)
      .catch(() => {});

    expect((await handler.findById(entity.id)).name).toBe('Primeiro');
  });

  it('refuses an edit with no base version instead of last-write-wins', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Primeiro', version: 1 }),
      entity,
    );
    const current = await handler.findById(entity.id);

    await expect(
      handler.update(USER_ID, STORY_ID, updateUpdate(entity.id, { name: 'Sem base' }), current),
    ).rejects.toBeInstanceOf(SyncConflictError);
    expect((await handler.findById(entity.id)).name).toBe('Primeiro');
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
    expect((await handler.findById(entity.id)).name).toBe('Keres');
  });

  it('refuses to edit an entity that was deleted on the server', async () => {
    const entity = await createCharacter();
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);
    const deleted = await handler.findById(entity.id);

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
    const deleted = await handler.findById(entity.id);

    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { isDeleted: false, name: 'Keres', version: 2 }),
      deleted,
    );

    expect(await handler.findById(entity.id)).toMatchObject({
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

    expect((await handler.findById(entity.id)).updatedAt.toISOString()).toBe(operationTime);
  });

  /** Relógio adiantado do cliente não pode empurrar a entidade para o futuro. */
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

    expect((await handler.findById(entity.id)).name).toBe('Nyx');
  });
});

describe('delete', () => {
  it('soft-deletes, keeping the row as a tombstone', async () => {
    const entity = await createCharacter();

    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);

    const row = await handler.findById(entity.id);
    expect(row).toMatchObject({ isDeleted: true, version: 2 });
    expect(row.deletedAt).toBeInstanceOf(Date);
  });

  /** Reenviar a mesma exclusão (resposta anterior perdida) não é conflito: já surtiu efeito. */
  it('treats a repeated delete as a success', async () => {
    const entity = await createCharacter();
    await handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), entity);
    const deleted = await handler.findById(entity.id);

    await expect(
      handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), deleted),
    ).resolves.toBeUndefined();
    expect((await handler.findById(entity.id)).version).toBe(2);
  });

  it('refuses a delete built on a stale version', async () => {
    const entity = await createCharacter();
    await handler.update(
      USER_ID,
      STORY_ID,
      updateUpdate(entity.id, { name: 'Nyx', version: 1 }),
      entity,
    );
    const current = await handler.findById(entity.id);

    const stale = handler.delete(USER_ID, STORY_ID, deleteUpdate(entity.id, 1), current);

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await handler.findById(entity.id)).isDeleted).toBe(false);
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
 * O comportamento acima é da base, compartilhada pelos 25 handlers. Estes casos confirmam que
 * um handler com colunas diferentes herda o mesmo contrato, em vez de o teste estar medindo
 * uma particularidade de `Character`.
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
    const created = await tagHandler.findById(id);
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
    const updated = await tagHandler.findById(id);
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
   * `Note` e `WorldRule` tinham um override de `update` que repetia a base sem
   * `checkVersionConflict`: uma edição concorrente sobre essas duas entidades não gerava
   * conflito nenhum, e quando o `where version = ...` daquele override não casava, a edição
   * do usuário sumia sem erro. Os overrides foram removidos; estes casos garantem que as duas
   * não voltem a divergir do contrato.
   */
  it.each([
    [
      'Note',
      () => new NoteSyncHandler(),
      { title: 'Ideia', body: null, extraNotes: null },
      { title: 'Outra' },
    ],
    [
      'WorldRule',
      () => new WorldRuleSyncHandler(),
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
    const created = await entityHandler.findById(id);

    const stale = entityHandler.update(
      USER_ID,
      STORY_ID,
      { type: 'update', entity, id, changes: { ...changes, version: 99 } } as UpdateStoryUpdate,
      created,
    );

    await expect(stale).rejects.toMatchObject({ reason: 'version_conflict' });
    expect((await entityHandler.findById(id)).title).toBe(data.title);
  });

  it.each([
    ['Note', () => new NoteSyncHandler(), { title: 'Ideia', body: null, extraNotes: null }],
    [
      'WorldRule',
      () => new WorldRuleSyncHandler(),
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
    const created = await entityHandler.findById(id);
    await entityHandler.delete(
      USER_ID,
      STORY_ID,
      { type: 'delete', entity, id, version: 1 } as DeleteStoryUpdate,
      created,
    );
    const deleted = await entityHandler.findById(id);

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

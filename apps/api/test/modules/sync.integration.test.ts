import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  chapters,
  characters,
  favorites,
  operationLog,
  scenes,
  stories,
} from '../../src/db/schema';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let storyId: string;

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

const pull = (
  token: string,
  story: string,
  lastOperationVersion = 0,
  lastPublicFavoriteVersion = 0,
) =>
  request('GET', `/sync/${story}/pull`, {
    token,
    query: { lastOperationVersion, lastPublicFavoriteVersion },
  });

/** A character-create operation, the simplest way to write something through sync. */
const createCharacter = (id: string, name: string, version = 0) => ({
  type: 'create' as const,
  entity: 'Character',
  id,
  version,
  data: { id, storyId, name },
  clientOperationId: `local-${id}`,
});

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  const { data } = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'A Queda', type: 'linear' },
  });
  storyId = data.id;
});

describe('POST /sync/:storyId', () => {
  it('applies an operation and reports it as applied', async () => {
    const characterId = newId();

    const { status, data } = await push(ana.token, storyId, [
      createCharacter(characterId, 'Keres'),
    ]);

    expect(status).toBe(200);
    expect(data.processedUpdates).toBe(1);
    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
    expect(data.applied[0]).toMatchObject({ entity: 'Character', entityId: characterId });
  });

  it('echoes the client operation id, so the client knows what landed', async () => {
    const characterId = newId();

    const { data } = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    expect(data.applied[0].clientOperationId).toBe(`local-${characterId}`);
  });

  it('moves the server operation version forward', async () => {
    const first = await push(ana.token, storyId, [createCharacter(newId(), 'Keres')]);
    const second = await push(ana.token, storyId, [createCharacter(newId(), 'Nyx')]);

    expect(second.data.serverMaxOperationVersion).toBeGreaterThan(
      first.data.serverMaxOperationVersion,
    );
  });

  it('accepts an empty batch without moving anything', async () => {
    const { status, data } = await push(ana.token, storyId, []);

    expect(status).toBe(200);
    expect(data.processedUpdates).toBe(0);
    expect(data.applied).toEqual([]);
  });

  /**
   * An `update`'s comparison base goes in `changes.version`, not in the top-level `version` - that is
   * where `BaseSyncEntityHandler` reads it from, and it is what `SyncEngineService` sends.
   */
  const updateCharacter = (
    id: string,
    name: string,
    baseVersion: number,
    clientOperationId?: string,
  ) => ({
    type: 'update' as const,
    entity: 'Character',
    id,
    version: baseVersion,
    changes: { name, version: baseVersion },
    ...(clientOperationId ? { clientOperationId } : {}),
  });

  it('applies an update on top of the version the client based it on', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const baseVersion = created.data.applied[0].entityVersion;

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Keres, a Deusa', baseVersion, 'local-update'),
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied[0].entityVersion).toBeGreaterThan(baseVersion);
  });

  it('reports a conflict when the client based its edit on a stale version', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [updateCharacter(characterId, 'Primeiro', staleVersion)]);

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Segundo', staleVersion, 'local-stale'),
    ]);

    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0]).toMatchObject({
      entity: 'Character',
      entityId: characterId,
      reason: 'version_conflict',
      clientOperationId: 'local-stale',
    });
  });

  it('reports the server version on a conflict, so the client can rebase', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [updateCharacter(characterId, 'Primeiro', staleVersion)]);

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Segundo', staleVersion),
    ]);

    expect(data.conflicts[0].clientVersion).toBe(staleVersion);
    expect(data.conflicts[0].serverVersion).toBeGreaterThan(staleVersion);
  });

  /**
   * `changedFields` is what lets the client tell "the base went stale because another field changed"
   * (mergeable without asking anything) from "the same field I edited also changed over there" (a real
   * decision). Comparing `serverEntity` directly against what the client wants to write would not do:
   * the current value of a field the client is editing always "looks" different from the new value,
   * whether the server touched it or not - only the operation history (via `entityVersion`) says what
   * actually changed.
   */
  it('reports only the fields that actually changed since the base version, not every field', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: characterId,
        version: staleVersion,
        changes: { title: 'A Deusa Esquecida', version: staleVersion },
      },
    ]);

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Nyx', staleVersion, 'local-name-edit'),
    ]);

    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].changedFields).toEqual(['title']);
  });

  it('includes a field in changedFields when both sides genuinely edited it', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [updateCharacter(characterId, 'Primeiro', staleVersion)]);

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Segundo', staleVersion, 'local-name-clash'),
    ]);

    expect(data.conflicts[0].changedFields).toContain('name');
  });

  /**
   * `entity_version` is null on rows written before that column existed (see the comment on the
   * migration itself). One of those rows cannot be compared against the client's base -
   * `entityVersion > sinceVersion` in Postgres is never true for NULL, so it drops out of the union with
   * no warning, and the set of "changed" fields comes back incomplete. `changedFields` has to come back
   * absent (not as an incomplete list) so the client knows it cannot trust it and falls back to the safe
   * path of always asking, instead of risking a merge over a real dispute the gap concealed.
   */
  it('omits changedFields entirely when an intervening operation has no entityVersion recorded', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    const intervening = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Primeiro', staleVersion),
    ]);
    await db
      .update(operationLog)
      .set({ entityVersion: null })
      .where(eq(operationLog.id, intervening.data.applied[0].operationId));

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Segundo', staleVersion, 'local-after-legacy-row'),
    ]);

    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].changedFields).toBeUndefined();
  });

  /**
   * A real protocol trap: without `changes.version` the server has no base to compare against and
   * applies the write, turning it into last-write-wins. A client that fills in only the top-level
   * `version` loses conflict detection entirely with no signal at all.
   */
  it('rejects an update that omits changes.version instead of last-write-wins', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [updateCharacter(characterId, 'Primeiro', staleVersion)]);

    const { status } = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: characterId,
        version: staleVersion,
        changes: { name: 'Segundo' },
      },
    ]);

    expect(status).toBe(422);
  });

  it('applies the good operations of a batch even when one conflicts', async () => {
    const goodId = newId();

    const { data } = await push(ana.token, storyId, [
      createCharacter(goodId, 'Keres'),
      {
        type: 'update',
        entity: 'Character',
        id: newId(),
        version: 5,
        changes: { name: 'Fantasma', version: 5 },
      },
    ]);

    expect(data.applied).toHaveLength(1);
    expect(data.applied[0].entityId).toBe(goodId);
    expect(data.conflicts).toHaveLength(1);
  });

  it('blocks only later operations for the entity that already conflicted, while preserving other work in the batch', async () => {
    const characterId = newId();
    const otherId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Stale edit', 0, 'stale-first'),
      updateCharacter(characterId, 'Would otherwise be valid', 1, 'blocked-second'),
      createCharacter(otherId, 'Independent work'),
    ]);

    expect(data.applied).toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: otherId })]),
    );
    expect(data.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clientOperationId: 'stale-first', reason: 'version_conflict' }),
        expect.objectContaining({
          clientOperationId: 'blocked-second',
          reason: 'version_conflict',
          message: expect.stringContaining('Skipped: an earlier operation'),
        }),
      ]),
    );
    expect(
      (await db.query.characters.findFirst({ where: eq(characters.id, characterId) }))?.name,
    ).toBe('Keres');
  });

  it('accepts a resent create after later edits by comparing it with the recorded create payload', async () => {
    const characterId = newId();
    const original = createCharacter(characterId, 'Keres');
    const created = await push(ana.token, storyId, [original]);
    await push(ana.token, storyId, [
      updateCharacter(characterId, 'Keres, a Deusa', created.data.applied[0].entityVersion),
    ]);

    const retried = await push(ana.token, storyId, [original]);

    expect(retried.data.conflicts).toEqual([]);
    expect(retried.data.applied).toEqual([
      expect.objectContaining({ entityId: characterId, entityVersion: 2 }),
    ]);
    expect(
      (await db.query.characters.findFirst({ where: eq(characters.id, characterId) }))?.name,
    ).toBe('Keres, a Deusa');
  });

  it('refuses a second create with the same id when neither the live row nor its original log payload matches', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    const { data } = await push(ana.token, storyId, [createCharacter(characterId, 'Outra pessoa')]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({
        entityId: characterId,
        reason: 'validation',
        message: expect.stringContaining('different data'),
      }),
    ]);
  });

  it('allows a tombstone to be retried and restores it only through a versioned update', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const deleted = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Character', id: characterId, version: 1 },
    ]);

    const retry = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Character', id: characterId, version: 1 },
    ]);
    expect(retry.data.conflicts).toEqual([]);
    expect(retry.data.applied).toHaveLength(1);

    const restored = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: characterId,
        changes: {
          name: 'Keres voltou',
          isDeleted: false,
          version: deleted.data.applied[0].entityVersion,
        },
      },
    ]);
    expect(restored.data.conflicts).toEqual([]);
    expect(
      await db.query.characters.findFirst({ where: eq(characters.id, characterId) }),
    ).toMatchObject({
      name: 'Keres voltou',
      isDeleted: false,
      deletedAt: null,
    });
  });

  it('rejects an operation timestamp that is in the future instead of letting client clocks reorder history', async () => {
    const { data } = await push(ana.token, storyId, [
      {
        ...createCharacter(newId(), 'Do futuro'),
        operationTime: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({ reason: 'validation', message: expect.stringContaining('future') }),
    ]);
  });

  it('rejects an invalid operation timestamp before a handler can persist an invalid date', async () => {
    const { status } = await push(ana.token, storyId, [
      { ...createCharacter(newId(), 'Tempo inválido'), operationTime: 'not-a-date' },
    ]);

    expect(status).toBe(422);
  });

  it('rejects a batch that is not an array of operations', async () => {
    const { status } = await push(ana.token, storyId, { type: 'create' } as any);

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const { status } = await request('POST', `/sync/${storyId}`, { body: [] });

    expect(status).toBe(401);
  });

  /**
   * Story has no `storyIdColumnName` (it's its own root, not a child row scoped by one), and
   * `checkBelongsToStory`'s base implementation assumes that means "top-level entity, nothing
   * to check" and allows it through. Without `StorySyncHandler`'s override, a user with write
   * access to their own story could push a `Story`-type update/delete targeting any *other*
   * story's id through their own story's `/sync/:storyId` endpoint and mutate or delete it,
   * just by knowing its ULID.
   */
  it("rejects a Story update targeting a different story than the one in the URL, even one the pusher doesn't own", async () => {
    const bia = await registerUser('bia');
    const { data: biaStory } = await request('POST', '/stories/', {
      token: bia.token,
      body: { title: "Bia's story", type: 'linear' },
    });

    const { data } = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Story',
        id: biaStory.id,
        changes: { title: 'Sequestrada', version: 1 },
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0]).toMatchObject({ entity: 'Story', reason: 'unauthorized' });

    const { data: reFetched } = await request('GET', `/stories/${biaStory.id}/export`, {
      token: bia.token,
    });
    expect(reFetched.story.title).toBe("Bia's story");
  });

  it("rejects a Story delete targeting a different story than the one in the URL, even one the pusher doesn't own", async () => {
    const bia = await registerUser('bia');
    const { data: biaStory } = await request('POST', '/stories/', {
      token: bia.token,
      body: { title: "Bia's story", type: 'linear' },
    });

    const { data } = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Story', id: biaStory.id, version: 1 },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0]).toMatchObject({ entity: 'Story', reason: 'unauthorized' });

    const { data: reFetched } = await request('GET', `/stories/${biaStory.id}/export`, {
      token: bia.token,
    });
    expect(reFetched.story.isDeleted).toBe(false);
  });
});

/**
 * Before this fix, a relation handler (CharacterRelation, ChoiceCheck, ItemJourney...) referencing a
 * deleted entity threw a generic `Error`, and the conflict reached the client with
 * `reason: 'unknown'` - indistinguishable from any other unexpected failure. That matters because
 * "keep my version" in that case resends the same operation, which fails for the same reason again,
 * endlessly - the conflict screen needs the right `reason` to know that option should not even be
 * offered (see `SyncConflictModal.tsx`).
 */
describe('a sync operation referencing a deleted entity', () => {
  it('reports referenced_entity_deleted instead of unknown', async () => {
    const character1Id = newId();
    const character2Id = newId();
    await push(ana.token, storyId, [createCharacter(character1Id, 'Keres')]);
    await push(ana.token, storyId, [createCharacter(character2Id, 'Nyx')]);
    await push(ana.token, storyId, [
      { type: 'delete', entity: 'Character', id: character1Id, version: 1 },
    ]);

    const relationId = newId();
    const { data } = await push(ana.token, storyId, [
      {
        type: 'create',
        entity: 'CharacterRelation',
        id: relationId,
        data: {
          id: relationId,
          storyId,
          character1Id,
          character2Id,
          relationType: 'friend',
        },
        clientOperationId: 'local-relation',
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0]).toMatchObject({
      entity: 'CharacterRelation',
      reason: 'referenced_entity_deleted',
      clientOperationId: 'local-relation',
    });
  });
});

describe('GET /sync/:storyId/pull', () => {
  it('returns nothing new for a client that is already up to date', async () => {
    const { data: pushed } = await push(ana.token, storyId, [createCharacter(newId(), 'Keres')]);

    const { status, data } = await pull(
      ana.token,
      storyId,
      pushed.data?.serverMaxOperationVersion ?? 0,
    );

    expect(status).toBe(200);
    expect(data.serverMaxOperationVersion).toBeGreaterThanOrEqual(0);
  });

  it('returns the operations a client has not seen yet', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    const { data } = await pull(ana.token, storyId, 0);

    expect(data.updates.length).toBeGreaterThan(0);
    expect(data.updates.some((update: any) => update.id === characterId)).toBe(true);
  });

  it('reconstructs create, update, and delete entries with entity versions rather than log positions', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: characterId,
        changes: { name: 'Keres, a Deusa', version: created.data.applied[0].entityVersion },
      },
    ]);
    await push(ana.token, storyId, [
      { type: 'delete', entity: 'Character', id: characterId, version: 2 },
    ]);

    const { data } = await pull(ana.token, storyId);
    const [create, update, deletion] = data.updates.filter(
      (entry: { entity: string; id: string }) =>
        entry.entity === 'Character' && entry.id === characterId,
    );

    expect(create).toMatchObject({
      type: 'create',
      version: 1,
      data: expect.objectContaining({ name: 'Keres' }),
      operationId: expect.any(String),
    });
    expect(update).toMatchObject({
      type: 'update',
      version: 2,
      changes: expect.objectContaining({ name: 'Keres, a Deusa' }),
      operationId: expect.any(String),
    });
    expect(create.data).not.toHaveProperty('storyId');
    expect(update.changes).not.toHaveProperty('storyId');
    expect(deletion).toMatchObject({ type: 'delete', version: 3, operationId: expect.any(String) });
    expect(deletion.data).toBeUndefined();
  });

  it('publishes legacy favorites exactly once when a story becomes public', async () => {
    const bia = await registerUser('bia');
    const favoriteId = newId();
    await db
      .update(stories)
      .set({ favoriteBehavior: 'individual_public' })
      .where(eq(stories.id, storyId));
    await db.insert(favorites).values({
      id: favoriteId,
      storyId,
      entityId: newId(),
      entityType: 'Character',
      userId: bia.userId,
      version: 1,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Two first pulls can arrive together when two devices reconnect. The repair must serialize
    // itself: both callers can receive the row, but only one operation-log create may be born.
    const [first, second] = await Promise.all([
      pull(ana.token, storyId),
      pull(ana.token, storyId, 0, 0),
    ]);
    const repairLogs = await db.query.operationLog.findMany({
      where: eq(operationLog.entityId, favoriteId),
    });

    expect(first.data.publicFavorites).toEqual([
      expect.objectContaining({ id: favoriteId, userId: bia.userId }),
    ]);
    expect(first.data.updates).toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'Favorite', id: favoriteId })]),
    );
    expect(second.data.updates).toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'Favorite', id: favoriteId })]),
    );
    expect(repairLogs).toHaveLength(1);
  });

  it('tells the caller which role they hold on the story', async () => {
    const { data } = await pull(ana.token, storyId, 0);

    expect(data.role).toBe('owner');
  });

  it('serializes chapter and story reorders back into the exact pull operations clients apply', async () => {
    const chapterA = newId();
    const chapterB = newId();
    const sceneA = newId();
    const sceneB = newId();
    const now = new Date();
    await db.insert(chapters).values([
      {
        id: chapterA,
        storyId,
        name: 'Um',
        index: 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: chapterB,
        storyId,
        name: 'Dois',
        index: 2,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ] as never);
    await db.insert(scenes).values([
      {
        id: sceneA,
        storyId,
        chapterId: chapterA,
        name: 'Cena um',
        index: 1,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: sceneB,
        storyId,
        chapterId: chapterA,
        name: 'Cena dois',
        index: 2,
        version: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      },
    ] as never);

    const chapterPush = await push(ana.token, storyId, [
      {
        type: 'reorder',
        entity: 'Chapter',
        id: chapterA,
        version: 1,
        reorderItems: [
          { id: sceneA, newIndex: 2 },
          { id: sceneB, newIndex: 1 },
        ],
        clientOperationId: 'chapter-reorder',
      },
    ]);
    expect(chapterPush.data.conflicts).toEqual([]);
    const storyPush = await push(ana.token, storyId, [
      {
        type: 'reorder',
        entity: 'Story',
        id: storyId,
        version: 1,
        reorderItems: [
          { id: chapterA, newIndex: 2 },
          { id: chapterB, newIndex: 1 },
        ],
        clientOperationId: 'story-reorder',
      },
    ]);
    expect(storyPush.data.conflicts).toEqual([]);

    const { data } = await pull(ana.token, storyId);
    expect(data.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'reorder',
          entity: 'Chapter',
          id: chapterA,
          reorderItems: [
            { id: sceneA, newIndex: 2 },
            { id: sceneB, newIndex: 1 },
          ],
        }),
        expect.objectContaining({
          type: 'reorder',
          entity: 'Story',
          id: storyId,
          reorderItems: [
            { id: chapterA, newIndex: 2 },
            { id: chapterB, newIndex: 1 },
          ],
        }),
      ]),
    );
  });

  it('rejects a pull with no version, since the server cannot guess it', async () => {
    const { status } = await request('GET', `/sync/${storyId}/pull`, { token: ana.token });

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', `/sync/${storyId}/pull`, {
      query: { lastOperationVersion: 0 },
    });

    expect(status).toBe(401);
  });
});

describe('GET /sync/pullpreviews', () => {
  it('lists the stories the user can reach, with their versions and role', async () => {
    const { status, data } = await request('GET', '/sync/pullpreviews', { token: ana.token });

    expect(status).toBe(200);
    expect(data.storyPreviews).toEqual([
      expect.objectContaining({ storyId, role: 'owner', lastOperationVersion: expect.any(Number) }),
    ]);
  });

  it('does not list stories that belong to someone else', async () => {
    const bia = await registerUser('bia');

    const { data } = await request('GET', '/sync/pullpreviews', { token: bia.token });

    expect(data.storyPreviews).toEqual([]);
  });

  it('lists a shared story with the collaborator role rather than treating it as owned', async () => {
    const bia = await registerUser('bia');
    await grantCollaborator(ana, bia, storyId, 'writer');

    const { data } = await request('GET', '/sync/pullpreviews', { token: bia.token });

    expect(data.storyPreviews).toEqual([
      expect.objectContaining({ storyId, role: 'writer', lastOperationVersion: 0 }),
    ]);
  });

  /**
   * `lastOperationVersion` used to come from `stories.version` (the Story row's own
   * optimistic-concurrency counter, bumped only when the Story row itself changes) instead of
   * `stories.lastOperationVersion` (a separate counter bumped by every operation in the story,
   * including child-entity ones). Pushing a Character never touches the Story row, so the old
   * code would report this preview's version as still 1 - stuck, even though real operations
   * happened and a client relying on this number to decide "does this story need a pull" would
   * never notice.
   */
  it("reports the story's actual lastOperationVersion, not the Story row's own version", async () => {
    // Two pushes, not one: lastOperationVersion starts at 0 and the story's own creation (via
    // POST /stories/, outside the operation log) never bumps it, so a single push landing on 1
    // wouldn't distinguish "tracks real operations" from "coincidentally already 1". A second
    // push moving it to 2 does.
    await push(ana.token, storyId, [createCharacter(newId(), 'Keres')]);
    const secondPush = await push(ana.token, storyId, [createCharacter(newId(), 'Nyx')]);

    const { data } = await request('GET', '/sync/pullpreviews', { token: ana.token });

    const preview = data.storyPreviews.find((p: { storyId: string }) => p.storyId === storyId);
    expect(preview.lastOperationVersion).toBe(secondPush.data.serverMaxOperationVersion);
    expect(preview.lastOperationVersion).toBeGreaterThan(1);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', '/sync/pullpreviews');

    expect(status).toBe(401);
  });
});

const grantCollaborator = async (
  owner: TestUser,
  collaborator: TestUser,
  story: string,
  permissionType: 'reader' | 'writer' = 'writer',
) => {
  const requested = await request('POST', `/friend/request/${collaborator.userId}`, {
    token: owner.token,
  });
  expect(requested.status).toBeLessThan(400);
  const accepted = await request('PUT', `/friend/accept/${owner.userId}`, {
    token: collaborator.token,
  });
  expect(accepted.status).toBeLessThan(400);
  const granted = await request('POST', '/story-permissions/', {
    token: owner.token,
    body: { storyId: story, targetUserId: collaborator.userId, permissionType },
  });
  expect(granted.status).toBeLessThan(400);
};

const grantWriter = (owner: TestUser, collaborator: TestUser, story: string) =>
  grantCollaborator(owner, collaborator, story, 'writer');

describe('sync authorization hardening', () => {
  it('lets a reader pull the shared history while reporting the reader role', async () => {
    const bia = await registerUser('bia');
    await grantCollaborator(ana, bia, storyId, 'reader');
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    const { status, data } = await pull(bia.token, storyId);

    expect(status).toBe(200);
    expect(data.role).toBe('reader');
    expect(data.updates).toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'Character', id: characterId })]),
    );
  });

  it('does not leak a private favorite operation to another collaborator on pull', async () => {
    const bia = await registerUser('bia');
    await grantCollaborator(ana, bia, storyId, 'writer');
    const characterId = newId();
    const favoriteId = newId();
    await push(ana.token, storyId, [
      createCharacter(characterId, 'Keres'),
      {
        type: 'create',
        entity: 'Favorite',
        id: favoriteId,
        data: { userId: ana.userId, entityId: characterId, entityType: 'Character' },
        clientOperationId: 'ana-private-favorite',
      },
    ]);

    const { status, data } = await pull(bia.token, storyId);

    expect(status).toBe(200);
    expect(data.updates).toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'Character', id: characterId })]),
    );
    expect(data.updates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'Favorite', id: favoriteId })]),
    );
    expect(data.publicFavorites).toEqual([]);
  });

  it('rejects a pull from a user with no permission to read the story', async () => {
    const bia = await registerUser('bia');

    const { status } = await pull(bia.token, storyId);

    expect(status).toBe(403);
  });

  it('rejects a push to a story that the user cannot access', async () => {
    const bia = await registerUser('bia');

    const { status } = await push(bia.token, storyId, [createCharacter(newId(), 'Invasora')]);

    expect(status).toBe(403);
  });

  it('does not let a writer steal story ownership via userId in an update', async () => {
    const bia = await registerUser('bia');
    await grantWriter(ana, bia, storyId);

    const { data } = await push(bia.token, storyId, [
      {
        type: 'update',
        entity: 'Story',
        id: storyId,
        changes: { userId: bia.userId, version: 1 },
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts[0]).toMatchObject({ entity: 'Story', reason: 'unauthorized' });

    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(story?.userId).toBe(ana.userId);
  });

  it('allows a writer to update ordinary story content while preserving the owner-only policy', async () => {
    const bia = await registerUser('bia');
    await grantWriter(ana, bia, storyId);

    const { data } = await push(bia.token, storyId, [
      {
        type: 'update',
        entity: 'Story',
        id: storyId,
        changes: { title: 'Título colaborativo', version: 1 },
      },
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
    expect((await db.query.stories.findFirst({ where: eq(stories.id, storyId) }))?.title).toBe(
      'Título colaborativo',
    );
  });

  it('does not let a writer delete the story', async () => {
    const bia = await registerUser('bia');
    await grantWriter(ana, bia, storyId);

    const { data } = await push(bia.token, storyId, [
      { type: 'delete', entity: 'Story', id: storyId, version: 1 },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts[0]).toMatchObject({ entity: 'Story', reason: 'unauthorized' });

    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(story?.isDeleted).toBe(false);
  });

  it('does not let a writer move a character into another story', async () => {
    const bia = await registerUser('bia');
    const { data: biaStory } = await request('POST', '/stories/', {
      token: bia.token,
      body: { title: 'Outra', type: 'linear' },
    });
    await grantWriter(ana, bia, storyId);
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    const { data } = await push(bia.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: characterId,
        changes: { storyId: biaStory.id, version: 1 },
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts[0]).toMatchObject({ reason: 'unauthorized' });

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });
    expect(character?.storyId).toBe(storyId);
  });

  it('does not let a writer create a second story through this story sync endpoint', async () => {
    const bia = await registerUser('bia');
    await grantWriter(ana, bia, storyId);
    const ghostId = newId();

    const { data } = await push(bia.token, storyId, [
      {
        type: 'create',
        entity: 'Story',
        id: ghostId,
        data: { title: 'Fantasma', type: 'linear' },
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts[0]).toMatchObject({ entity: 'Story', reason: 'unauthorized' });

    const ghost = await db.query.stories.findFirst({ where: eq(stories.id, ghostId) });
    expect(ghost).toBeUndefined();
  });

  it('lets the owner delete the story without sending a base version', async () => {
    const { data } = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Story', id: storyId },
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(story?.isDeleted).toBe(true);
  });

  it('does not retransmit extra client fields through the operation log', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [
      {
        type: 'create',
        entity: 'Character',
        id: characterId,
        data: { name: 'Keres', isDeleted: true, extraField: 'poison', storyId },
        clientOperationId: `local-${characterId}`,
      },
    ]);

    const { data } = await pull(ana.token, storyId, 0);
    const created = data.updates.find((update: { id: string }) => update.id === characterId);

    expect(created.data.extraField).toBeUndefined();
    expect(created.data.isDeleted).toBe(false);
    expect(created.data.storyId).toBeUndefined();
    expect(created.data.name).toBe('Keres');
  });

  it('lets a reader save only a favorite under their own identity, not story content', async () => {
    const bia = await registerUser('bia');
    await grantCollaborator(ana, bia, storyId, 'reader');
    const characterId = newId();
    const favoriteId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    const { data } = await push(bia.token, storyId, [
      createCharacter(newId(), 'Leitor não pode escrever'),
      {
        type: 'create',
        entity: 'Favorite',
        id: favoriteId,
        data: { userId: bia.userId, entityId: characterId, entityType: 'Character' },
        clientOperationId: 'reader-favorite',
      },
    ]);

    expect(data.applied).toEqual([
      expect.objectContaining({ entity: 'Favorite', entityId: favoriteId }),
    ]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({ entity: 'Character', reason: 'unauthorized' }),
    ]);
  });

  it('enforces the reader-comment switch on create, update, and delete', async () => {
    const bia = await registerUser('bia');
    await grantCollaborator(ana, bia, storyId, 'reader');
    const characterId = newId();
    const commentId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const comment = {
      type: 'create',
      entity: 'Comment',
      id: commentId,
      data: {
        entityType: 'Character',
        entityId: characterId,
        fieldId: null,
        fieldKey: 'name',
        contentSnapshot: 'Keres',
        excerptText: null,
        authorUserId: bia.userId,
        commentText: 'Rever este nome',
        criticality: 1,
      },
    };

    const blocked = await push(bia.token, storyId, [comment]);
    expect(blocked.data.conflicts[0]).toMatchObject({ entity: 'Comment', reason: 'unauthorized' });

    await db.update(stories).set({ allowReaderComments: true }).where(eq(stories.id, storyId));
    const created = await push(bia.token, storyId, [comment]);
    expect(created.data.applied).toHaveLength(1);
    const commentVersion = created.data.applied[0].entityVersion;

    await db.update(stories).set({ allowReaderComments: false }).where(eq(stories.id, storyId));
    const afterDisabled = await push(bia.token, storyId, [
      {
        type: 'update',
        entity: 'Comment',
        id: commentId,
        changes: { commentText: 'Não deveria editar', version: commentVersion },
      },
      { type: 'delete', entity: 'Comment', id: commentId, version: commentVersion },
    ]);

    expect(afterDisabled.data.applied).toEqual([]);
    expect(afterDisabled.data.conflicts).toEqual([
      expect.objectContaining({ entity: 'Comment', reason: 'unauthorized' }),
      expect.objectContaining({ entity: 'Comment', reason: 'unauthorized' }),
    ]);
  });

  it('allows the owner to moderate a reader comment but never lets the owner edit its text', async () => {
    const bia = await registerUser('bia');
    await grantCollaborator(ana, bia, storyId, 'reader');
    await db.update(stories).set({ allowReaderComments: true }).where(eq(stories.id, storyId));
    const characterId = newId();
    const commentId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const created = await push(bia.token, storyId, [
      {
        type: 'create',
        entity: 'Comment',
        id: commentId,
        data: {
          entityType: 'Character',
          entityId: characterId,
          fieldId: null,
          fieldKey: 'name',
          contentSnapshot: 'Keres',
          excerptText: null,
          authorUserId: bia.userId,
          commentText: 'Comentário da Bia',
          criticality: 1,
        },
      },
    ]);
    const version = created.data.applied[0].entityVersion;

    const edit = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Comment',
        id: commentId,
        changes: { commentText: 'Alterado pela dona', version },
      },
    ]);
    expect(edit.data.conflicts[0]).toMatchObject({ reason: 'unauthorized' });

    const deleted = await push(ana.token, storyId, [
      { type: 'delete', entity: 'Comment', id: commentId, version },
    ]);
    expect(deleted.data.applied).toHaveLength(1);
  });

  it("does not let one writer delete another writer's comment", async () => {
    const bia = await registerUser('bia');
    const caio = await registerUser('caio');
    await grantWriter(ana, bia, storyId);
    await grantWriter(ana, caio, storyId);
    const characterId = newId();
    const commentId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const created = await push(bia.token, storyId, [
      {
        type: 'create',
        entity: 'Comment',
        id: commentId,
        data: {
          entityType: 'Character',
          entityId: characterId,
          fieldId: null,
          fieldKey: 'name',
          contentSnapshot: 'Keres',
          excerptText: null,
          authorUserId: bia.userId,
          commentText: 'Comentário da Bia',
          criticality: 1,
        },
      },
    ]);

    const deletion = await push(caio.token, storyId, [
      {
        type: 'delete',
        entity: 'Comment',
        id: commentId,
        version: created.data.applied[0].entityVersion,
      },
    ]);

    expect(deletion.data.applied).toEqual([]);
    expect(deletion.data.conflicts).toEqual([
      expect.objectContaining({ entity: 'Comment', entityId: commentId, reason: 'unauthorized' }),
    ]);
  });
});

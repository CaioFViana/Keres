import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * Two devices make the same thing offline: a tag of one name, the same pair of related
 * characters. The server keeps the first and refuses the second as a `duplicate`, naming the live
 * twin (`serverEntity`) for the client to fold its row into - never a raw database error turned
 * into an `unknown` conflict nobody can resolve, and never a tombstone blocking a new row.
 */

let ana: TestUser;
let storyId: string;

const push = (updates: Record<string, unknown>[]) =>
  request('POST', `/sync/${storyId}`, {
    token: ana.token,
    body: updates.map((update) => ({ clientOperationId: newId(), ...update })),
  });

const pull = (lastOperationVersion: number) =>
  request('GET', `/sync/${storyId}/pull`, {
    token: ana.token,
    query: { lastOperationVersion, lastPublicFavoriteVersion: 0 },
  });

const createTag = (id: string, name: string) => ({
  type: 'create',
  entity: 'Tag',
  id,
  version: 0,
  data: { name, color: null, isFavorite: false, extraNotes: null },
});

const createCharacter = (id: string, name: string) => ({
  type: 'create',
  entity: 'Character',
  id,
  version: 0,
  data: { name },
});

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('duplicates', () => {
  it('refuses a second live tag of one name, naming the first', async () => {
    const first = newId();
    const second = newId();
    await push([createTag(first, 'Vilões')]);

    const { data } = await push([createTag(second, 'Vilões')]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({
        entityId: second,
        reason: 'duplicate',
        serverEntity: expect.objectContaining({ id: first, name: 'Vilões' }),
        serverVersion: 1,
      }),
    ]);
  });

  it('lets a tombstone go: a deleted tag never blocks a new one of its name', async () => {
    const first = newId();
    await push([createTag(first, 'Vilões')]);
    await push([{ type: 'delete', entity: 'Tag', id: first, version: 1 }]);

    const { data } = await push([createTag(newId(), 'Vilões')]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
  });

  it('refuses restoring a tag whose name a live one took meanwhile', async () => {
    const first = newId();
    const second = newId();
    await push([createTag(first, 'Vilões')]);
    await push([{ type: 'delete', entity: 'Tag', id: first, version: 1 }]);
    await push([createTag(second, 'Vilões')]);

    const { data } = await push([
      {
        type: 'update',
        entity: 'Tag',
        id: first,
        version: 2,
        changes: { isDeleted: false, version: 2 },
      },
    ]);

    expect(data.conflicts).toEqual([
      expect.objectContaining({
        entityId: first,
        reason: 'duplicate',
        serverEntity: expect.objectContaining({ id: second }),
        // Its own row as the server keeps it: still deleted.
        ownEntity: expect.objectContaining({ id: first, isDeleted: true, version: 2 }),
      }),
    ]);
  });

  /** The server stores a relation's pair sorted; every device learns the stored order. */
  it('records what it stored: a pair of characters as sorted, not as sent', async () => {
    const low = `01A${newId().slice(3)}`;
    const high = `01Z${newId().slice(3)}`;
    await push([createCharacter(low, 'Ana'), createCharacter(high, 'Bia')]);
    const before = (await pull(0)).data.updates.length;
    const relation = newId();

    await push([
      {
        type: 'create',
        entity: 'CharacterRelation',
        id: relation,
        version: 0,
        data: { character1Id: high, character2Id: low, relationType: 'irmãs' },
      },
    ]);

    const { data } = await pull(before);
    expect(data.updates.at(-1)).toMatchObject({
      type: 'create',
      entity: 'CharacterRelation',
      id: relation,
      data: expect.objectContaining({ character1Id: low, character2Id: high }),
    });
  });

  /** Two devices replacing one route's path offline: the path stays whole, never a union. */
  it('refuses a second live step at a route position, naming the first', async () => {
    storyId = (await uploadTestStory(ana.token, 'Caminhos', 'branching')).id;
    const route = newId();
    const scene = newId();
    const first = newId();
    const second = newId();
    const seeded = await push([
      {
        type: 'create',
        entity: 'Scene',
        id: scene,
        version: 0,
        data: {
          chapterId: null,
          locationId: null,
          name: 'Porto',
          index: 1,
          summary: null,
          gap: null,
          gapType: null,
          duration: null,
          durationType: null,
          isFavorite: false,
          extraNotes: null,
        },
      },
      {
        type: 'create',
        entity: 'Route',
        id: route,
        version: 0,
        data: { name: 'Fuga', details: null },
      },
      {
        type: 'create',
        entity: 'RouteStep',
        id: first,
        version: 0,
        data: { routeId: route, position: 1, sceneId: scene, selectedChoiceId: null },
      },
    ]);
    expect(seeded.data.conflicts).toEqual([]);

    const { data } = await push([
      {
        type: 'create',
        entity: 'RouteStep',
        id: second,
        version: 0,
        data: { routeId: route, position: 1, sceneId: scene, selectedChoiceId: null },
      },
    ]);

    expect(data.conflicts).toEqual([
      expect.objectContaining({
        entityId: second,
        reason: 'duplicate',
        serverEntity: expect.objectContaining({ id: first, position: 1 }),
      }),
    ]);
  });

  /**
   * Two devices each made the story's first arc offline: both made it the default. The uploaded
   * story already has its default, so any new default is its twin.
   */
  it('keeps one default arc: a second is its twin, any other arc is its own', async () => {
    const arc = (id: string, isDefault: boolean) => ({
      type: 'create',
      entity: 'StoryArc',
      id,
      version: 0,
      data: { title: id.slice(-4), description: null, sortOrder: 0, isDefault },
    });
    const second = newId();
    const plain = newId();

    const { data } = await push([arc(second, true), arc(plain, false)]);

    expect(data.conflicts).toEqual([
      expect.objectContaining({
        entityId: second,
        reason: 'duplicate',
        serverEntity: expect.objectContaining({ isDefault: true }),
      }),
    ]);
    expect(data.applied).toEqual([expect.objectContaining({ entityId: plain })]);
  });
});

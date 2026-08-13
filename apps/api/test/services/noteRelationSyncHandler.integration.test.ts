import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { db } from '../../src/db';
import { stories, users } from '../../src/db/schema';
import { ChapterSyncHandler } from '../../src/services/entity-sync-handlers/ChapterSyncHandler';
import { CharacterSyncHandler } from '../../src/services/entity-sync-handlers/CharacterSyncHandler';
import { LocationSyncHandler } from '../../src/services/entity-sync-handlers/LocationSyncHandler';
import { NoteRelationSyncHandler } from '../../src/services/entity-sync-handlers/NoteRelationSyncHandler';
import { NoteSyncHandler } from '../../src/services/entity-sync-handlers/NoteSyncHandler';
import { SceneSyncHandler } from '../../src/services/entity-sync-handlers/SceneSyncHandler';
import { WorldRuleSyncHandler } from '../../src/services/entity-sync-handlers/WorldRuleSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;
let noteId: string;
let entities: Record<string, string>;
const create = (entity: string, id: string, data: Record<string, unknown>) => ({ type: 'create', entity, id, data } as CreateStoryUpdate);

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  const chapterId = newId();
  const locationId = newId();
  const characterId = newId();
  const sceneId = newId();
  const worldRuleId = newId();
  noteId = newId();
  entities = { Character: characterId, Location: locationId, Chapter: chapterId, Scene: sceneId, WorldRule: worldRuleId };
  await db.insert(users).values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({ id: storyId, userId, title: 'A Queda', type: 'linear', createdAt: now, updatedAt: now, version: 1, isDeleted: false } as never);
  await new ChapterSyncHandler().create(userId, storyId, create('Chapter', chapterId, { name: 'Prólogo', index: 1, summary: null, isFavorite: false, extraNotes: null }));
  await new LocationSyncHandler().create(userId, storyId, create('Location', locationId, { name: 'Olimpo', description: null, climate: null, culture: null, politics: null, isFavorite: false, extraNotes: null }));
  await new CharacterSyncHandler().create(userId, storyId, create('Character', characterId, { name: 'Keres' }));
  await new SceneSyncHandler().create(userId, storyId, create('Scene', sceneId, { chapterId, locationId, name: 'Chegada', index: 0, summary: null, gap: null, gapType: null, duration: null, durationType: null, isStart: true, isFinish: false, isFavorite: false, extraNotes: null }));
  await new WorldRuleSyncHandler().create(userId, storyId, create('WorldRule', worldRuleId, { title: 'Nenhum mortal entra', description: null, isFavorite: false, extraNotes: null }));
  await new NoteSyncHandler().create(userId, storyId, create('Note', noteId, { title: 'Profecia', body: null, isFavorite: false, extraNotes: null }));
});

describe('note relation sync handler', () => {
  it.each(['Character', 'Location', 'WorldRule', 'Scene', 'Chapter'] as const)('validates a note relation to a %s', async (relationType) => {
    const handler = new NoteRelationSyncHandler();
    const id = newId();
    await handler.create(userId, storyId, create('NoteRelation', id, { noteId, relationId: entities[relationType], relationType }));
    expect(await handler.findById(id)).toMatchObject({ noteId, relationId: entities[relationType], relationType, isDeleted: false });
  });

  it('does not allow changing the linked entity of an existing relation', async () => {
    const handler = new NoteRelationSyncHandler();
    const id = newId();
    await handler.create(userId, storyId, create('NoteRelation', id, { noteId, relationId: entities.Character, relationType: 'Character' }));
    const current = await handler.findById(id);
    await expect(handler.update(userId, storyId, { type: 'update', entity: 'NoteRelation', id, changes: { relationId: entities.Location, version: 1 } } as UpdateStoryUpdate, current)).rejects.toThrow(/Cannot change 'relationId'/i);
  });
});

/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createCharacterService } from '../../src/services/storymanagement/CharacterService';
import { createLocationService } from '../../src/services/storymanagement/LocationService';
import { createNoteService } from '../../src/services/storymanagement/NoteService';
import { createTagService } from '../../src/services/storymanagement/TagService';
import { createWorldRuleService } from '../../src/services/storymanagement/WorldRuleService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

async function operationCount(entityId: string): Promise<number> {
  return (
    await database.db
      .select()
      .from(schema.operationLogs)
      .where(eq(schema.operationLogs.entityId, entityId))
      .all()
  ).length;
}

describe('worldbuilding entity write lifecycles', () => {
  it('records a complete Character lifecycle and does not log a no-op update', async () => {
    const service = createCharacterService(database.db);
    const character = await service.createCharacter(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Mira',
      title: 'Cartógrafa',
    });
    const updated = await service.updateCharacter(TEST_USER_ID, character.id, { title: 'Capitã' });
    await service.updateCharacter(TEST_USER_ID, character.id, { title: 'Capitã' });
    await service.deleteCharacter(TEST_USER_ID, character.id);

    expect(updated).toMatchObject({ title: 'Capitã', version: 2 });
    expect(await service.getById(character.id)).toBeUndefined();
    expect(await operationCount(character.id)).toBe(3);
  });

  it('keeps Location edits and its deletion in the local operation history', async () => {
    const service = createLocationService(database.db);
    const location = await service.createLocation(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Porto das Brumas',
      climate: 'frio',
    });
    const updated = await service.updateLocation(TEST_USER_ID, location.id, {
      description: 'Navios desaparecem na neblina.',
    });
    await service.deleteLocation(TEST_USER_ID, location.id);

    expect(updated).toMatchObject({ description: 'Navios desaparecem na neblina.', version: 2 });
    expect(await service.getById(location.id)).toBeUndefined();
    expect(await operationCount(location.id)).toBe(3);
  });

  it('tombstones a Note after writing its body update', async () => {
    const service = createNoteService(database.db);
    const note = await service.createNote(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Pista',
      body: 'A torre está fechada.',
    });
    await service.updateNote(TEST_USER_ID, note.id, { body: 'A torre abre à meia-noite.' });
    await service.deleteNote(TEST_USER_ID, note.id);

    expect(await service.getById(note.id)).toBeUndefined();
    expect(await operationCount(note.id)).toBe(3);
  });

  it('updates and removes a WorldRule through the same sync-aware lifecycle', async () => {
    const service = createWorldRuleService(database.db);
    const rule = await service.createWorldRule(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      title: 'Magia',
      description: 'Todo feitiço cobra uma memória.',
    });
    const updated = await service.updateWorldRule(TEST_USER_ID, rule.id, {
      description: 'Todo feitiço cobra uma lembrança feliz.',
    });
    await service.deleteWorldRule(TEST_USER_ID, rule.id);

    expect(updated).toMatchObject({
      description: 'Todo feitiço cobra uma lembrança feliz.',
      version: 2,
    });
    expect(await service.getById(rule.id)).toBeUndefined();
    expect(await operationCount(rule.id)).toBe(3);
  });

  it('updates Tag metadata, logs it, and keeps the deleted tag out of regular reads', async () => {
    const service = createTagService(database.db);
    const tag = await service.createTag(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Mistério',
      color: '#663399',
    });
    await service.updateTag(TEST_USER_ID, tag.id, { color: '#4b0082' });
    await service.deleteTag(TEST_USER_ID, tag.id);

    expect(await service.getById(tag.id)).toBeUndefined();
    expect(await operationCount(tag.id)).toBe(3);
  });
});

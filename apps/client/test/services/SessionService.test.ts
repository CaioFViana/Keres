/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createAttributeValueService } from '../../src/services/storymanagement/AttributeValueService';
import { startSession } from '../../src/services/storymanagement/SessionService';
import { createStorySchemaFieldService } from '../../src/services/storymanagement/StorySchemaFieldService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const start = (overrides: Partial<Parameters<typeof startSession>[2]> = {}) =>
  startSession(database.db, TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    arcId: null,
    chapterName: 'Session 1',
    sceneName: 'Scene 1',
    playedOn: '2026-10-03',
    ...overrides,
  });

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('startSession', () => {
  it('opens a session with its first scene inside it', async () => {
    const { chapter, scene } = await start();

    expect(chapter).toMatchObject({ name: 'Session 1', type: 'chapter', index: 1 });
    expect(scene).toMatchObject({ name: 'Scene 1', chapterId: chapter.id });
  });

  it('puts each session after the last one', async () => {
    await start({ chapterName: 'Session 1' });
    const second = await start({ chapterName: 'Session 2' });

    expect(second.chapter.index).toBe(2);
  });

  it('files the session in the work asked for, or in the default one', async () => {
    const { chapter } = await start();
    const arcs = await database.db
      .select()
      .from(schema.storyArcs)
      .where(eq(schema.storyArcs.storyId, TEST_STORY_ID))
      .all();

    expect(arcs).toHaveLength(1);
    expect(chapter.arcId).toBe(arcs[0].id);
    expect((await start({ arcId: arcs[0].id })).chapter.arcId).toBe(arcs[0].id);
  });

  it('keeps the real date in the session_date field when the story has it', async () => {
    const field = await createStorySchemaFieldService(database.db).createField(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      entityType: 'Chapter',
      name: 'Played on',
      key: 'session_date',
      description: null,
      type: 'date',
      targetEntityType: null,
      isRequired: false,
      defaultValue: null,
      order: 0,
    } as never);

    const { chapter } = await start();

    const values = await createAttributeValueService(database.db).getValuesForEntity(chapter.id);
    expect(values.map((value) => [value.fieldId, value.value])).toEqual([[field.id, '2026-10-03']]);
    expect(chapter.summary).toBeNull();
  });

  it('never loses the date for the want of the field: it goes into the summary', async () => {
    const { chapter } = await start();

    expect(chapter.summary).toBe('2026-10-03');
  });
});

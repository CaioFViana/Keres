/**
 * @jest-environment node
 */
import type { TFunction } from 'i18next';
import * as schema from '@/src/db/schema';
import { loadChoiceAnnotations } from '@/src/services/storymanagement/choices-stats/choiceAnnotations';
import { entityBase, seedLocalStory, TEST_STORY_ID } from '@/test/helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '@/test/helpers/testDb';

const t = ((key: string) => key) as unknown as TFunction;

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
});

describe('loadChoiceAnnotations', () => {
  it('has no annotations for a story whose choices carry no checks or effects', async () => {
    const annotations = await loadChoiceAnnotations(database.db, TEST_STORY_ID, [], t);

    expect(annotations.size).toBe(0);
  });

  it('resolves scene and item names while loading, and still annotates nothing without checks', async () => {
    await database.db.insert(schema.items).values({
      id: 'item-key',
      storyId: TEST_STORY_ID,
      name: 'Chave de ferro',
      ...entityBase,
    });

    const annotations = await loadChoiceAnnotations(
      database.db,
      TEST_STORY_ID,
      [{ id: 'scene-1', name: 'A ponte' }],
      t,
    );

    expect(annotations.size).toBe(0);
  });

  it('reads only the story it was asked about', async () => {
    await seedLocalStory(database, { id: 'other-story', title: 'Outra' });
    await database.db.insert(schema.items).values({
      id: 'item-other',
      storyId: 'other-story',
      name: 'De outra historia',
      ...entityBase,
    });

    await expect(loadChoiceAnnotations(database.db, TEST_STORY_ID, [], t)).resolves.toEqual(
      new Map(),
    );
  });
});

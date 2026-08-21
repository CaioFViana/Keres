import * as schema from '../../src/db/schema';
import type { TestDatabase } from './testDb';

export const TEST_STORY_ID = 'story-test';
export const TEST_USER_ID = 'local-user';
export const TEST_NOW = new Date('2026-08-14T12:00:00.000Z');
export const entityBase = {
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  version: 1,
  isDeleted: false,
};

/** A local story is writable and supplies the operation-log foreign key used by domain services. */
export async function seedLocalStory(
  database: TestDatabase,
  overrides: Partial<typeof schema.stories.$inferInsert> = {},
) {
  await database.db.insert(schema.stories).values({
    id: TEST_STORY_ID,
    userId: TEST_USER_ID,
    title: 'A Queda',
    type: 'linear',
    favoriteBehavior: 'individual',
    ...entityBase,
    ...overrides,
  });
}

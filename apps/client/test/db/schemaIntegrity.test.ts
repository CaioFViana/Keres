/**
 * @jest-environment node
 */
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => database.close());

describe('production SQLite schema integrity', () => {
  it('rejects a choice-check group whose choice does not exist', () => {
    expect(() =>
      database.raw
        .prepare(
          `INSERT INTO choice_check_groups
            (id, story_id, choice_id, combinator, "order", created_at, updated_at, version, is_deleted)
           VALUES ('orphan-group', 'story', 'missing-choice', 'AND', 1, 0, 0, 1, 0)`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  /**
   * A synced table takes every row the server holds. Two devices can each write the same entity's
   * value for one field offline: the server keeps one and answers the other with `duplicate`, which
   * that device folds away - but until then this device must be able to hold both. A local unique
   * constraint refused the pulled twin, and after three failures the pull dropped it for good.
   */
  it.each([
    [
      'attribute values of one entity and field',
      `INSERT INTO attribute_values
        (id, story_id, entity_type, entity_id, field_id, value, created_at, updated_at, version, is_deleted)
       VALUES (?, 'story', 'Character', 'character', 'rank', '7', 0, 0, 1, 0)`,
    ],
    [
      'schema fields with one key',
      `INSERT INTO story_schema_fields
        (id, story_id, entity_type, name, key, type, is_required, "order", created_at, updated_at, version, is_deleted)
       VALUES (?, 'story', 'Character', 'Rank', 'rank', 'number', 0, 0, 0, 0, 1, 0)`,
    ],
    [
      'tags with one name',
      `INSERT INTO tags (id, story_id, name, created_at, updated_at, version, is_deleted)
       VALUES (?, 'story', 'Vilão', 0, 0, 1, 0)`,
    ],
  ])('holds two live rows of %s until the push folds one', (_label, insert) => {
    database.raw.prepare(insert).run('first');
    expect(() => database.raw.prepare(insert).run('twin')).not.toThrow();
  });
});

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

  it('enforces one attribute value per entity and schema field', () => {
    database.raw
      .prepare(
        `INSERT INTO attribute_values
          (id, story_id, entity_type, entity_id, field_id, value, created_at, updated_at, version, is_deleted)
         VALUES ('first', 'story', 'Character', 'character', 'rank', '7', 0, 0, 1, 0)`,
      )
      .run();

    expect(() =>
      database.raw
        .prepare(
          `INSERT INTO attribute_values
            (id, story_id, entity_type, entity_id, field_id, value, created_at, updated_at, version, is_deleted)
           VALUES ('duplicate', 'story', 'Character', 'character', 'rank', '8', 0, 0, 1, 0)`,
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed: attribute_values.entity_id, attribute_values.field_id/);
  });

  it('enforces one schema key per story and entity type', () => {
    database.raw
      .prepare(
        `INSERT INTO story_schema_fields
          (id, story_id, entity_type, name, key, type, is_required, "order", created_at, updated_at, version, is_deleted)
         VALUES ('first-field', 'story', 'Character', 'Rank', 'rank', 'number', 0, 0, 0, 0, 1, 0)`,
      )
      .run();

    expect(() =>
      database.raw
        .prepare(
          `INSERT INTO story_schema_fields
            (id, story_id, entity_type, name, key, type, is_required, "order", created_at, updated_at, version, is_deleted)
           VALUES ('duplicate-field', 'story', 'Character', 'Outro Rank', 'rank', 'number', 0, 1, 0, 0, 1, 0)`,
        )
        .run(),
    ).toThrow(
      /UNIQUE constraint failed: story_schema_fields.story_id, story_schema_fields.entity_type, story_schema_fields.key/,
    );
  });
});

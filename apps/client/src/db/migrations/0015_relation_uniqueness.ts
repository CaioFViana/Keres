import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  -- The uniqueness rules PostgreSQL has always enforced, finally enforced locally too.
--
-- The server's schema declares unique constraints on character relations, location relations, tag
-- relations, suggestions and tag names. The local SQLite declared none of them, so the client
-- accepted rows the server would refuse - and the refusal only arrived at the far end of a
-- synchronization, long after the duplicate was already drawn twice on the relation graph. The
-- bundled example stories were shipping exactly that.
--
-- The pair indexes are on the *unordered* pair (min/max of the two ids), not on the pair as stored.
-- One relation between two characters means one, whichever column each id happens to sit in - which
-- is what CharacterRelationService has always checked, and what the server's sync handler achieves
-- by sorting the ids before writing.
--
-- Every index is partial (WHERE is_deleted = 0): a soft-deleted row is gone as far as the app is
-- concerned and must not keep the pair reserved.
--
-- Rows already duplicated on the device are soft-deleted first, keeping the oldest of each group -
-- without that, creating the index fails and the app cannot open. They are not pushed as deletions:
-- the server never accepted them in the first place, so there is nothing there to delete.

-- Character relations: one per unordered pair.
UPDATE "character_relations"
SET "is_deleted" = 1, "deleted_at" = strftime('%s', 'now'), "version" = "version" + 1
WHERE "is_deleted" = 0
  AND "id" NOT IN (
    SELECT MIN("id") FROM "character_relations" WHERE "is_deleted" = 0
    GROUP BY "story_id",
      MIN("character1_id", "character2_id"),
      MAX("character1_id", "character2_id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "character_relation_pair_unique"
ON "character_relations" (
  "story_id",
  MIN("character1_id", "character2_id"),
  MAX("character1_id", "character2_id")
) WHERE "is_deleted" = 0;

-- Location relations: one per unordered pair *per type*. "contains" and "connected_to" between the
-- same two places are two different statements, exactly as the server's constraint has it.
UPDATE "location_relations"
SET "is_deleted" = 1, "deleted_at" = strftime('%s', 'now'), "version" = "version" + 1
WHERE "is_deleted" = 0
  AND "id" NOT IN (
    SELECT MIN("id") FROM "location_relations" WHERE "is_deleted" = 0
    GROUP BY "story_id",
      MIN("location_a_id", "location_b_id"),
      MAX("location_a_id", "location_b_id"),
      "relation_type"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "location_relation_pair_unique"
ON "location_relations" (
  "story_id",
  MIN("location_a_id", "location_b_id"),
  MAX("location_a_id", "location_b_id"),
  "relation_type"
) WHERE "is_deleted" = 0;

-- Tag relations: a tag applies to an entity once.
UPDATE "tag_relations"
SET "is_deleted" = 1, "deleted_at" = strftime('%s', 'now'), "version" = "version" + 1
WHERE "is_deleted" = 0
  AND "id" NOT IN (
    SELECT MIN("id") FROM "tag_relations" WHERE "is_deleted" = 0
    GROUP BY "story_id", "tag_id", "relation_id", "relation_type"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "tag_relation_target_unique"
ON "tag_relations" ("story_id", "tag_id", "relation_id", "relation_type")
WHERE "is_deleted" = 0;

-- Suggestions: the autocomplete catalog holds each value once per type.
UPDATE "suggestions"
SET "is_deleted" = 1, "deleted_at" = strftime('%s', 'now'), "version" = "version" + 1
WHERE "is_deleted" = 0
  AND "id" NOT IN (
    SELECT MIN("id") FROM "suggestions" WHERE "is_deleted" = 0
    GROUP BY "story_id", "type", "value"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "suggestion_type_value_unique"
ON "suggestions" ("story_id", "type", "value")
WHERE "is_deleted" = 0;

-- Tags: no two tags with the same name in one story.
UPDATE "tags"
SET "is_deleted" = 1, "deleted_at" = strftime('%s', 'now'), "version" = "version" + 1
WHERE "is_deleted" = 0
  AND "id" NOT IN (
    SELECT MIN("id") FROM "tags" WHERE "is_deleted" = 0
    GROUP BY "story_id", "name"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "tag_story_name_unique"
ON "tags" ("story_id", "name")
WHERE "is_deleted" = 0;

`);
}

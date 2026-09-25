ALTER TABLE "stories" ADD COLUMN "last_operation_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Dedupe before the unique index below: the previous MAX()+1 numbering raced, so two rows can
-- share one (story_id, operation_version) and the index build would fail the whole upgrade.
-- Keeps the earliest-inserted row of each group (ids are ULIDs, so MIN(id) is the oldest) and
-- renumbers the rest above the story's max with a single per-story sequence, so victims from
-- different groups can never collide with each other. A no-op when there are no duplicates.
-- (Explicit AS aliases: valid in Postgres and SQLite alike, so this statement also runs
-- verbatim in the sqlite-backed regression test.)
UPDATE "operation_log" AS "ol" SET "operation_version" = "v"."new_version"
FROM (
  SELECT "id", "max_v" + ROW_NUMBER() OVER (PARTITION BY "story_id" ORDER BY "id") AS "new_version"
  FROM (
    SELECT "id", "story_id",
           MAX("operation_version") OVER (PARTITION BY "story_id") AS "max_v",
           ROW_NUMBER() OVER (PARTITION BY "story_id", "operation_version" ORDER BY "id") AS "dup_rn"
    FROM "operation_log"
  ) AS "s" WHERE "dup_rn" > 1
) AS "v" WHERE "ol"."id" = "v"."id";--> statement-breakpoint
-- Backfill AFTER the dedupe above: the renumbered rows sit above the old max, and the counter
-- must cover them or the next operation re-issues a taken version. Without any backfill at all,
-- the next operation of a story with history would calculate last_operation_version + 1 = 1,
-- colliding with the operation_version = 1 that already exists for it.
UPDATE "stories" s SET "last_operation_version" = COALESCE(
  (SELECT MAX(ol.operation_version) FROM "operation_log" ol WHERE ol.story_id = s.id),
  0
);--> statement-breakpoint
CREATE UNIQUE INDEX "operation_log_story_id_operation_version_idx" ON "operation_log" USING btree ("story_id","operation_version");

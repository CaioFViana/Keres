-- Legacy duplicates (written by the pre-mutex read-then-insert race) would fail the
-- unique index below and block the app from opening. Keep the earliest-inserted row of
-- each (story, version) group; renumber the rest above the story's max. rowid is unique
-- table-wide, so max + rowid can never collide with an existing version. A no-op when
-- there are no duplicates.
UPDATE "operation_logs"
SET "operation_version" = (
  SELECT COALESCE(MAX("o2"."operation_version"), 0)
  FROM "operation_logs" AS "o2"
  WHERE "o2"."story_id" = "operation_logs"."story_id"
) + "operation_logs"."rowid"
WHERE "operation_logs"."rowid" NOT IN (
  SELECT MIN("o3"."rowid")
  FROM "operation_logs" AS "o3"
  GROUP BY "o3"."story_id", "o3"."operation_version"
);
--> statement-breakpoint
-- The renumbering above can push versions past the story cursor; a cursor left behind
-- would re-issue an existing version on the next local write and hit the unique index.
-- Raise it to the max (never lower it). Synced rows can inflate this with server-side
-- versions - a numbering gap, but never a reuse.
UPDATE "stories"
SET "last_operation_log" = (
  SELECT MAX("o"."operation_version")
  FROM "operation_logs" AS "o"
  WHERE "o"."story_id" = "stories"."id"
)
WHERE (
  SELECT COALESCE(MAX("o"."operation_version"), 0)
  FROM "operation_logs" AS "o"
  WHERE "o"."story_id" = "stories"."id"
) > COALESCE("stories"."last_operation_log", 0);
--> statement-breakpoint
CREATE UNIQUE INDEX `operation_log_story_version_unique` ON `operation_logs` (`story_id`,`operation_version`);--> statement-breakpoint
CREATE INDEX `operation_log_pushable_idx` ON `operation_logs` (`story_id`,`is_synced`,`conflict_state`);--> statement-breakpoint
CREATE INDEX `operation_log_server_version_idx` ON `operation_logs` (`story_id`,`server_operation_version`);--> statement-breakpoint
CREATE INDEX `operation_log_entity_idx` ON `operation_logs` (`story_id`,`entity_type`,`entity_id`);
